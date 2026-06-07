# Feature Flags admin page — toggle theming

Add a global feature flag system (starting with two flags for theming) controlled from the `/pretentious` admin portal. When disabled, all users are forced to the default Blueprint theme and the theme picker UI hides the relevant options.

## Flags (v1)
- `themes_enabled` — when off, only the default Blueprint theme is available. All built-in alternate themes (Tool Time, Hail Mary, Coffee, Arachna-Verse) and any custom theme are blocked.
- `custom_themes_enabled` — when off, the AI custom theme generator is hidden and existing `custom:*` themes are blocked. Independent toggle so admins can keep built-in alternates but disable user-generated ones.

If `themes_enabled = false`, the custom-themes section is implicitly disabled too.

## Database
New migration creates `public.feature_flags`:
- `key text primary key`
- `enabled boolean not null default true`
- `description text`
- `updated_at timestamptz`

Grants: `SELECT` to `authenticated` and `anon` (flags need to be readable everywhere the app renders); `ALL` to `service_role`. RLS enabled. Policies:
- SELECT: allow all (`using (true)`).
- INSERT/UPDATE/DELETE: only `public.is_super_admin(auth.uid())`.

Seed both flags with `enabled = true`.

## Server functions (`src/lib/feature-flags.functions.ts`)
- `listFeatureFlags` — public, returns all flags as `{ key, enabled }[]`.
- `setFeatureFlag({ key, enabled })` — uses `requireSupabaseAuth`, asserts super-admin via `is_super_admin` RPC, upserts the row.

## Admin UI
- New route `src/routes/pretentious.flags.tsx` — list flags with toggle switches, description text, and a saving indicator. Uses `useQuery` + `useMutation` against the two server fns.
- Add a "Feature Flags" nav item with a `Flag` icon to `NAV` in `src/components/admin/admin-shell.tsx`.

## Enforcement in the app
- `theme-provider.tsx`:
    - Fetch flags on mount via `listFeatureFlags` (cached in state; also subscribe to refetch on `SIGNED_IN`).
    - Expose `themesEnabled` and `customThemesEnabled` in context.
    - In the apply-tokens effect, if `themesEnabled` is false, force `effectiveTheme = "default"` (override saved theme and landing override). If `customThemesEnabled` is false and the active theme is `custom:*`, fall back to default. Saved `localStorage` value is preserved so re-enabling restores it.
- `workspace-settings-sheet.tsx` theme section:
    - If `themesEnabled` is false: render a disabled state explaining "Theming is currently disabled by the workspace admin" and hide built-in/custom lists.
    - If only `customThemesEnabled` is false: hide the custom themes block and the "Create custom theme" button; keep built-in list.
- `landing-page.tsx` (CMS theme override): respect `themesEnabled` — if off, ignore `theme_key` override.

## Technical notes
- Flag reads are public (no auth) so SSR / landing page work without a session.
- Reuse existing `is_super_admin` definer function; no new RPC needed.
- No edits to `client.ts`, `types.ts`, or other auto-generated files.

## Out of scope
- Per-workspace flag overrides (global only for now).
- Realtime push of flag changes (users see new flag state on next mount / sign-in).
