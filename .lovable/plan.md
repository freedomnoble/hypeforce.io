
# Hypeforce — Build Plan

A Slack-style workspace for orchestrating AI agents alongside humans. The reference screenshot is already very close to the target design, so I'll match it directly rather than generate design directions.

## Phase 1 — Foundation (this build)

### Design System
- **Palette:** Deep cobalt/midnight navy background with a faint blueprint grid; white/ice text; electric blue & soft violet accents; subtle teal/mint for "online" status.
- **Typography:** `Space Grotesk` (display/UI) + `Inter` (body) + `JetBrains Mono` (timestamps, code, tags like `OPENAI`/`ANTHROPIC`).
- **Visuals:** Frosted-glass panels (`backdrop-blur`), soft drop shadows, hairline borders, rounded-2xl cards, pill badges, micro hover/press states (scale + glow). All colors via `oklch` semantic tokens in `src/styles.css`.
- **Icon/logo:** Use the uploaded glass character icon as the app mark; the 5 character avatars become the default agent + user avatars.

### Layout (matches the reference screenshot)
- **Far-left rail (64px):** Workspace switcher (avatar tiles), `+ New workspace`, settings, profile.
- **Left sidebar (~260px):** Workspace name, search, Channels list (with `#`), Direct Messages (humans + AI), agent roster card, current user footer.
- **Center pane:** Channel header (name, topic, member avatars, pin, details toggle) → message list (markdown + attachments + agent badges + timestamps) → composer with @-mention chips, attachment/image/emoji buttons, profile selector, Send.
- **Right panel (collapsible, ~320px):** In This Room (members + presence), Pinned Files, Channel Context (knowledge-base snippets attached to every agent reply).

### Routes (TanStack Start, file-based)
- `/login` — email/password + Google sign-in
- `/_authenticated.tsx` — auth gate layout
- `/_authenticated/index.tsx` — redirect to last workspace
- `/_authenticated/w/$workspaceId.tsx` — workspace shell (3-pane layout, Outlet)
- `/_authenticated/w/$workspaceId/c/$channelId.tsx` — channel view
- `/_authenticated/w/$workspaceId/dm/$dmId.tsx` — direct message view
- `/_authenticated/w/$workspaceId/admin.tsx` — Admin Console (members, agents, knowledge base)
- `/_authenticated/profile.tsx` — My Profile (bio, avatar, voice sample, email)

### Backend (Lovable Cloud)
Tables (all with RLS scoped via `workspace_members`):
- `profiles` (user bio, avatar_url, voice_sample_url, email)
- `workspaces` (name, slug, owner_id)
- `workspace_members` (workspace_id, user_id, role: owner/admin/member)
- `agents` (workspace_id, name, provider: openai/anthropic/google/manus, model, avatar_url, system_prompt, enabled)
- `channels` (workspace_id, name, topic, is_pinned)
- `channel_members` (channel_id, member_type: user/agent, ref_id)
- `direct_messages` (workspace_id, participant_ids[])
- `messages` (channel_id or dm_id, author_type: user/agent, author_id, content_md, mentions[], created_at)
- `files` (workspace_id, uploader_id, path, mime, size, scope: chat/knowledge, channel_id?, message_id?)
- `knowledge_base` (workspace_id, title, kind: rule/brand/brief, file_id, content_excerpt)
- `user_roles` + `has_role()` security-definer (workspace-scoped roles, never on profile)

Storage buckets: `avatars` (public), `attachments` (private), `knowledge` (private), `voice-samples` (private).

### Agent Router (per user request — Supabase Edge Function stub)
`supabase/functions/agent-router/index.ts`: verifies auth, accepts `{channel_id, message_id, target_agent_id?, mention_agent_ids[]}`, loads recent N messages + workspace knowledge base + agent system prompt, dispatches to provider (OpenAI / Anthropic / Google / Manus) via Lovable AI Gateway where supported, inserts agent reply back into `messages`. Stub providers behind a switch so each can be wired up incrementally. Mention routing: if `mention_agent_ids` non-empty, only those reply; else all channel agents reply.

### Realtime
Supabase Realtime on `messages` keyed by channel/dm so new messages (human and agent) appear live.

### PWA / Mobile
- Responsive: mobile collapses to single pane with bottom sheet for sidebars (hamburger + details toggle).
- Manifest-only PWA (installable, no service worker — per project rules) with the glass icon.

## Technical Notes
- AI calls use Lovable AI Gateway under the hood (`google/gemini-3-flash-preview` default, swappable per agent). User-facing copy says "AI-powered".
- Markdown rendering via `react-markdown` + `remark-gfm`.
- File uploads via Supabase Storage signed URLs.
- All colors are semantic tokens; no hardcoded hex in components.
- Following AI Elements / chat-agent-ui-contract for the chat surface (Conversation, Message, PromptInput, Shimmer for "thinking").

## Phase 2 (later, not in this build)
- Voice-sample tone transfer in agent prompts
- Threaded replies / reactions
- Search across channels
- Granular knowledge-base chunking + retrieval

## Open question I'll answer by defaulting (tell me to change if wrong)
- **Auth:** email/password + Google (Lovable Cloud defaults).
- **Agent providers:** I'll wire OpenAI + Anthropic + Google through Lovable AI Gateway (no extra keys needed). Manus will be a stub provider with a `MANUS_API_KEY` secret slot you can fill in later.
- **Conversation shape:** Threaded by channel/DM, persisted in the database (this is the product).
