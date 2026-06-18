# Fix theme desync between landing, onboarding, and `/app`

## What's actually broken

**Bug 1 — `/app` shows default while Hail Mary is "selected" in the picker.**
The picker marks a theme active via `t.id === theme` (React state), but the effect can apply something different than `theme` (e.g. `default` when `themesEnabled` is false, or whatever the boot script wrote at load if React state diverges from cookie/localStorage). There's no single source of truth: the boot script, SSR `RootShell`, `readInitialTheme`, and `setLandingThemeOverride` each have slightly different precedence rules. The picker should show "selected" for **what is actually applied**, not for the raw state.

**Bug 2 — Onboarding/welcome shows default blue instead of the CMS landing theme.**
The CMS landing theme is only written to a cookie + seeded into React state inside the landing page's `useEffect`. Two failure modes:
1. The seed is gated by `if (!localStorage.hf-theme) setThemeState(prev => prev === "default" ? t : prev)`. If a user has ever had **any** value in `localStorage["hf-theme"]` (including a stale `"default"` from an older session), the CMS landing theme is silently ignored.
2. On a hard navigation directly to `/welcome` before ever visiting `/`, the cookie isn't set yet, so the boot script falls back to `default`.

## Plan

### 1. One resolver, used everywhere

Add a single precedence rule, mirrored in the boot script, `RootShell`, and `ThemeProvider`:

```
applied = (preview tokens)
        ? "custom"
        : (on landing route)
            ? CMS landing theme (from loader / cookie / default)
            : userTheme ?? cmsLandingTheme ?? "default"
```

Where:
- `userTheme` = `localStorage["hf-theme"]` (only set by an explicit user pick).
- `cmsLandingTheme` = cookie `hf-landing-theme` (written by landing page **and** by SSR `RootShell` for any visitor whose loader resolved a CMS theme).

Side-effect: stop writing `"default"` to `localStorage["hf-theme"]`. Treat the absence of that key as "user has not chosen", so the CMS theme can always cascade through.

### 2. `setLandingThemeOverride` simplification

Drop the "only seed if prev was default" guard. The new rule:
- Always update the `landingOverride` state (used only on `/`).
- Always write the `hf-landing-theme` cookie when given a known theme.
- Never write `localStorage["hf-theme"]` — that key is reserved for explicit user picks.

The resolver in step 1 then handles non-landing routes correctly without any in-memory seeding trick.

### 3. SSR `RootShell` writes the cookie too

When the landing loader returns `themeKey`, emit a `Set-Cookie: hf-landing-theme=<key>; Max-Age=1y; SameSite=Lax; Path=/` via TanStack's response headers so the very first navigation to `/welcome` (or any other route) on a brand-new device already has the cookie before the boot script runs. Implemented inside the landing route's loader using `setResponseHeader`.

### 4. Picker reflects what's applied

In `ThemesPanel`, derive `appliedTheme` from the provider (expose it from context). Compute `active = t.id === appliedTheme` instead of `t.id === theme`. Add a small inline warning when `themesEnabled` is false. This makes the "selected but not applied" desync impossible.

Provider change: add `appliedTheme: ThemeId` to the context, computed with the same resolver in step 1.

### 5. Boot-script + provider parity

Rewrite the inline boot script in `src/routes/__root.tsx` to use the resolver from step 1 — including the rule that for non-landing routes `localStorage["hf-theme"]` wins over the cookie, and for `/` the SSR-rendered `data-theme` wins. Same logic in `readInitialTheme` and the provider's apply-theme effect.

## Files to edit

- `src/components/hypeforce/theme-provider.tsx` — add resolver, expose `appliedTheme`, simplify `setLandingThemeOverride`, stop writing `"default"` to localStorage, fix `readInitialTheme` to match the resolver.
- `src/routes/__root.tsx` — rewrite boot script to call the same resolver inline; no behavior change for `/`.
- `src/routes/index.tsx` (landing loader) — `setResponseHeader('Set-Cookie', ...)` when a CMS theme is resolved.
- `src/components/hypeforce/landing-page.tsx` — no behavior change needed beyond keeping the existing `setLandingThemeOverride(themeKey)` call (which still writes the cookie client-side as a fallback).
- `src/components/hypeforce/workspace-settings-sheet.tsx` — use `appliedTheme` for the `active` check; show a "Theming is disabled by feature flag" notice if `themesEnabled === false` while a non-default theme is selected.

## Verification

1. Hard-reload `/` with CMS = Hail Mary → renders Hail Mary, no flash.
2. Click "Start 5-day free trial" → `/welcome` renders Hail Mary (no flash, no blue).
3. Sign up → onboarding screens render Hail Mary.
4. In `/app`, open Themes — Hail Mary is shown selected **and** the app actually looks Hail Mary.
5. Pick Blueprint in `/app` → reload `/` → still Hail Mary (CMS wins on landing). Navigate to `/welcome` or `/app` → Blueprint (explicit user pick wins).
6. Log out → `/welcome` still shows Blueprint (explicit pick survives sign-out).
7. Clear site data, hard-load `/app` directly with no prior `/` visit (and no cookies) → renders `default` (correct: no CMS preference known yet).
8. Repeat #7 after one visit to `/` → now `/app` renders the CMS theme until the user explicitly picks another.
