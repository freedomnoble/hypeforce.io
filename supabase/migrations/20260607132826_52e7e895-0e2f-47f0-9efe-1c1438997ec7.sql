
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_project_name text,
  ADD COLUMN IF NOT EXISTS onboarding_brand_doc_url text,
  ADD COLUMN IF NOT EXISTS onboarding_pending_invites jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Existing users (created before this migration) skip onboarding.
UPDATE public.profiles SET onboarding_step = 8 WHERE onboarding_step = 0 AND created_at < now();
