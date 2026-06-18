ALTER TABLE public.landing_content
  ADD COLUMN IF NOT EXISTS provider_avatars jsonb NOT NULL DEFAULT '{}'::jsonb;