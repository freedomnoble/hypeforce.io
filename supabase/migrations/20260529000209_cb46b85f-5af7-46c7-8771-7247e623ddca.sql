ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS brand_voice text;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS content_text text;