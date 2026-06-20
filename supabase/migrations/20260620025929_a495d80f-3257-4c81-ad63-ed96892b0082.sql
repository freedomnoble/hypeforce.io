
-- 1. Allow landing_content id=2 (variant B)
ALTER TABLE public.landing_content DROP CONSTRAINT IF EXISTS landing_content_id_check;
ALTER TABLE public.landing_content ADD CONSTRAINT landing_content_id_check CHECK (id IN (1, 2));

-- Seed variant B with NEPQ copy. Theme/hero/video/avatars stay null so the
-- public loader falls back to variant A's globals (we'll merge in code).
INSERT INTO public.landing_content (id, content)
VALUES (
  2,
  jsonb_build_object(
    'hero_eyebrow', 'Stage 1 · Connect — are you here?',
    'hero_headline', 'Doing the work of ten people — with a dozen AI tabs open?',
    'hero_subhead', 'You''re the founder, the marketer, the dev, and the support team. And your AI "help" lives in scattered tabs that forget everything the moment you switch.',
    'hero_cta_primary', 'Show me a better way',
    'hero_cta_secondary', 'See founder pricing',
    'hero_footnote', 'Cancel anytime. Own your data.',
    'use_cases_eyebrow', 'Stage 2 · Problem awareness',
    'use_cases_headline', 'How much of your day disappears into re-explaining yourself?',
    'use_cases_subhead', 'The reality of solo work.',
    'use_cases', jsonb_build_array(
      jsonb_build_object('icon', 'MessageSquare', 'title', '"Let me paste the brief again…"', 'desc', 'Every new tool starts from zero. You re-explain your brand, your audience, your roadmap every time you crack a new chat.'),
      jsonb_build_object('icon', 'Users', 'title', 'Twelve tabs, zero teamwork', 'desc', 'ChatGPT, Claude, Gemini live in separate windows. They don''t see each other''s work and they don''t learn from it.'),
      jsonb_build_object('icon', 'Database', 'title', 'Context that vanishes', 'desc', 'Close the tab, lose the thread. What would the ten-person team you can''t afford already have remembered?')
    ),
    'features_eyebrow', 'Stage 3 · Solution awareness',
    'features_headline', 'What if your AI tools worked like a team — in one room, with one shared memory?',
    'features_subhead', 'Picture a single workspace where every model already knows the brief before it replies.',
    'features', jsonb_build_array(
      jsonb_build_object('icon', 'MessageSquare', 'title', 'One brief, every agent', 'desc', 'Pin your context once. ChatGPT, Claude, Gemini and Manus all read the same brief before they answer.'),
      jsonb_build_object('icon', 'Bot', 'title', 'The right model, on demand', 'desc', '@-mention for surgical edits, @-everyone for the team — or let the whole room weigh in at once.'),
      jsonb_build_object('icon', 'Workflow', 'title', 'Context that never resets', 'desc', 'Channel memory and pinned docs persist. No re-explaining, ever. Pick up exactly where you left off.')
    ),
    'how_eyebrow', 'Stage 4 · The bridge',
    'how_headline', 'That''s exactly why we built Hypeforce.',
    'demo_eyebrow', 'See the workspace',
    'demo_headline', 'A Slack-style room where humans + AI agents ship together.',
    'plays_with_label', 'Day-one roster — already in the room',
    'pricing_headline', 'What''s another month of doing it all alone actually costing you?',
    'pricing_subhead', 'Every solo week is a week you''re shipping slower than a funded team. The first 1,000 founders lock in $9/mo for life — before it goes to $19.',
    'faq_headline', 'Still on the fence?',
    'footer_cta_headline', 'Ready to stop working alone?',
    'footer_cta_subhead', 'Claim one of the 1,000 founder seats and lock in $9/mo for life. It takes about a minute — no card pressure, 5-day free trial.',
    'newsletter_eyebrow', 'The weekly drop',
    'newsletter_headline', 'One email. The plays that actually worked this week.',
    'newsletter_subhead', 'No fluff. No "10 ChatGPT prompts." Just the founder workflows we shipped — and the ones that bombed.',
    'newsletter_cta', 'Send it to me',
    'newsletter_success', 'You''re in. Watch your inbox.'
  )
)
ON CONFLICT (id) DO NOTHING;

-- 2. Traffic-mode config (singleton row id=1)
CREATE TABLE public.landing_ab_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'a' CHECK (mode IN ('a','b','split')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.landing_ab_config TO anon, authenticated;
GRANT ALL ON public.landing_ab_config TO service_role;

ALTER TABLE public.landing_ab_config ENABLE ROW LEVEL SECURITY;

-- Public can read the mode (the loader needs it during SSR; it only reveals
-- which variant is live, not who saw what).
CREATE POLICY "anyone reads ab config" ON public.landing_ab_config
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admins write ab config" ON public.landing_ab_config
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.landing_ab_config (id, mode) VALUES (1, 'a') ON CONFLICT DO NOTHING;

CREATE TRIGGER trg_landing_ab_config_updated
  BEFORE UPDATE ON public.landing_ab_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. View + signup events
CREATE TABLE public.landing_ab_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant char(1) NOT NULL CHECK (variant IN ('a','b')),
  kind text NOT NULL CHECK (kind IN ('view','signup')),
  visitor_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one signup row per (user, variant) — keeps bootstrap idempotent.
CREATE UNIQUE INDEX landing_ab_events_signup_user_uniq
  ON public.landing_ab_events (user_id, variant)
  WHERE kind = 'signup';

CREATE INDEX landing_ab_events_lookup
  ON public.landing_ab_events (variant, kind, created_at DESC);

GRANT SELECT ON public.landing_ab_events TO authenticated;
GRANT ALL ON public.landing_ab_events TO service_role;

ALTER TABLE public.landing_ab_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read ab events" ON public.landing_ab_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
