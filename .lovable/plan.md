## Changes

### 1. New Rubik's cube icon (matches the video)
Replace the colored 3D CSS cube in `src/components/hypeforce/admin-cube-button.tsx` with a black line-art SVG cube modeled on the iconscout reference (isometric 2x2 cube with bold black strokes, `currentColor` so it inherits theme color). On click it animates ~1s (rotate + slight scale "twist") then navigates to `/pretentious`. Keep the same props API (`size`, `title`, `className`).

### 2. Move cube to the bottom of the profile panel
In `src/components/hypeforce/workspace-shell.tsx`:
- Remove the `AdminCubeButton` from the mobile profile-sheet **header** (~line 851).
- Add it to the **bottom** of the profile sheet, as the last row above (or just below) "Sign out" — styled as a `ProfileSheetRow`-like row labeled "Admin console" with the cube as the icon, only rendered when `isSuperAdmin`.
- Desktop rail placement (~line 463) stays as-is (already near bottom, just above Sign out).

### 3. Mobile-optimize `/pretentious`
`src/components/admin/admin-shell.tsx` currently renders all 7 nav items inline in a single row, which overflows on phones. Rework the header:
- Desktop (`sm:` and up): unchanged horizontal nav.
- Mobile: collapse nav into a hamburger button that opens a `Sheet` (right side) listing all nav items + Sign out + Back to app.
- Keep the wordmark visible. Reduce padding on small screens.

In `src/routes/pretentious.index.tsx`: stat grid is already responsive (`grid-cols-2 md:grid-cols-3 lg:grid-cols-6`) — leave as-is.

Other `/pretentious/*` route pages are out of scope for this pass unless a specific one is broken; I'll only touch the shell so the chrome works on mobile. If you want every sub-page audited (users table, billing, etc.) say so and I'll do a follow-up.

### 4. Back to `/app` from `/pretentious`
Add a "Back to app" link in `admin-shell.tsx`:
- Desktop: small link/button next to "Sign out" in the top-right of the admin nav, with an `ArrowLeft` icon, navigating to `/app`.
- Mobile: same action as a row in the mobile nav sheet.

### Files touched
- `src/components/hypeforce/admin-cube-button.tsx` — new SVG icon + spin animation
- `src/components/hypeforce/workspace-shell.tsx` — move cube to bottom of profile sheet
- `src/components/admin/admin-shell.tsx` — mobile hamburger nav + Back-to-app link
- `src/styles.css` — replace `admin-cube-spin` keyframes for the new icon spin

### Out of scope
- No changes to `/pretentious` sub-page layouts beyond the shell.
- No changes to `/pretentious` auth gate, RLS, or server functions.
- No new dependencies (no Lottie); using inline SVG keeps it lightweight and theme-aware.
