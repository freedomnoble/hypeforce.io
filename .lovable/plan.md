## Admin shortcut on profile panel

Add a small rubik's-cube Lottie button in the mobile profile sheet, visible only to super-admins. Tapping it plays the animation for ~1s, then navigates to `/pretentious`.

### Changes

1. **Install lottie player**: `bun add lottie-react`.

2. **Source the Lottie JSON**: The iconscout URL (`loading-cube-animation_13044216`) requires a logged-in download and is not directly fetchable. I'll need the JSON file. Two options:
   - You drop the downloaded `.json` into chat and I'll save it to `src/assets/rubix-cube.lottie.json`.
   - Or I substitute a similar free CC0 cube-loader Lottie (e.g. from LottieFiles) so I can ship without waiting.
   I'll default to option 1 — please attach the JSON. If you'd rather I use a substitute, say so and I'll pick one.

3. **Admin detection on the client**: Reuse the existing `checkSuperAdmin` server fn (`src/lib/admin.functions.ts`). In `workspace-shell.tsx`, add a `useQuery` that calls it once per session and stores `isSuperAdmin`. Gate the new button on this flag (no hardcoded email — uses the same `is_super_admin` RPC the `/pretentious` route uses).

4. **New `AdminCubeButton` component** (`src/components/hypeforce/admin-cube-button.tsx`):
   - Renders a 28–32px `<Lottie>` using the JSON, `autoplay={false}`, `loop={false}`, controlled via a `lottieRef`.
   - On click: call `lottieRef.current?.goToAndPlay(0)`, then `setTimeout(() => navigate({ to: "/pretentious" }), 1000)`. Disable the button while animating to avoid double-taps.
   - Styled as a small circular icon button matching the existing profile-sheet row chrome.

5. **Mobile profile sheet** (`src/components/hypeforce/workspace-shell.tsx` ~line 826): when `isSuperAdmin` is true, render `<AdminCubeButton />` in the header next to the "● online" / display name block (top-right of the profile card). Keeps it discreet and matches the screenshot's intent (a small icon on the profile panel).

6. **Desktop parity (optional, default ON)**: also render the same button in the desktop profile area in `workspace-shell.tsx` (~line 705 / rail bottom region) so it's not mobile-only. Tell me if you want mobile-only instead.

### Out of scope
- No changes to `/pretentious` routing or admin auth checks.
- No changes to the existing profile sheet rows (Workspace settings, Inbox, Get help, Sign out).
- No new RLS/migrations.

### Open question
Please attach the iconscout Lottie JSON, or confirm I can use a substitute cube animation from LottieFiles.
