# Finish /pretentious work items

Four items, all backend wiring + one inbox UI. No schema changes — every table already exists.

## 1. Wire all Landing CMS fields to the public homepage

Today `getPublicLandingContent` returns the row but only `hero_image_url` / `demo_video_url` are read in `routes/index.tsx`. The 20+ copy keys defined in `pretentious.landing.tsx` (`FIELDS`) plus list-shaped content (features, FAQ, use cases, plays-with logos, pricing tiers, footer) sit in `landing_content.content` jsonb and never reach `LandingPage`.

Steps:

- **Loader**: `routes/index.tsx` passes the whole `landing_content` row (`content`, `theme_key`, `hero_image_url`, `demo_video_url`) plus `pricing_config` row down to `<LandingPage>`. Fall back to `null` on error (loader is SSR — keep the try/catch).
- **`LandingPage` props**: accept `content?: Record<string, any>`, `pricing?: PricingConfig`, `themeKey?: string | null`, in addition to current `heroUrl` / `videoUrl`.
- **Copy fallback helper**: `const t = (key: string, fallback: string) => content?.[key]?.trim() || fallback;` — used everywhere a hardcoded string lives today. Covers all scalar keys in `FIELDS` (hero, eyebrows, headlines, subheads, CTA labels, footnote, pricing/faq/footer/demo/how-it-works headings).
- **List-shaped content**: extend `FIELDS` in `pretentious.landing.tsx` with three repeater editors (JSON-array textareas are fine for v1, keep it simple) writing into `content`:
  - `features[]` → `{ icon, title, desc }` (icon names mapped to lucide on the public side via a small switch).
  - `use_cases[]` → `{ title, desc }`.
  - `faqs[]` → `{ q, a }`.
  - `plays_with[]` → `{ label, logo_url }`.
  - `footer_links[]` → `{ label, href }`.
  On the public page, render `t(...)` or the hardcoded list when the CMS array is absent/empty.
- **Pricing tiers**: drive the founder block from `pricing.founder_price_monthly`, `pricing.founder_seats_remaining`, `pricing.founder_active`, `pricing.discount_percent`. Hide pricing CTA when `founder_active` is false.
- **Cache**: keep `useQuery({ queryKey: ["admin-landing"] })` invalidation in the admin save flow; the public page is loader-fed so a save → router.invalidate on the admin side after publishing is enough. No new cache plumbing needed.

## 2. Apply `landing_content.theme_key` to the public landing page

The CMS already saves `theme_key`, and `ThemeProvider` exposes `setTheme(id)`. The public page just never calls it.

- Inside `LandingPage`, add a `useTheme()` + `useEffect` that calls `setTheme(themeKey)` once on mount when `themeKey` is set and differs from `"default"`. Skip the call when `themeKey == null` so the user's own saved theme wins for signed-in visitors.
- Restore on unmount: capture the current theme before override and call `setTheme(previous)` in the cleanup. This way the landing override doesn't leak into `/login`, `/auth`, etc.
- Validate against the existing `THEMES` list in `theme-provider.tsx`; if `theme_key` isn't a known id, ignore it (prevents a typo bricking the homepage).
- Do NOT persist to localStorage for the override — `ThemeProvider.setTheme` already writes to localStorage, so route the override through a new `previewTheme(id)` helper on the provider that updates state + applies CSS variables without touching storage. Tiny addition; one new function.

## 3. In-app inbox for `admin_user_messages`

Messages already insert with RLS allowing `recipient_user_id = auth.uid()` SELECT and UPDATE. Need: server fns + a small UI surface inside the workspace shell.

- **Server fns** in a new `src/lib/inbox.functions.ts`, all `requireSupabaseAuth`:
  - `listMyMessages()` → returns rows ordered by `created_at desc`, joins `sender_user_id → profiles` for display name.
  - `getUnreadCount()` → `count` of `read_at is null`.
  - `markMessageRead({ id })` → updates `read_at = now()` where `recipient_user_id = auth.uid()` (RLS already scoped).
- **UI** in `src/components/hypeforce/admin-inbox-flyout.tsx`, mounted from `workspace-shell.tsx` next to the existing support flyout:
  - Bell icon button with unread badge (uses `getUnreadCount`, refetched every 60s + on focus).
  - Popover lists messages (subject, body, sender, relative time, unread dot). Clicking an unread message calls `markMessageRead` and invalidates both queries.
  - Empty state: "No messages from the team yet."
- **Realtime (optional, keep scope small)**: `supabase.channel('admin_user_messages').on('postgres_changes', { event: 'INSERT', filter: \`recipient_user_id=eq.${userId}\` }, ...)` to bump the unread count without polling. Drop if it complicates the diff.

## 4. End-to-end smoke test of `/pretentious` in the browser

Sequential preview pass using `browser--view_preview` + `browser--act`, signed in as a super-admin email. Capture screenshots on each step.

1. `/pretentious` (Dashboard) — page renders, all stat cards populated.
2. `/pretentious/users` — table loads, search by email returns results, open user drawer, toggle pause, save subscription, send a message, close drawer.
3. `/pretentious/support` — open a ticket, post a reply, verify it appears.
4. `/pretentious/landing` — edit hero eyebrow + a feature card, switch theme to `spider-noir`, upload no files, save. Open `/` in a second view and confirm the new copy + theme are live (validates items #1 and #2 above).
5. `/pretentious/billing` — verify subscriptions table reads from `subscriptions` (or current mock data), pending cancellations section renders.
6. Sign in as the user who received the message in step 2; open the inbox flyout (validates item #3); confirm unread → read transition.
7. Sign out flow returns to `/login`.

Any failure becomes a follow-up commit before declaring done. Capture findings as inline notes on the task tracker.

## Technical notes

- No new DB migrations. `landing_content`, `admin_user_messages`, `pricing_config`, `custom_themes` all exist with correct RLS.
- All new reads/writes go through `createServerFn` — no edge functions.
- `getPublicLandingContent` already uses `supabaseAdmin` and the loader is in a public route, so SSR will keep working without auth.
- Keep `LandingPage` backwards-compatible (props all optional) so `errorComponent` / `notFoundComponent` fallbacks still render.
- The list editors in the CMS can ship as raw JSON textareas with a Zod parse + inline error — schema-form polish is out of scope.
