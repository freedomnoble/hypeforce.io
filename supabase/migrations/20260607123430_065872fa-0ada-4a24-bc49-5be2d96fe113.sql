
-- invite_links: single-row config
CREATE TABLE public.invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.invite_links TO service_role;
-- No anon/authenticated grants — token is secret; server fns use service role.

ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access" ON public.invite_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.invite_links (token, enabled)
VALUES (encode(gen_random_bytes(24), 'hex'), true);

-- profiles: comp + upsell flags
ALTER TABLE public.profiles
  ADD COLUMN is_comped boolean NOT NULL DEFAULT false,
  ADD COLUMN show_upsell boolean NOT NULL DEFAULT false,
  ADD COLUMN upsell_updated_at timestamptz;
