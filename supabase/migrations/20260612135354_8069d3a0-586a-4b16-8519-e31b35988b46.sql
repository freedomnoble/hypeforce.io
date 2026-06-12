-- Trial columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_cancel_requested_at timestamptz;

-- Add kind column to invite_links
ALTER TABLE public.invite_links
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'comp';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invite_links_kind_check'
  ) THEN
    ALTER TABLE public.invite_links
      ADD CONSTRAINT invite_links_kind_check CHECK (kind IN ('comp','trial'));
  END IF;
END $$;

-- Seed trial link row if missing
INSERT INTO public.invite_links (token, enabled, kind)
SELECT encode(gen_random_bytes(24), 'hex'), false, 'trial'
WHERE NOT EXISTS (SELECT 1 FROM public.invite_links WHERE kind = 'trial');

-- Feature flag for landing page free trial CTA
INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('free_trial_landing', false, 'Show 5-day free trial CTA on landing page')
ON CONFLICT (key) DO NOTHING;

-- Helper: is_on_trial
CREATE OR REPLACE FUNCTION public.is_on_trial(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at > now()
      AND trial_cancel_requested_at IS NULL
  );
$$;