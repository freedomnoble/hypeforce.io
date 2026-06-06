Finish the half-built Slack-style mobile navigation. The build currently breaks because `MobileChatTopBar` is referenced on the channel page but never defined. Three small files to touch — no design or desktop changes.

## 1. `src/components/hypeforce/workspace-shell.tsx`

Export a new `MobileChatTopBar` component (placed near `MobileTabButton`) that the chat pages can drop in. It uses `useMobileShell()` to reach the shell's drawers and `useNavigate()` for the back arrow.

Shape:
- `sm:hidden` 14h glass header, flex row.
- Left: workspace avatar button (2-letter initials, primary tint) → `openWorkspaces()`.
- Center (button): `<ChevronLeft />` + prefix (`#` or `@`) + title, tap → `navigate({ to: "/w/$workspaceId", params })` so the sidebar (channel list) comes back, then `onOpenDetails?.()` is NOT called here (back nav is separate from details).
- Right: avatar of `profile` → `openProfile()`.
- Optional `onOpenDetails` button (e.g. `PanelRight` icon) sits between title and profile avatar so the user can summon the right context sheet from chat.

Props: `{ title: string; prefix?: "#" | "@"; onOpenDetails?: () => void }`.

## 2. `src/routes/_auth.w.$workspaceId.c.$channelId.tsx`

- Import `MobileChatTopBar` from `workspace-shell`.
- Existing `mobileDetailsOpen` state already added — wrap the right `aside` (Details panel) so on mobile it renders inside a `<Sheet side="right">` controlled by `mobileDetailsOpen`. Keep the existing `hidden lg:flex` aside for desktop unchanged; add a parallel mobile Sheet that reuses the same In-this-room / Pinned files / Channel context blocks (extract into a small `ChannelDetails` subcomponent in the same file to avoid duplication).
- The desktop header already has `hidden sm:flex` so it's hidden on mobile — good.

## 3. `src/routes/_auth.w.$workspaceId.d.$dmId.tsx`

- Import `MobileChatTopBar`.
- Add `mobileDetailsOpen` state.
- Add `MobileChatTopBar title={headerTitle} prefix={otherAgent ? "@" : undefined} onOpenDetails={() => setMobileDetailsOpen(true)}` before the existing desktop header; gate desktop header with `hidden sm:flex`.
- Wrap the right `aside` Details content in a mobile Sheet (same pattern as channel page) reusing the Participants block.

## 4. Mobile fit (no vertical page scroll)

The shell root is already `h-[100dvh] overflow-hidden pb-14 sm:pb-2`. Verify by viewing the preview at 402×716:
- Sidebar (channel list) should fill height minus the 56px bottom bar — set `pb-14 sm:pb-2` on the root and the sidebar's internal `overflow-y-auto` handles scroll inside the panel.
- Chat `main` should be `flex flex-col` with `flex-1` messages area scrolling, composer pinned. Already true; just confirm composer's `flex-shrink-0` stays.

## 5. DMs tab routing

The bottom-bar "DMs" button currently navigates to `/w/$workspaceId`. Keep that for now (the sidebar already shows DMs); a `?view=dms` filter can be a follow-up.

## Verification

- `bun run typecheck` / build runs clean.
- Preview at 402×716: land on channel list → tap a channel → chat opens with top bar (avatar / title / details / avatar) → tap left avatar opens Workspaces drawer; tap right avatar opens Profile drawer; tap details icon opens right Context sheet; tap title returns to channel list. Repeat on a DM.
- Desktop (≥sm) unchanged: no top bar visible, original headers intact, right aside still inline.
