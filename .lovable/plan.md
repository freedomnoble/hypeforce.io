# /pretentious — Super-Admin Console

A single hidden admin app at `/pretentious` with top-nav contexts: **Dashboard**, **Users**, **Support**, **Landing CMS**, **Billing**. Glassmorphism on a dark "spider-web" background with random light wicks. Plus a `?` Help button in the workspace shell that opens a support flyout.

> Need from you before build: the email address(es) that should have super-admin access.

---

## 1. Access control

- New `public.super_admins` table seeded with the email(s) you provide. `is_super_admin(_user_id uuid)` SECURITY DEFINER helper joins to `auth.users.email`.
- `/pretentious` route is public-URL but gated client + server: redirects to `/auth` if signed out, to `/` if signed in but not a super-admin. Every admin server fn re-checks `is_super_admin` — URL secrecy is not the security boundary.

## 2. Database (new tables, all RLS-on, super-admin-only policies)

- `support_tickets` — name, email, message, page_url, user_id (nullable), status (open/in_progress/resolved), priority, assigned_to, created_at
- `support_ticket_attachments` — ticket_id, file_path, mime, size_bytes, kind (image|video)
- `support_ticket_messages` — ticket_id, author (admin|user), body, created_at (admin replies; user reply flow scoped out of v1)
- `landing_content` — single-row keyed JSONB document holding every editable field (hero headline/sub/CTA, eyebrow copy, each feature card, FAQ Q&A, pricing tiers + prices, plays-well-with, use cases, footer). Plus `theme_id` (FK → custom_themes or null = default), `hero_image_url`, `demo_video_url`.
- `subscriptions` (mock) — user_id, plan (founder|pro|team|none), interval (monthly|annual), status (active|paused|canceled|cancel_requested), amount_cents, started_at, current_period_end, cancel_requested_at, admin_note
- `pricing_config` — single-row: founder_price_monthly, pro_price_monthly, pro_price_annual, team_price_monthly, team_price_annual, discount_percent, founder_seats_remaining, founder_active (bool)
- `user_usage_limits` — user_id, lovable_gateway_paused (bool), monthly_message_cap (nullable int), updated_by, updated_at
- New storage buckets: `support-attachments` (private, signed URLs only).
- Triggers: `update_updated_at_column` on mutable tables. Backfill: insert one default row into `landing_content` and `pricing_config`.

All policies use `is_super_admin(auth.uid())`. `support_tickets` also allows INSERT from anon (for logged-out support submissions); SELECT remains super-admin-only.

## 3. Admin server functions (`src/lib/admin/*.functions.ts`)

All wrapped with `requireSupabaseAuth` + an `assertSuperAdmin(context)` guard.

- `listUsers({ search, sort, page })` → joins `auth.users` (via admin client) with aggregate counts of workspaces, channels, agents, and a derived `gateway_vs_byok` count from `agents.preferred_route` / `user_ai_connections`. Returns: email, display_name, created_at, last_sign_in_at, workspace_count, channel_count, agent_count, byok_provider_count, subscription summary. **No keys, no message contents.**
- `getUserDetail(user_id)` — same shape, plus per-workspace breakdown and usage limit row.
- `setUserSubscription`, `pauseSubscription`, `approveCancellation`, `messageUser` (writes a `support_ticket_messages` entry tagged as outbound admin DM — surfaced via email-style queue; actual email delivery scoped out, mock with logged record).
- `setUsageLimit({ user_id, monthly_message_cap, lovable_gateway_paused })`
- `deleteUser(user_id)` — calls `supabaseAdmin.auth.admin.deleteUser`; cascades via FKs.
- `listTickets`, `getTicket`, `replyTicket`, `setTicketStatus`, `getAttachmentSignedUrl`
- `getLandingContent`, `updateLandingContent`, `setLandingTheme`, `uploadLandingAsset` (returns signed upload URL into existing `avatars` or a new `landing` bucket — recommend new private bucket + public CDN URL pattern; let me know if you prefer `attachments`)
- `getPricingConfig`, `updatePricingConfig`
- `getDashboardStats({ window: 1|2|7|14|30 })` → new_users, paid_users, MRR, ARR, churn_rate (from `subscriptions.status='canceled'` in window ÷ active at start)
- `submitSupportTicket` (public — anon allowed, rate-limited by IP via simple in-table check)

