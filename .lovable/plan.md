## Goal

You hit glitching right after submitting the Create Profile form on `/welcome`. The session replay shows the app bouncing between `/app` and `/login` ("This page didn't load") and the console throws repeated `TypeError: Importing a module script failed` errors. I want to reproduce it end‑to‑end in the live preview, identify the exact failure, then fix it.

## Likely causes (ranked)

1. **Chunk-load failure on a lazy import** (`InfiniteGridBg` is `lazy()`‑imported in `welcome.tsx`, `login.tsx`, and the onboarding layout). When a lazy chunk 404s, React Suspense throws and — because there's no `errorComponent` on `/welcome`, `/login`, or `/app` — the page renders blank/"didn't load". TanStack then re-evaluates `beforeLoad` on the next navigation and we pinball between routes.
2. **Session race after signup** — `welcome.tsx` calls `supabase.auth.signUp(...)`, then immediately `navigate("/app")`. `/app` reads `getSession()`; if the persisted session hasn't been flushed to `localStorage` yet, it sees "no session" and redirects to `/login`. `/login`'s `beforeLoad` then sees the session (now flushed) and redirects back to `/app` → loop.
3. **Onboarding redirect race** — `/app` checks `profiles.onboarding_step` via the browser supabase client. If RLS rejects (e.g. profile row not yet created by the `handle_new_user` trigger), the try/catch swallows it and falls through to a workspace query that also fails, surfacing as an error page.

## Plan

### Step 1 — Reproduce in the browser
- Open `/welcome` in the preview, sign up with a fresh email, and capture:
  - Console errors (which chunk URL failed)
  - Network tab (which `/_build/assets/*.js` returned 404)
  - The final URL after the loop settles
- Confirm whether the loop happens before or after the lazy `InfiniteGridBg` chunk fails.

### Step 2 — Fix root cause based on what we see
Depending on findings, apply one or more of:

- **(A) Make lazy backgrounds non‑fatal.** Wrap the `<ClientOnly>` + `lazy(InfiniteGridBg)` in an error boundary that renders `null` on failure, so a missing chunk never blanks the page. Apply on `welcome.tsx`, `login.tsx`, and `OnboardingLayout.tsx`.
- **(B) Add `errorComponent` + `notFoundComponent` to `/welcome`, `/login`, `/app`, and `_auth.onboarding.*`.** Currently none of them define one, so any thrown chunk/load error shows the generic "This page didn't load". The boundary should offer a Retry that calls `router.invalidate()`.
- **(C) Stabilize the post‑signup handoff in `welcome.tsx`.**
  - After `signUp`, instead of navigating immediately, await one tick of `supabase.auth.getSession()` (or `onAuthStateChange("SIGNED_IN")`) so the session is persisted before we leave the page.
  - Navigate straight to `/onboarding` (not `/app`) since we already know this is a brand‑new user — skips the Gateway round‑trip and the loop window entirely.
- **(D) Harden `/app` Gateway.** If `getSession()` returns null, retry once after ~150 ms before redirecting to `/login`, to absorb the post‑signup write delay.

### Step 3 — Verify
- Sign up with a fresh email in the preview. Expected: `welcome` → `onboarding/team` with no flicker, no console errors, no `/login` detour.
- Sign in with an existing onboarded user from `/login`. Expected: lands in `/w/.../c/...`.
- Hard‑refresh `/onboarding/team` while signed in. Expected: stays on the step, no redirect loop.

## Out of scope
- The post‑payment Paddle redirect (already fixed in a prior turn).
- Email/verification infrastructure.
- Any DB schema or RLS changes unless Step 1 proves a policy is blocking the profile read.
