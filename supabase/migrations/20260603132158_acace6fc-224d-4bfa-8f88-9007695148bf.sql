CREATE TABLE public.custom_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT,
  tokens JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_themes TO authenticated;
GRANT ALL ON public.custom_themes TO service_role;

ALTER TABLE public.custom_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own custom themes"
ON public.custom_themes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users insert own custom themes"
ON public.custom_themes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own custom themes"
ON public.custom_themes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users delete own custom themes"
ON public.custom_themes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_custom_themes_user_id ON public.custom_themes(user_id);