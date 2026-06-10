# Agent personality + reinforcement

Let each agent carry a short identity (name, role, personality) edited workspace-wide in Admin, with optional per-channel overrides. Inject the identity as a brief reminder on every 10th agent reply.

## 1. Schema

**`agents` (workspace-level defaults)** — add three nullable columns:
- `role` (text) — short title (e.g. "Senior brand strategist")
- `personality` (text) — voice/tone paragraph (markdown OK)
- `display_name` (text) — overrides `name` in chat when set; falls back to `name`

**New `channel_agent_overrides` table** — per-channel per-agent override:
- `channel_id`, `agent_id` (composite PK), `workspace_id`
- `display_name`, `role`, `personality` (all nullable; null = inherit from agent)
- RLS: workspace members read/write for their workspace

**New `agent_reply_counters`** — per-channel per-agent counter:
- `channel_id`, `agent_id` (composite PK), `count int default 0`, `updated_at`
- Incremented server-side after each agent reply in `agent-router`

## 2. Backend (`agent-router.functions.ts`)

For each agent reply, resolve identity = override ?? agent defaults. Build a compact identity block:

```
You are {display_name}, {role}.
{personality}
```

- Always prepend a one-line identity tag to the system prompt: `Identity: {display_name} — {role}`.
- Increment `agent_reply_counters.count`. If `count % 10 === 0`, also prepend the full identity block above the chat history as a system message ("Reminder of who you are…").
- Skip reinforcement if all three fields are empty.

## 3. UI

**Admin Console → Agents** (`src/routes/_auth.w.$workspaceId.admin.tsx` or its agents tab):
- Add inputs for Display name, Role, Personality on each agent card.
- Save via existing agent update path (extend server fn).

**Channel details pane** (`channel-details` body, next to each room agent):
- Pencil icon on hover → small popover with Display name / Role / Personality inputs.
- Header text: "Override for #channel-name" with "Reset to workspace default" link.
- Writes to `channel_agent_overrides`.

**Display name resolution** in chat: messages render `effectiveName(agent, override)` everywhere agents are listed (member row, message header, mention autocomplete still uses `handle`).

## 4. Files

- **Migration**: add columns + new tables + RLS + grants.
- **New**: `src/lib/agent-identity.functions.ts` (update agent defaults, upsert/clear channel override, fetch effective identity).
- **Edited**:
  - `src/lib/agent-router.functions.ts` — resolve identity, inject reminder every 10th reply, bump counter.
  - `src/components/hypeforce/channel-log-panel.tsx` or `channel-details` body — add override popover.
  - Admin agents view — add the three fields.
  - `src/routes/_auth.w.$workspaceId.c.$channelId.tsx` — use effective display name in member list and message headers.

## Out of scope

- Voice samples, avatars (already exist).
- Cross-workspace agent sharing.
- A separate "reset counter" UI — counter just lives in the background.
