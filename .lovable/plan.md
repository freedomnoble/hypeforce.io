# A/B Landing Page Test

Add a second landing variant ("B") that reuses the existing landing page component (same styling/theme) but pulls different copy. Admin chooses traffic mode: A only, B only, or 50/50 split. Track signups per variant.

## What you'll see in the admin (/pretentious/landing)

- **Variant switcher** at the top: tabs for "Variant A" and "Variant B". The existing copy editor (hero, sections, FAQ, JSON arrays) edits whichever variant is selected.
- **Traffic mode** card:
  - Force A — every visitor sees A
  - Force B — every visitor sees B
  - A/B Test (50/50) — random assignment, sticky per visitor
- **Conversion stats** card: views, signups, and signup rate for A and B over the last 30 days, with a "reset counters" button.

Theme, hero image, demo video, provider avatars, pricing — all stay global (one set, shared by both variants).

## What the visitor experiences

- Identical look and feel. Same theme, same components, same hero art.
- B uses the NEPQ-style copy from your PDF/screenshot: question-led hero ("Doing the work of ten people — with a dozen AI tabs open?"), pain → vision → bridge → consequence → pricing → final CTA. Section order and counts match A so the existing component renders both cleanly.
- Assignment is sticky: a cookie remembers which variant a visitor saw, so refreshes don't re-roll.

## How conversions are counted

- A view is logged the first time a visitor lands (per variant, per day, deduped by the cookie).
- A signup is attributed to whichever variant cookie the new user had at signup time.
- Stats are simple counts: `views`, `signups`, `signups / views`.

## Technical details

**DB migration** (new tables, all with GRANTs + RLS):
- `landing_content` already has `id=1` (A). Add `id=2` row for B, seeded with NEPQ copy from the PDF.
- `landing_ab_config` (singleton row): `mode text check in ('a','b','split')`, `updated_at`.
- `landing_ab_events` (`id`, `variant char(1)`, `kind text check in ('view','signup')`, `visitor_id uuid`, `user_id uuid null`, `created_at`). Indexed on `(variant, kind, created_at)`.
- RLS: admin-only select; inserts via service role from server fns. Grants: `service_role` all; `authenticated` select only for admins via `has_role`.

**Server functions** (`src/lib/landing.functions.ts`):
- `getPublicLandingContent` extended to accept an optional `variant` arg and return the right row + the active mode. Public route loader calls it without args; route resolves variant from cookie.
- `assignLandingVariant` (POST, public): reads/sets `hf-landing-variant` cookie based on mode, returns `'a' | 'b'`. Logs a `view` event (deduped by cookie+day).
- Admin fns in `src/lib/admin.functions.ts`:
  - `getLandingContentAdmin({ variant })` / `updateLandingContent({ variant, ... })` — variant-aware.
  - `getLandingAbConfig` / `setLandingAbMode({ mode })`.
  - `getLandingAbStats({ days })` — returns `{ a: {views, signups}, b: {...} }`.
  - `resetLandingAbStats()`.

**Signup attribution**: in the onboarding bootstrap server fn (where the user row is first created), read the `hf-landing-variant` cookie and insert a `signup` event with the new `user_id`. No client changes needed.

**Routing** (`src/routes/index.tsx`):
- Loader calls `assignLandingVariant()` first, then `getPublicLandingContent({ variant })`. Same `<LandingPage />` component renders either copy — no new component file, no style duplication.

**Admin UI** (`src/routes/pretentious.landing.tsx`):
- Add `variantSelected` state ('a' | 'b') and refetch landing on change. All existing copy/JSON fields are unchanged but bound to the selected variant.
- Add two new GlassPanels: Traffic mode (3 radio buttons + Save) and Conversion stats (table with totals + reset).

**Seed copy for variant B** (from your PDF, applied to existing field keys):
- `hero_eyebrow`: "Stage 1 · Connect — are you here?"
- `hero_headline`: "Doing the work of ten people — with a dozen AI tabs open?"
- `hero_subhead`: "You're the founder, the marketer, the dev, and the support team. And your AI 'help' lives in scattered tabs that forget everything the moment you switch."
- `hero_cta_primary`: "Show me a better way"
- `hero_cta_secondary`: "See founder pricing"
- Section eyebrows/headlines re-keyed to NEPQ stages (Problem Awareness / Solution Awareness / Bridge / Consequence / Commitment) using the exact phrasing in the PDF table.
- `use_cases` JSON: 3 pain cards ("Let me paste the brief again…", "Twelve tabs, zero teamwork", "Context that vanishes").
- `features` JSON: kept as today (Hypeforce intro lands at the "Bridge" section).
- Pricing/FAQ/footer unchanged.

## Out of scope
- No new design, theme, or layout work — B uses the exact same component tree.
- No experiment framework (GrowthBook/PostHog) — counters live in our own table so you can read them without leaving the admin.
- No multivariate or >2 variants for now (schema leaves room to add C later by widening the check constraint).
