
-- 1. Rewrite the signup seeder to use the new 3-agent default roster.
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
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

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

-- 2. Backfill existing workspaces: drop old Manus + Claude default agents.
DELETE FROM public.messages
 WHERE author_agent_id IN (SELECT id FROM public.agents WHERE handle IN ('manus','claude'));

DELETE FROM public.channel_members
 WHERE agent_id IN (SELECT id FROM public.agents WHERE handle IN ('manus','claude'));

DELETE FROM public.dm_participants
 WHERE agent_id IN (SELECT id FROM public.agents WHERE handle IN ('manus','claude'));

DELETE FROM public.agents WHERE handle IN ('manus','claude');

-- 3. Add Nano Banana to every existing workspace that's missing it,
--    and join it to that workspace's first channel.
WITH inserted AS (
  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  SELECT w.id, 'Nano Banana', 'nano', 'google', 'google/gemini-2.5-flash-image',
         'Image generator — @nano to make pictures',
         'You are Nano Banana, an image generation agent. When @-mentioned, generate an image that matches the request.',
         '/avatars/nano.png'
    FROM public.workspaces w
   WHERE NOT EXISTS (
     SELECT 1 FROM public.agents a
      WHERE a.workspace_id = w.id AND a.handle = 'nano'
   )
  RETURNING id, workspace_id
)
INSERT INTO public.channel_members (channel_id, member_type, agent_id)
SELECT c.id, 'agent', i.id
  FROM inserted i
  JOIN LATERAL (
    SELECT id FROM public.channels
     WHERE workspace_id = i.workspace_id
     ORDER BY is_pinned DESC NULLS LAST, created_at ASC
     LIMIT 1
  ) c ON TRUE
 WHERE NOT EXISTS (
   SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = c.id AND cm.agent_id = i.id
 );
