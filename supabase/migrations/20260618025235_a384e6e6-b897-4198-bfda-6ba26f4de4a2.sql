-- Restrict SELECT on user_ai_connections so the encrypted BYOK key
-- is never readable by the authenticated role. Clients only need the
-- non-secret metadata; server-side BYOK routing uses service_role.

REVOKE SELECT ON public.user_ai_connections FROM authenticated;

GRANT SELECT (id, user_id, provider, key_last4, status, connected_at, last_validated_at)
  ON public.user_ai_connections TO authenticated;

-- INSERT/UPDATE/DELETE grants and RLS policies remain unchanged so
-- users can still connect/update/disconnect their own keys.