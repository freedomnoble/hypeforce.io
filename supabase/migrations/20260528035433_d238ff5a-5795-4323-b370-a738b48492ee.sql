
-- ============== ENUMS ==============
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.agent_provider AS ENUM ('openai', 'anthropic', 'google', 'manus');
CREATE TYPE public.author_type AS ENUM ('user', 'agent');
CREATE TYPE public.member_type AS ENUM ('user', 'agent');
CREATE TYPE public.kb_kind AS ENUM ('rule', 'brand', 'brief', 'guideline');
CREATE TYPE public.file_scope AS ENUM ('chat', 'knowledge', 'avatar', 'voice');

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  voice_sample_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============== WORKSPACES ==============
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon_url TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- ============== WORKSPACE MEMBERS ==============
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- ============== USER ROLES (security definer) ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, workspace_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _workspace_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND workspace_id = _workspace_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id AND role IN ('owner','admin')
  )
$$;

-- Workspace policies (now that helpers exist)
CREATE POLICY "members read workspaces" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), id));
CREATE POLICY "authenticated create workspaces" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner updates workspace" ON public.workspaces FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "owner deletes workspace" ON public.workspaces FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "members read membership" ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "self insert membership" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "admin manage membership" ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "admin delete membership" ON public.workspace_members FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- ============== AGENTS ==============
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  provider public.agent_provider NOT NULL,
  model TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  avatar_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, handle)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read agents" ON public.agents FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "admin manage agents" ON public.agents FOR ALL TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

-- ============== CHANNELS ==============
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  topic TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read channels" ON public.channels FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members create channels" ON public.channels FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "creator/admin update channels" ON public.channels FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "admin delete channels" ON public.channels FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- ============== CHANNEL MEMBERS ==============
CREATE TABLE public.channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  member_type public.member_type NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((member_type = 'user' AND user_id IS NOT NULL AND agent_id IS NULL)
      OR (member_type = 'agent' AND agent_id IS NOT NULL AND user_id IS NULL))
);
CREATE UNIQUE INDEX channel_members_user_uniq ON public.channel_members(channel_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX channel_members_agent_uniq ON public.channel_members(channel_id, agent_id) WHERE agent_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_members TO authenticated;
GRANT ALL ON public.channel_members TO service_role;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read channel members" ON public.channel_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND public.is_workspace_member(auth.uid(), c.workspace_id)));
CREATE POLICY "members modify channel members" ON public.channel_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND public.is_workspace_member(auth.uid(), c.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND public.is_workspace_member(auth.uid(), c.workspace_id)));

-- ============== DIRECT MESSAGES ==============
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.dm_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_id UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  member_type public.member_type NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  CHECK ((member_type = 'user' AND user_id IS NOT NULL AND agent_id IS NULL)
      OR (member_type = 'agent' AND agent_id IS NOT NULL AND user_id IS NULL))
);
CREATE INDEX dm_participants_dm ON public.dm_participants(dm_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_participants TO authenticated;
GRANT ALL ON public.dm_participants TO service_role;
ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_dm_participant(_user_id UUID, _dm_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_participants
    WHERE dm_id = _dm_id AND user_id = _user_id
  )
$$;

CREATE POLICY "participants read dm" ON public.direct_messages FOR SELECT TO authenticated
  USING (public.is_dm_participant(auth.uid(), id));
CREATE POLICY "members create dm" ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "participants read dm parts" ON public.dm_participants FOR SELECT TO authenticated
  USING (public.is_dm_participant(auth.uid(), dm_id));
CREATE POLICY "creator manages dm parts" ON public.dm_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.direct_messages d WHERE d.id = dm_id AND d.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.direct_messages d WHERE d.id = dm_id AND d.created_by = auth.uid()));

-- ============== MESSAGES ==============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  dm_id UUID REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  author_type public.author_type NOT NULL,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  mentions UUID[] NOT NULL DEFAULT '{}',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (channel_id IS NOT NULL OR dm_id IS NOT NULL),
  CHECK ((author_type = 'user' AND author_user_id IS NOT NULL)
      OR (author_type = 'agent' AND author_agent_id IS NOT NULL))
);
CREATE INDEX messages_channel_created ON public.messages(channel_id, created_at);
CREATE INDEX messages_dm_created ON public.messages(dm_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND author_user_id = auth.uid() AND author_type = 'user');
CREATE POLICY "author edits own messages" ON public.messages FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid());
CREATE POLICY "author deletes own messages" ON public.messages FOR DELETE TO authenticated
  USING (author_user_id = auth.uid());

