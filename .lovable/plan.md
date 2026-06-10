# Manage agents per channel

Right now agents are bound to a channel only at creation. Make it easy to add or remove any workspace agent from any channel directly inside the channel.

## UX

In the channel's right-side **Details → "In this room"** panel (and the matching mobile sheet):

- Each agent row gets a small `×` remove button (hover-revealed on desktop, always visible on mobile).
- Below the agent list, an **"+ Add agent"** button opens a small popover listing every workspace agent that isn't already in the channel. Clicking one adds it instantly.
- Empty / all-added states handled (e.g. "All your agents are already here").
- Toast on success/failure. List updates optimistically and re-syncs from the DB.

No change to the header avatar stack — it already reflects `roomAgents` and will update automatically.

## Implementation

**Frontend** (`src/routes/_auth.w.$workspaceId.c.$channelId.tsx`)
- Extend `ChannelDetailsBody` to receive `agents` (all workspace agents), `channelId`, and an `onMembershipChanged` refetch callback.
- Add a `ManageChannelAgents` subcomponent with the popover picker + remove buttons, calling the new server fns and then refetching `channel_members` to update `channelAgentIds`.

**Server** (new file `src/lib/channel-membership.functions.ts`)
- `addAgentToChannel({ channelId, agentId })` — verifies caller is a workspace member, verifies the agent belongs to the same workspace, upserts a `channel_members` row (`member_type: "agent"`).
- `removeAgentFromChannel({ channelId, agentId })` — verifies caller is workspace member (RLS further restricts to channel creator or workspace admin), deletes the row.
- Both use `requireSupabaseAuth` + the user-scoped supabase client so existing RLS policies enforce permissions. No new migration — `channel_members` policies already cover insert (any workspace member), delete (creator/admin), and select.

## Out of scope

- Adding/removing **human** members from a channel (only agents, per the request).
- Changing how agents auto-respond — routing logic in `agent-router.functions.ts` already keys off `channel_members`, so newly added agents start responding immediately and removed ones stop.