## 4. Admin UI

Routes:
```
/pretentious                  → Dashboard
/pretentious/users            → user table + drawer
/pretentious/support          → ticket inbox + thread view
/pretentious/landing          → field-by-field CMS form, hero image + demo video upload, theme picker, pricing editor
/pretentious/billing          → subscriptions table (mock) with pause/approve-cancel/message actions
```

Top nav: glass pill bar fixed at top with five context buttons. Active section's panel slides in below. Mobile collapses to a sheet.

**Components built fresh** under `src/components/admin/`: `AdminShell`, `WebBackground` (canvas with web lines + sparkle/light-wick particles via `requestAnimationFrame`), `GlassPanel`, `StatCard`, `DataTable`, `UserDrawer`, `TicketThread`, `CMSField`, `ThemePicker`, `PricingEditor`. Reuse existing `liquid-glass` / `glass` classes for cohesion, add new admin tokens scoped under a `.admin-root` class so the look stays distinct from the marketing site.

Landing CMS approach: form is purely structured fields driven by a TS schema; landing page is refactored to read from `landing_content` via a public server fn called from its loader, with the file's current copy seeded as defaults so nothing changes visually until you edit.

## 5. Support flyout in workspace shell

- New `?` icon in `workspace-shell.tsx` left rail under the settings gear → opens a left-side `Sheet` containing: name, email, message, attachments (drag/drop or click).
- Client-side image compression with `browser-image-compression` (target ≤1600px, WebP, quality 0.82). Videos: hard cap 25MB; over that, show inline "Please share a link instead" message. No server transcoding.
- Submits via `submitSupportTicket` server fn; uploads attachments to `support-attachments` bucket; on success shows toast "We'll be in touch."

## 6. Landing wiring

- `src/routes/index.tsx` loader fetches `landing_content` + `pricing_config` via a public `getPublicLandingContent` server fn (admin-elevated read of safe columns).
- `landing-page.tsx` props-ified: every literal string becomes a content key. Theme: when `landing_content.theme_id` is set, the page wraps in `ThemeProvider` forcing that theme; otherwise falls back to user's local theme (today's behavior).
- Hero image + demo video swap to URLs from `landing_content`. Existing imported assets become defaults if URL is null.

## 7. Background "web with light wicks"

Canvas component drawing:
- 200–300 jittered nodes connected into a Delaunay-ish sparse web.
- Periodic "wicks": pick a random edge, animate a 0.4s bright travelling highlight along it with bloom. 1–2 per second, eased.
- Respects `prefers-reduced-motion` (static web only).
- Pure canvas, no extra dependency.

## Technical notes

- Subscriptions are mocked now; when Stripe is wired later, `subscriptions` columns map cleanly to Stripe objects and `messageUser`/`approveCancellation` become real actions.
- `auth.users` reads use `supabaseAdmin` inside server fns only; nothing leaks to the client beyond the safe DTO shape.
- Conversation contents (`messages` table) are never queried by admin code — only `count(*)` for usage metrics.
- Rate limit on public `submitSupportTicket`: max 5 tickets / hour / IP via a small `support_rate_limit` table.
- Cron-style churn calc done on demand in `getDashboardStats` — no pg_cron needed yet.

## Open items I'd like to confirm after you approve

1. The super-admin email(s) to seed.
2. Whether `messageUser` should actually email the user (would need Resend setup) or just store the message and surface it to them inside the app for v1. I'm assuming **in-app only for v1**.
