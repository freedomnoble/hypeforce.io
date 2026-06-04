
-- ============ helpers ============
CREATE TABLE IF NOT EXISTS public.super_admins (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins sa
    JOIN auth.users u ON lower(u.email) = lower(sa.email)
    WHERE u.id = _user_id
  )
$$;

CREATE POLICY "super admins read super_admins" ON public.super_admins
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admins manage super_admins" ON public.super_admins
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.super_admins(email) VALUES ('freedom@hypeforce.io')
  ON CONFLICT DO NOTHING;

-- shared updated_at trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ support tickets ============
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT INSERT ON public.support_tickets TO anon;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone submits tickets" ON public.support_tickets
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "admins update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_ticket_attachments TO authenticated;
GRANT INSERT ON public.support_ticket_attachments TO anon;
GRANT ALL ON public.support_ticket_attachments TO service_role;
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone inserts attachments" ON public.support_ticket_attachments
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read attachments" ON public.support_ticket_attachments
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TABLE public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (author IN ('admin','user','system')),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "admins insert messages" ON public.support_ticket_messages
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));

-- Allow ticket creator (when logged in) to read their own ticket thread
CREATE POLICY "ticket owner reads own ticket" ON public.support_tickets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ticket owner reads own messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );

CREATE TABLE public.support_rate_limit (
  ip TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.support_rate_limit TO service_role;
ALTER TABLE public.support_rate_limit ENABLE ROW LEVEL SECURITY;
-- service_role only; no policies needed for app access

-- ============ landing_content (single row) ============
CREATE TABLE public.landing_content (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme_key TEXT,
  hero_image_url TEXT,
  demo_video_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.landing_content TO anon, authenticated;
GRANT ALL ON public.landing_content TO service_role;
ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads landing" ON public.landing_content
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write landing" ON public.landing_content
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_landing_updated BEFORE UPDATE ON public.landing_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.landing_content(id, content) VALUES (1, '{}'::jsonb) ON CONFLICT DO NOTHING;

-- ============ pricing_config (single row) ============
CREATE TABLE public.pricing_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  founder_price_monthly INT NOT NULL DEFAULT 900,
  founder_seats_remaining INT NOT NULL DEFAULT 1000,
  founder_active BOOLEAN NOT NULL DEFAULT true,
  pro_price_monthly INT NOT NULL DEFAULT 2900,
  pro_price_annual INT NOT NULL DEFAULT 29000,
  team_price_monthly INT NOT NULL DEFAULT 9900,
  team_price_annual INT NOT NULL DEFAULT 99000,
  discount_percent INT NOT NULL DEFAULT 0,
  standard_seat_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_config TO anon, authenticated;
GRANT ALL ON public.pricing_config TO service_role;
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads pricing" ON public.pricing_config
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write pricing" ON public.pricing_config
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_pricing_updated BEFORE UPDATE ON public.pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.pricing_config(id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ subscriptions (mock) ============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'none' CHECK (plan IN ('none','founder','pro','team')),
  interval TEXT NOT NULL DEFAULT 'monthly' CHECK (interval IN ('monthly','annual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','canceled','cancel_requested','trialing')),
  amount_cents INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  cancel_requested_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ user_usage_limits ============
CREATE TABLE public.user_usage_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lovable_gateway_paused BOOLEAN NOT NULL DEFAULT false,
  monthly_message_cap INT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_usage_limits TO authenticated;
GRANT ALL ON public.user_usage_limits TO service_role;
ALTER TABLE public.user_usage_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own limit" ON public.user_usage_limits
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins manage limits" ON public.user_usage_limits
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_limits_updated BEFORE UPDATE ON public.user_usage_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ outbound admin DMs to users (in-app inbox) ============
CREATE TABLE public.admin_user_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.admin_user_messages TO authenticated;
GRANT ALL ON public.admin_user_messages TO service_role;
ALTER TABLE public.admin_user_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipients read own" ON public.admin_user_messages
  FOR SELECT TO authenticated USING (recipient_user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "recipients mark read" ON public.admin_user_messages
  FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());
CREATE POLICY "admins manage admin_user_messages" ON public.admin_user_messages
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
