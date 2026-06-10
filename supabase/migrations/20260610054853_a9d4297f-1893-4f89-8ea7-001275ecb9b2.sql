
-- 1. Identity fields on agents (workspace defaults)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS personality text;

-- 2. Per-channel overrides
CREATE TABLE IF NOT EXISTS public.channel_agent_overrides (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  display_name text,
  role text,
  personality text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, agent_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_agent_overrides TO authenticated;
GRANT ALL ON public.channel_agent_overrides TO service_role;

ALTER TABLE public.channel_agent_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read overrides"
  ON public.channel_agent_overrides FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members write overrides"
  ON public.channel_agent_overrides FOR ALL
  TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER channel_agent_overrides_updated_at
  BEFORE UPDATE ON public.channel_agent_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Reply counters
CREATE TABLE IF NOT EXISTS public.agent_reply_counters (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, agent_id)
);

GRANT ALL ON public.agent_reply_counters TO service_role;
-- no authenticated grants: server-only

ALTER TABLE public.agent_reply_counters ENABLE ROW LEVEL SECURITY;
-- no policies: only service_role accesses this table
