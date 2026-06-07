ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_token uuid,
  ADD COLUMN IF NOT EXISTS verification_token_sent_at timestamptz;

-- Grandfather existing users
UPDATE public.profiles SET email_verified_at = now() WHERE email_verified_at IS NULL;

CREATE OR REPLACE FUNCTION public.is_email_verified(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND email_verified_at IS NOT NULL
  )
$$;