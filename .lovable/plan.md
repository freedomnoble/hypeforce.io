
# Hypeforce Onboarding Flow

A 7-step, resumable, mobile-first flow that runs identically on desktop. Replaces the current "/login → /app gateway" jump for new users.

## 1. Database

Migration adding onboarding state to `profiles`:
- `onboarding_step smallint not null default 0` (0 = not started, 1–7 in progress, 8 = done)
- `onboarding_project_name text`
- `onboarding_brand_doc_url text`

No new tables — pending invites use the existing `workspace_members` flow via an `onboarding_pending_invites` JSON column on profiles (array of `{ name, email }`), so re-entering step 5 shows what they typed.

Trigger note: `handle_new_user` already seeds a workspace, 4 agents (Manus / ChatGPT / Claude / Gemini), and 3 starter channels (`launch-plan`, `market-research`, `brand-voice`, `build-log`). The onboarding UI **reads** these — it doesn't recreate them. Step 7's "3 pre-made channels" surfaces the existing seeds; the optional 4th name field appends a new one.

## 2. Routing

New layout + leaves under `src/routes/_auth.onboarding.*`:

```
_auth.onboarding.tsx           layout (progress bar, blueprint bg, ClientOnly)
_auth.onboarding.index.tsx     redirects to current step
_auth.onboarding.team.tsx      step 2 — your name
_auth.onboarding.project.tsx   step 3 — project + brand doc
_auth.onboarding.features.tsx  step 4 — features + subscribe (skipped if comped)
_auth.onboarding.invites.tsx   step 5 — invite teammates
_auth.onboarding.tour.tsx      step 6 — workspace/channels tour
_auth.onboarding.channel.tsx   step 7 — first channel
```

Step 1 (`/welcome`) is **public** (not under `_auth`) so signed-out visitors see the hero. Buttons: "Create profile" → `/login?tab=signup&next=/onboarding`; "Log in" → `/login`.

After signup completes, `/app` gateway checks `profile.onboarding_step` and routes:
- `< 8` → `/onboarding` (resumes at saved step)
- `= 8` → existing workspace/channel resolution
- Pending invite token redemption (existing) runs first; comped users get `onboarding_step` jumped past 4 automatically.

`index.tsx` (`/`) — landing page logic unchanged for marketing visitors; "Get started" CTA now points to `/welcome`.

## 3. Server functions (`src/lib/onboarding.functions.ts`)

All `requireSupabaseAuth`; all idempotent:
- `getOnboardingState` → `{ step, project_name, brand_doc_url, pending_invites, display_name, is_comped, has_active_subscription }`
- `setDisplayName({ name })` → updates `profiles.display_name` + auth user metadata
- `setProject({ name })` → writes `onboarding_project_name`; also sets it as the workspace name (replacing default "The Atelier")
- `setBrandDoc({ file })` — uploads to existing `knowledge` bucket, stores URL
- `savePendingInvites({ invites })` → stores array
- `sendInvites()` → sends magic-link invites via `supabaseAdmin.auth.admin.inviteUserByEmail` for each pending row, adds them as `workspace_members` with role `member` on accept (existing flow)
- `createFirstChannel({ name })` → inserts channel; returns id
- `advanceStep({ to })` → bumps `onboarding_step` (only forward)
- `completeOnboarding()` → sets step = 8, returns landing `{ workspaceId, channelId }`

## 4. UI components

Shared `src/components/onboarding/`:
- `OnboardingLayout` — blueprint grid background (reuse `InfiniteGridBg`), centered glass card, progress dots (7 segments), back arrow (no skip).
- `StepShell` — title, subtitle slot, content, sticky CTA.
- `AgentRoster` — renders the 4 seeded agents with avatars; step 2 stacks a "you" slot below.
- `FeaturesList` — 5–6 plain-language bullets (multi-agent channels, @mention routing, pinned docs for shared context, DMs with agents, knowledge base, brand voice). No jargon.
- `DeviceTourCarousel` — uses `useIsMobile`; swipes through 3 generated screenshots (mobile vs desktop set). Images live in `src/assets/onboarding/`.
- `ChannelPicker` — lists the 3 seeded channels (read-only checkboxes, all on) + 1 empty name input; CTA label flips between "I'll start with these" and "Create channel".

## 5. Step 4 — Paddle subscribe

- If `is_comped` OR active subscription → **skip entirely** (server fn bumps step from 3 → 5 on entry).
- Otherwise: show features list, "$9/mo" with "$19" struck through, **Subscribe** button opens existing `usePaddleCheckout` with the existing `pro_monthly` price (`customData: { userId, onboarding: "1" }`). Subhead: "Cancel anytime. Your data is yours, always."
- Paddle `successUrl` = `/onboarding/features?checkout=success` → shows a brief "You're in!" confirmation (3s) then auto-advances to step 5. Webhook (already wired) creates the subscription row in the background; UI doesn't block on it.
- "Maybe later" link is **not shown** — subscription is required for non-comped users per the brief.

## 6. Step 7 → workspace + coffee easter egg

- `completeOnboarding` returns the first seeded channel id; navigate to `/w/$workspaceId/c/$channelId`.
- Add a small **coffee-pot icon** fixed bottom-right of the channel panel inside `workspace-shell.tsx`. Soft pulsing glow (CSS animation). Click → opens new `<CoffeeUpsellDialog />`: "Get Hyped — try our coffee" with name/address form; submits to a new `support_tickets` row with category `coffee_sample` (reuses existing support infra, no new table). Dismissible; visibility persists via `localStorage` (always available, just stops glowing after first open).

## 7. Technical notes

- Email-verified gate: `_auth.onboarding.tsx` layout checks `supabase.auth.getUser()`; if unverified, redirect to a "check your email" interstitial (reuses existing pattern from `/login`).
- `handle_new_user` trigger already runs on signup, so `/onboarding/team` always has a workspace + agents to display.
- Progress persistence: every "Continue" calls `advanceStep` before navigating, so refresh/return resumes correctly.
- Mobile-first layout: max-width `420px` card on all viewports, centered; same component tree for desktop (no separate routes).
- No marketing copy mentions "free invite" — comped path is silent.
- Existing landing page, pricing page, and `/login` are untouched except the CTA target on `/`.

```text
/welcome (public)
   │  Create profile
   ▼
/login?tab=signup&next=/onboarding ──► email confirm ──► /app
                                                          │
                                                          ▼
                                              /onboarding/[resume step]
                                              team → project → features
                                                ├─(comped)→ invites
                                                └─(paid)──► invites → tour → channel → /w/$ws/c/$ch ☕
```

