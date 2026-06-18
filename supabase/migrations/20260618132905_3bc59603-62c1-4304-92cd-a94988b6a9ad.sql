CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_workspace_id UUID;
  launch_channel_id UUID;
  brand_channel_id UUID;
  research_channel_id UUID;
  build_channel_id UUID;
  agent_chatgpt_id UUID;
  agent_gemini_id UUID;
  agent_nano_id UUID;
  ws_slug TEXT;
  signup_credits INTEGER;
  provider_avatars JSONB;
  openai_avatar TEXT;
  google_avatar TEXT;
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

  SELECT lc.provider_avatars INTO provider_avatars
  FROM public.landing_content lc WHERE lc.id = 1;
  provider_avatars := COALESCE(provider_avatars, '{}'::jsonb);
  openai_avatar := COALESCE(NULLIF(provider_avatars->>'openai', ''), '/avatars/chatgpt.png');
  google_avatar := COALESCE(NULLIF(provider_avatars->>'google', ''), '/avatars/gemini.png');

  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  VALUES (new_workspace_id, 'ChatGPT', 'chatgpt', 'openai', 'openai/gpt-5-mini', 'Generalist & code copilot',
          'You are ChatGPT, a friendly generalist and code copilot. Be helpful, accurate, and clear.', openai_avatar)
  RETURNING id INTO agent_chatgpt_id;

  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  VALUES (new_workspace_id, 'Gemini', 'gemini', 'google', 'google/gemini-3-flash-preview', 'Fast multimodal assistant',
          'You are Gemini, a fast multimodal assistant. Be quick, structured, and friendly.', google_avatar)
  RETURNING id INTO agent_gemini_id;

  INSERT INTO public.agents (workspace_id, name, handle, provider, model, description, system_prompt, avatar_url)
  VALUES (new_workspace_id, 'Nano Banana', 'nano', 'google', 'google/gemini-2.5-flash-image', 'Image generator — @nano to make pictures',
          'You are Nano Banana, an image generation agent. When @-mentioned, generate an image that matches the request.', '/avatars/nano.png')
  RETURNING id INTO agent_nano_id;

  INSERT INTO public.channels (workspace_id, name, topic, is_pinned, created_by)
  VALUES (new_workspace_id, 'launch-plan', 'Q3 launch sequence — agents collaborating on GTM', true, NEW.id)
  RETURNING id INTO launch_channel_id;

  INSERT INTO public.channels (workspace_id, name, topic, created_by)
  VALUES (new_workspace_id, 'market-research', 'Competitive landscape and trends', NEW.id)
  RETURNING id INTO research_channel_id;

  INSERT INTO public.channels (workspace_id, name, topic, created_by)
  VALUES (new_workspace_id, 'brand-voice', 'Tone, voice, and copy guidelines', NEW.id)
  RETURNING id INTO brand_channel_id;

  INSERT INTO public.channels (workspace_id, name, topic, created_by)
  VALUES (new_workspace_id, 'build-log', 'Daily build notes from the team', NEW.id)
  RETURNING id INTO build_channel_id;

  INSERT INTO public.channel_members (channel_id, member_type, user_id)
  VALUES
    (launch_channel_id,   'user', NEW.id),
    (research_channel_id, 'user', NEW.id),
    (brand_channel_id,    'user', NEW.id),
    (build_channel_id,    'user', NEW.id);

  INSERT INTO public.channel_members (channel_id, member_type, agent_id)
  VALUES
    (launch_channel_id,   'agent', agent_chatgpt_id),
    (launch_channel_id,   'agent', agent_gemini_id),
    (launch_channel_id,   'agent', agent_nano_id),
    (research_channel_id, 'agent', agent_chatgpt_id),
    (research_channel_id, 'agent', agent_gemini_id),
    (research_channel_id, 'agent', agent_nano_id),
    (brand_channel_id,    'agent', agent_chatgpt_id),
    (brand_channel_id,    'agent', agent_gemini_id),
    (brand_channel_id,    'agent', agent_nano_id),
    (build_channel_id,    'agent', agent_chatgpt_id),
    (build_channel_id,    'agent', agent_gemini_id),
    (build_channel_id,    'agent', agent_nano_id);

  INSERT INTO public.messages (workspace_id, channel_id, author_type, author_agent_id, content)
  VALUES (new_workspace_id, launch_channel_id, 'agent', agent_chatgpt_id,
    E'Welcome to **Hypeforce**.\n\nThis channel has 3 agents: @chatgpt, @gemini, and @nano (image generator). @-mention one to target it, or send a message with no @-mentions to brief everyone at once.');

  RETURN NEW;
END;
$function$;