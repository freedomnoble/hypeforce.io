## Problem

When a user clicks "Start 5-day free trial" on `/` and lands on `/welcome` → `/onboarding`, the theme snaps back to **Blueprint (default)** even though the landing page is showing e.g. **Hail Mary**.

Onboarding isn't hardcoded — `OnboardingLayout` uses semantic tokens and `SafeBg`, so it already respects whatever `data-theme` is on `<html>`. The bug is in the theme provider.

## Root cause

`ThemeProvider` initializes `theme` state once at app mount via `readInitialTheme()`. For a first-time visitor:

1. App mounts → no `localStorage["hf-theme"]`, no `hf-landing-theme` cookie yet → `theme = "default"`.
2. Landing page mounts → calls `setLandingThemeOverride("hail-mary")` → writes the cookie and sets `landingOverride` state.
3. While on `/`, `activeLandingOverride` wins → page renders Hail Mary correctly.
4. User navigates to `/welcome` → `isLandingRoute = false` → `activeLandingOverride` is ignored → falls back to `theme` state, which is still `"default"`. Flash to Blueprint.

The pre-hydration boot script in `__root.tsx` reads the same cookie correctly on a hard reload — but SPA navigation never re-runs it, so the in-memory `theme` state stays stale.

## Fix

In `src/components/hypeforce/theme-provider.tsx`, treat the landing-theme cookie as the *default* effective theme for any user who hasn't explicitly chosen one:

1. In `setLandingThemeOverride(t)`, after writing the cookie, also seed `theme` state to `t` **only if** `localStorage["hf-theme"]` is unset (i.e. the user has never made an explicit choice). Do **not** write `localStorage` — keep this an inheritable default, not a saved preference.
2. Clearing the override (`setLandingThemeOverride(null)`) must not clear the cookie or the seeded theme — onboarding/login/auth should keep the look.
3. Leave `setTheme()` behavior unchanged: any explicit user pick in-app still writes `localStorage` + cookie and wins over the landing default forever.

Result for the reported flow:
- Admin sets landing to Hail Mary → first-time visitor sees Hail Mary on `/`, `/welcome`, `/onboarding`, and the app until they change it.
- Existing users with a saved `hf-theme` are unaffected — their pick still wins.
- No flash: the boot script already handles hard loads; the seeding handles SPA nav from `/` → `/welcome`.

## Files to edit

- `src/components/hypeforce/theme-provider.tsx` — adjust `setLandingThemeOverride` to seed `theme` state when no explicit user choice exists.

No changes needed to `OnboardingLayout`, `welcome.tsx`, or `SafeBg` — they already follow `data-theme` tokens.

## Verification

- Hard reload `/` with Hail Mary CMS theme → onboarding screens show Hail Mary background + glow.
- In `/app`, pick Blueprint → reload `/` then go to `/welcome` → stays Blueprint (user choice wins).
- Log out → `/welcome` still shows whichever theme the user last saw (no jarring snap).
