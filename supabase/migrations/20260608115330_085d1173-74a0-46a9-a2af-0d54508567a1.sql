ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'complete';

ALTER TABLE public.messages REPLICA IDENTITY FULL;