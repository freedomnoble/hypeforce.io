
CREATE TABLE public.credit_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL CHECK (source IN ('plan_monthly','topup','admin','signup','promo')),
  paddle_transaction_id TEXT UNIQUE,
  note TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX credit_grants_user_idx ON public.credit_grants(user_id, created_at DESC);
GRANT SELECT ON public.credit_grants TO authenticated;
GRANT ALL ON public.credit_grants TO service_role;
ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own grants" ON public.credit_grants FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read all grants" ON public.credit_grants FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TABLE public.credit_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('text','image')),
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  image_count INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd_micros BIGINT NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX credit_usage_user_created_idx ON public.credit_usage(user_id, created_at DESC);
CREATE INDEX credit_usage_workspace_idx ON public.credit_usage(workspace_id, created_at DESC);
GRANT SELECT ON public.credit_usage TO authenticated;
GRANT ALL ON public.credit_usage TO service_role;
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own usage" ON public.credit_usage FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read all usage" ON public.credit_usage FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TABLE public.model_pricing (
  model TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('text','image')),
  input_credits_per_1k NUMERIC(10,4) NOT NULL DEFAULT 0,
  output_credits_per_1k NUMERIC(10,4) NOT NULL DEFAULT 0,
  per_image_credits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.model_pricing TO authenticated, anon;
GRANT ALL ON public.model_pricing TO service_role;
ALTER TABLE public.model_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads pricing" ON public.model_pricing FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins write pricing" ON public.model_pricing FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.plan_credit_allowances (
  plan TEXT NOT NULL PRIMARY KEY,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  signup_bonus INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_credit_allowances TO authenticated, anon;
GRANT ALL ON public.plan_credit_allowances TO service_role;
ALTER TABLE public.plan_credit_allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads allowances" ON public.plan_credit_allowances FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins write allowances" ON public.plan_credit_allowances FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.model_pricing (model, kind, input_credits_per_1k, output_credits_per_1k, per_image_credits) VALUES
  ('google/gemini-3-flash-preview', 'text', 0.12, 1.00, 0),
  ('google/gemini-2.5-flash', 'text', 0.12, 1.00, 0),
  ('google/gemini-2.5-pro', 'text', 0.50, 4.00, 0),
  ('openai/gpt-5-mini', 'text', 0.10, 0.80, 0),
  ('openai/gpt-5', 'text', 0.50, 4.00, 0),
  ('anthropic/claude-sonnet-4', 'text', 1.20, 6.00, 0),
  ('google/gemini-2.5-flash-image', 'image', 0, 0, 16)
ON CONFLICT (model) DO NOTHING;

INSERT INTO public.plan_credit_allowances (plan, monthly_credits, signup_bonus) VALUES
  ('none', 0, 100),
  ('free', 50, 100),
  ('founder', 1000, 100),
  ('pro', 2500, 100),
  ('team', 8000, 100)
ON CONFLICT (plan) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_user_credit_balance(uid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT SUM(amount)::INTEGER FROM public.credit_grants
     WHERE user_id = uid AND (expires_at IS NULL OR expires_at > now())),
    0
  ) - COALESCE(
    (SELECT SUM(credits)::INTEGER FROM public.credit_usage
     WHERE user_id = uid),
    0
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_user_credit_balance(UUID) TO authenticated, service_role;

INSERT INTO public.credit_grants (user_id, amount, source, note)
SELECT u.id, 100, 'signup', 'Backfill signup bonus'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.credit_grants g WHERE g.user_id = u.id AND g.source = 'signup');

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_workspace_id UUID;
  new_channel_id UUID;
  agent_chatgpt_id UUID;
  agent_gemini_id UUID;
  agent_nano_id UUID;
  ws_slug TEXT;
  signup_credits INTEGER;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT signup_bonus INTO signup_credits FROM public.plan_credit_allowances WHERE plan = 'none';
  IF COALESCE(signup_credits, 0) > 0 THEN
    INSERT INTO public.credit_grants (user_id, amount, source, note)
    VALUES (NEW.id, signup_credits, 'signup', 'Welcome bonus');
  END IF;

  ws_slug := 'atelier-' || substr(NEW.id::text, 1, 8);
  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES ('The Atelier', ws_slug, NEW.id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  INSERT INTO public.user_roles (user_id, workspace_id, role)
  VALUES (NEW.id, new_workspace_id, 'owner');

  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  VALUES (new_workspace_id, 'ChatGPT', 'chatgpt', 'openai', 'openai/gpt-5-mini', 'Generalist & code copilot',
          'You are ChatGPT, a friendly generalist and code copilot. Be helpful, accurate, and clear.', '/avatars/chatgpt.png')
  RETURNING id INTO agent_chatgpt_id;

  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  VALUES (new_workspace_id, 'Gemini', 'gemini', 'google', 'google/gemini-3-flash-preview', 'Fast multimodal assistant',
          'You are Gemini, a fast multimodal assistant. Be quick, structured, and friendly.', '/avatars/gemini.png')
  RETURNING id INTO agent_gemini_id;

  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  VALUES (new_workspace_id, 'Nano Banana', 'nano', 'google', 'google/gemini-2.5-flash-image', 'Image generator — @nano to make pictures',
          'You are Nano Banana, an image generation agent. When @-mentioned, generate an image that matches the request.', '/avatars/nano.png')
  RETURNING id INTO agent_nano_id;

  INSERT INTO public.channels (workspace_id, name, topic, is_pinned, created_by)
  VALUES (new_workspace_id, 'launch-plan', 'Q3 launch sequence — agents collaborating on GTM', true, NEW.id)
  RETURNING id INTO new_channel_id;

  INSERT INTO public.channel_members (channel_id, member_type, user_id)
  VALUES (new_channel_id, 'user', NEW.id);
  INSERT INTO public.channel_members (channel_id, member_type, agent_id)
  VALUES (new_channel_id, 'agent', agent_chatgpt_id),
         (new_channel_id, 'agent', agent_gemini_id),
         (new_channel_id, 'agent', agent_nano_id);

  INSERT INTO public.channels (workspace_id, name, topic, created_by)
  VALUES (new_workspace_id, 'market-research', 'Competitive landscape and trends', NEW.id),
         (new_workspace_id, 'brand-voice', 'Tone, voice, and copy guidelines', NEW.id),
         (new_workspace_id, 'build-log', 'Daily build notes from the team', NEW.id);

  INSERT INTO public.messages (workspace_id, channel_id, author_type, author_agent_id, content)
  VALUES (new_workspace_id, new_channel_id, 'agent', agent_chatgpt_id,
    E'Welcome to **Hypeforce**.\n\nThis channel has 3 agents: @chatgpt, @gemini, and @nano (image generator). @-mention one to target it, or send a message with no @-mentions to brief everyone at once.');

  RETURN NEW;
END;
$function$;
