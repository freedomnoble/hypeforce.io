
CREATE OR REPLACE FUNCTION public.get_agent_router_context(
  p_workspace_id uuid,
  p_channel_id uuid,
  p_dm_id uuid,
  p_agent_ids uuid[],
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Validate channel/dm belongs to the workspace
  IF p_channel_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.channels WHERE id = p_channel_id AND workspace_id = p_workspace_id
    ) THEN
      RAISE EXCEPTION 'channel_workspace_mismatch';
    END IF;
  END IF;
  IF p_dm_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.direct_messages WHERE id = p_dm_id AND workspace_id = p_workspace_id
    ) THEN
      RAISE EXCEPTION 'dm_workspace_mismatch';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'agents', COALESCE((
      SELECT jsonb_agg(to_jsonb(a)) FROM public.agents a WHERE a.id = ANY(p_agent_ids)
    ), '[]'::jsonb),
    'overrides', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'agent_id', o.agent_id,
        'display_name', o.display_name,
        'role', o.role,
        'personality', o.personality
      ))
      FROM public.channel_agent_overrides o
      WHERE p_channel_id IS NOT NULL
        AND o.channel_id = p_channel_id
        AND o.agent_id = ANY(p_agent_ids)
    ), '[]'::jsonb),
    'counters', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('agent_id', c.agent_id, 'count', c.count))
      FROM public.agent_reply_counters c
      WHERE p_channel_id IS NOT NULL
        AND c.channel_id = p_channel_id
        AND c.agent_id = ANY(p_agent_ids)
    ), '[]'::jsonb),
    'recent_messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'content', m.content,
        'author_type', m.author_type,
        'author_agent_id', m.author_agent_id,
        'author_user_id', m.author_user_id,
        'created_at', m.created_at
      ) ORDER BY m.created_at DESC)
      FROM (
        SELECT *
        FROM public.messages
        WHERE (p_channel_id IS NOT NULL AND channel_id = p_channel_id)
           OR (p_channel_id IS NULL AND p_dm_id IS NOT NULL AND dm_id = p_dm_id)
        ORDER BY created_at DESC
        LIMIT 10
      ) m
    ), '[]'::jsonb),
    'brand_voice', (SELECT brand_voice FROM public.workspaces WHERE id = p_workspace_id),
    'kb', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('title', k.title, 'body', k.body))
      FROM (
        SELECT title, body FROM public.knowledge_base
        WHERE workspace_id = p_workspace_id LIMIT 5
      ) k
    ), '[]'::jsonb),
    'pinned', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('filename', f.filename, 'content_text', f.content_text))
      FROM (
        SELECT filename, content_text FROM public.files
        WHERE p_channel_id IS NOT NULL
          AND channel_id = p_channel_id
          AND is_pinned = true
        LIMIT 10
      ) f
    ), '[]'::jsonb),
    'memos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'title', mm.title, 'body', mm.body, 'tags', mm.tags,
        'created_at', mm.created_at, 'author_type', mm.author_type,
        'author_user_id', mm.author_user_id, 'author_agent_id', mm.author_agent_id
      ) ORDER BY mm.created_at ASC)
      FROM (
        SELECT * FROM public.channel_memos
        WHERE p_channel_id IS NOT NULL AND channel_id = p_channel_id
        ORDER BY created_at DESC LIMIT 15
      ) mm
    ), '[]'::jsonb),
    'ws_agents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'handle', a.handle,
        'description', a.description, 'system_prompt', a.system_prompt
      ))
      FROM public.agents a WHERE a.workspace_id = p_workspace_id
    ), '[]'::jsonb),
    'ws_members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', wm.user_id,
        'role', wm.role,
        'display_name', COALESCE(p.display_name, 'Member')
      ))
      FROM public.workspace_members wm
      LEFT JOIN public.profiles p ON p.id = wm.user_id
      WHERE wm.workspace_id = p_workspace_id
    ), '[]'::jsonb),
    'byok', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'provider', c.provider,
        'encrypted_key', c.encrypted_key,
        'status', c.status
      ))
      FROM public.user_ai_connections c
      WHERE c.user_id = p_user_id AND c.status = 'active'
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_agent_router_context(uuid, uuid, uuid, uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agent_router_context(uuid, uuid, uuid, uuid[], uuid) TO service_role;
