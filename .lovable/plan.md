## Problem

On `/`, the page paints with the default Blueprint theme for a moment, then snaps to Hail Mary (or whichever theme the CMS has set).

Root cause is a two-step apply:

1. SSR renders `<html>` with no `data-theme` attribute → browser paints the default theme.
2. After hydration, `LandingPage` runs a `useEffect` that calls `setLandingThemeOverride(themeKey)`. `ThemeProvider` then runs *its* `useEffect` to write `data-theme="hail-mary"` and (for themes with modes) toggle `dark`. That's the visible swap.

The CMS theme is already known on the server (it's in the `/` route loader as `themeKey`), so we can set `data-theme` on the `<html>` element during SSR and skip the flash entirely.

## Fix

Make the root shell theme-aware for the landing route, and remove the redundant client-side override path.

### 1. `src/routes/__root.tsx` — apply theme during SSR

In `RootShell`, read the matched routes via `useRouterState({ select: s => s.matches })`, find the match for route id `/`, and pull `themeKey` out of its `loaderData`. Derive:

- `dataTheme`: `themeKey` if it's a known built-in theme id, else `"default"`.
- `htmlClass`: `"dark"` when `themeHasModes(dataTheme)` and the theme's default mode is dark (Hail Mary qualifies via the existing `THEMES_WITH_MODES` rule; mirror the same default-mode logic used in `ThemeProvider`: `newsprint → light`, others → `dark`).

Render `<html lang="en" data-theme={dataTheme} className={htmlClass}>`. This is what ships in the SSR HTML, so the first paint is already Hail Mary.

For non-landing routes the matches list won't contain `/`, so `dataTheme` falls back to `"default"` — same behavior as today.

### 2. `src/components/hypeforce/theme-provider.tsx` — keep the override but stop the flicker on hydration

The `useEffect` that writes `data-theme` still runs after hydration. To avoid React clobbering the SSR attribute with a render that disagrees, initialize state with the same value the shell used:

- Change the landing-override resolution to read `document.documentElement.dataset.theme` on first mount (client only) and seed `landingOverride` from it when on `/`. This makes the provider's first effect a no-op (writes the same attribute that's already there) instead of a transition from `default` → `hail-mary`.
- Leave the `LandingPage` `useEffect` calling `setLandingThemeOverride(themeKey)` intact for client-side navigations into `/` (where there's no SSR pass).

### 3. Verify

- Load `/` with Hail Mary set as the CMS theme. The first frame in the network response's HTML should contain `<html ... data-theme="hail-mary" class="dark">`. No flicker on hard reload.
- Navigate from `/login` → `/` client-side: theme still applies (covered by the existing `LandingPage` effect).
- Navigate from `/` → `/app`: provider's existing `forceDefault` branch still strips `data-theme` back to `default`.

## Out of scope

- App routes (`/app`, `/w/...`) — they are `SSR: false` so there's no server HTML to mismatch; their theme apply already happens before first paint of the gateway. No change needed unless the user reports a flash there too.
- Custom (user-saved) themes on the landing page — landing only uses built-in CMS themes today; custom themes still go through the existing client path.
