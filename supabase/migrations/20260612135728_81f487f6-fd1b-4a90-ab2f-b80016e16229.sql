CREATE OR REPLACE FUNCTION public.can_send_message(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Comped users always
    EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_comped = true)
    -- OR has any active-ish subscription (live or sandbox)
    OR public.has_active_subscription(_user_id, 'live')
    OR public.has_active_subscription(_user_id, 'sandbox')
    -- OR on an active trial that hasn't been cancel-requested-and-expired
    OR public.is_on_trial(_user_id)
    -- OR never had a trial (free preview users)
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id AND trial_started_at IS NOT NULL
    );
$$;

DROP POLICY IF EXISTS "members send messages" ON public.messages;
CREATE POLICY "members send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND author_user_id = auth.uid()
    AND author_type = 'user'::author_type
    AND public.can_send_message(auth.uid())
  );