-- ============== FILES ==============
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  scope public.file_scope NOT NULL DEFAULT 'chat',
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO authenticated;
GRANT ALL ON public.files TO service_role;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read files" ON public.files FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members upload files" ON public.files FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploader_id AND public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "uploader updates files" ON public.files FOR UPDATE TO authenticated
  USING (auth.uid() = uploader_id OR public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "uploader deletes files" ON public.files FOR DELETE TO authenticated
  USING (auth.uid() = uploader_id OR public.is_workspace_admin(auth.uid(), workspace_id));

-- ============== KNOWLEDGE BASE ==============
CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind public.kb_kind NOT NULL DEFAULT 'brief',
  body TEXT,
  file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO authenticated;
GRANT ALL ON public.knowledge_base TO service_role;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read kb" ON public.knowledge_base FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "admin manage kb" ON public.knowledge_base FOR ALL TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

-- ============== HANDLE NEW USER -> PROFILE + DEFAULT WORKSPACE ==============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
  new_channel_id UUID;
  agent_manus_id UUID;
  agent_chatgpt_id UUID;
  agent_claude_id UUID;
  agent_gemini_id UUID;
  ws_slug TEXT;
BEGIN
  -- profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- default workspace
  ws_slug := 'atelier-' || substr(NEW.id::text, 1, 8);
  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES ('The Atelier', ws_slug, NEW.id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  INSERT INTO public.user_roles (user_id, workspace_id, role)
  VALUES (NEW.id, new_workspace_id, 'owner');

  -- seed agents
  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  VALUES (new_workspace_id, 'Manus', 'manus', 'manus', 'manus-default', 'Autonomous research & ops agent',
          'You are Manus, an autonomous research and operations agent. Be concise, practical, and structured.', '/avatars/manus.png')
  RETURNING id INTO agent_manus_id;

  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  VALUES (new_workspace_id, 'ChatGPT', 'chatgpt', 'openai', 'openai/gpt-5-mini', 'Generalist & code copilot',
          'You are ChatGPT, a friendly generalist and code copilot. Be helpful, accurate, and clear.', '/avatars/chatgpt.png')
  RETURNING id INTO agent_chatgpt_id;

  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  VALUES (new_workspace_id, 'Claude', 'claude', 'anthropic', 'openai/gpt-5-mini', 'Long-form writing & reasoning',
          'You are Claude, a thoughtful writer and reasoner. Favor clarity, nuance, and warmth.', '/avatars/claude.png')
  RETURNING id INTO agent_claude_id;

  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  VALUES (new_workspace_id, 'Gemini', 'gemini', 'google', 'google/gemini-3-flash-preview', 'Fast multimodal assistant',
          'You are Gemini, a fast multimodal assistant. Be quick, structured, and friendly.', '/avatars/gemini.png')
  RETURNING id INTO agent_gemini_id;

  -- seed channels
  INSERT INTO public.channels (workspace_id, name, topic, is_pinned, created_by)
  VALUES (new_workspace_id, 'launch-plan', 'Q3 launch sequence — agents collaborating on GTM', true, NEW.id)
  RETURNING id INTO new_channel_id;

  INSERT INTO public.channel_members (channel_id, member_type, user_id)
  VALUES (new_channel_id, 'user', NEW.id);
  INSERT INTO public.channel_members (channel_id, member_type, agent_id)
  VALUES (new_channel_id, 'agent', agent_manus_id),
         (new_channel_id, 'agent', agent_chatgpt_id),
         (new_channel_id, 'agent', agent_claude_id);

  INSERT INTO public.channels (workspace_id, name, topic, created_by)
  VALUES (new_workspace_id, 'market-research', 'Competitive landscape and trends', NEW.id),
         (new_workspace_id, 'brand-voice', 'Tone, voice, and copy guidelines', NEW.id),
         (new_workspace_id, 'build-log', 'Daily build notes from the team', NEW.id);

  -- welcome message
  INSERT INTO public.messages (workspace_id, channel_id, author_type, author_agent_id, content)
  VALUES (new_workspace_id, new_channel_id, 'agent', agent_manus_id,
    E'Welcome to **Hypeforce**.\n\nThis channel has 3 agents wired up. @-mention one to target it directly, or send a message with no @-mentions to brief everyone at once.');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== STORAGE BUCKETS ==============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('attachments', 'attachments', false),
  ('knowledge', 'knowledge', false),
  ('voice-samples', 'voice-samples', false)
ON CONFLICT (id) DO NOTHING;

-- avatars: anyone can read; users upload their own
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
CREATE POLICY "avatars user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars user update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- attachments: read for authenticated, write for own folder
CREATE POLICY "attachments read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments');
CREATE POLICY "attachments user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- knowledge: read for authenticated, write for own folder (admin gating on app layer)
CREATE POLICY "knowledge read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge');
CREATE POLICY "knowledge user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge' AND auth.uid()::text = (storage.foldername(name))[1]);

-- voice-samples: owner-only
CREATE POLICY "voice owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "voice owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);
