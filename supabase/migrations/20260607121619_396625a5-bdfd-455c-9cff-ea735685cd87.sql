CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON public.feature_flags FOR SELECT
  USING (true);

CREATE POLICY "Super admins can insert feature flags"
  ON public.feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update feature flags"
  ON public.feature_flags FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete feature flags"
  ON public.feature_flags FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER feature_flags_set_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('themes_enabled', true, 'When off, only the default Blueprint theme is available to users.'),
  ('custom_themes_enabled', true, 'When off, users cannot create or use AI-generated custom themes.')
ON CONFLICT (key) DO NOTHING;