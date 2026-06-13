
-- Phase 1: OpenClaw foundations

-- Feature flags (both default OFF)
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('openclaw_studio', false, 'Master switch: show OpenClaw entry in workspace sidebar.'),
  ('openclaw_enabled', false, 'When OFF (but openclaw_studio is ON), OpenClaw page shows a coming-soon placeholder instead of the wizard/chat.')
ON CONFLICT (key) DO NOTHING;

-- Settings row (single-row table; tunable cap without deploy)
CREATE TABLE public.openclaw_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cap_cents INTEGER NOT NULL DEFAULT 400,
  hard_kill_multiplier NUMERIC NOT NULL DEFAULT 1.5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT openclaw_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.openclaw_settings TO authenticated;
GRANT ALL ON public.openclaw_settings TO service_role;
ALTER TABLE public.openclaw_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read openclaw settings" ON public.openclaw_settings
  FOR SELECT TO authenticated USING (true);
INSERT INTO public.openclaw_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Agents table (one row per user-owned OpenClaw agent)
CREATE TABLE public.openclaw_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  persona JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_id TEXT,
  tool_allowlist TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  skill_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  fly_machine_id TEXT,
  fly_app TEXT,
  gateway_url TEXT,
  gateway_status TEXT NOT NULL DEFAULT 'provisioning',
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.openclaw_agents TO authenticated;
GRANT ALL ON public.openclaw_agents TO service_role;
ALTER TABLE public.openclaw_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own openclaw agents" ON public.openclaw_agents
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX openclaw_agents_user_idx ON public.openclaw_agents(user_id);
CREATE TRIGGER openclaw_agents_set_updated_at BEFORE UPDATE ON public.openclaw_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Append-only COGS ledger
CREATE TABLE public.openclaw_cogs_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.openclaw_agents(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('compute_seconds','model_usage')),
  amount_micros_usd BIGINT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('fly','model_router')),
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.openclaw_cogs_ledger TO authenticated;
GRANT ALL ON public.openclaw_cogs_ledger TO service_role;
ALTER TABLE public.openclaw_cogs_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own openclaw cogs" ON public.openclaw_cogs_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX openclaw_cogs_user_created_idx ON public.openclaw_cogs_ledger(user_id, created_at);

-- Waitlist (notify-me when openclaw_enabled is OFF)
CREATE TABLE public.openclaw_waitlist (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.openclaw_waitlist TO authenticated;
GRANT ALL ON public.openclaw_waitlist TO service_role;
ALTER TABLE public.openclaw_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own waitlist row" ON public.openclaw_waitlist
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- COGS aggregator RPC
CREATE OR REPLACE FUNCTION public.get_openclaw_cogs_cents(uid uuid, period_start timestamptz)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (SUM(amount_micros_usd) / 10000)::INTEGER
     FROM public.openclaw_cogs_ledger
     WHERE user_id = uid AND created_at >= period_start),
    0
  );
$$;

-- Access gate RPC
CREATE OR REPLACE FUNCTION public.openclaw_can_use(uid uuid)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap INTEGER;
  v_cogs INTEGER;
  v_period_start TIMESTAMPTZ;
  v_is_paying BOOLEAN;
  v_is_comped BOOLEAN;
BEGIN
  SELECT cap_cents INTO v_cap FROM public.openclaw_settings WHERE id = 1;
  IF v_cap IS NULL THEN v_cap := 400; END IF;

  SELECT is_comped INTO v_is_comped FROM public.profiles WHERE id = uid;
  v_is_comped := COALESCE(v_is_comped, false);

  v_is_paying := v_is_comped
    OR public.has_active_subscription(uid, 'live')
    OR public.has_active_subscription(uid, 'sandbox');

  IF NOT v_is_paying THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'no_subscription',
      'cogs_cents', 0,
      'cap_cents', v_cap
    );
  END IF;

  -- Anchor to billing period start when available, else calendar month
  SELECT MAX(current_period_start) INTO v_period_start
  FROM public.subscriptions
  WHERE user_id = uid
    AND status IN ('active','trialing','past_due')
    AND current_period_start IS NOT NULL;
  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
  END IF;

  v_cogs := public.get_openclaw_cogs_cents(uid, v_period_start);

  IF v_cogs >= v_cap THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'cogs_capped',
      'cogs_cents', v_cogs,
      'cap_cents', v_cap
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'ok',
    'cogs_cents', v_cogs,
    'cap_cents', v_cap
  );
END;
$$;
