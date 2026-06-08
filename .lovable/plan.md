# Lovable AI Gateway, DMs, realtime, and team-aware agents

## 1. What models the gateway uses + how routing works (answer, no code change)

The Lovable AI Gateway is an OpenAI-compatible proxy at `https://ai.gateway.lovable.dev/v1`. Your app authenticates with a single server-side `LOVABLE_API_KEY` and picks a model per request. There are no separate "GPTs" or "agents" inside the gateway — your `agents` table rows are *your* personas, and each one is mapped to a model.

Models the gateway exposes (and that your code uses):
- Google: `google/gemini-3-flash-preview` (default), `gemini-3.1-flash-lite-preview`, `gemini-3.5-flash`, `gemini-3.1-pro-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- OpenAI: `openai/gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5.2`, `gpt-5.4` (+ mini/nano/pro), `gpt-5.5` (+ pro)
- Image: `google/gemini-2.5-flash-image` (Nano Banana), `gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`, `openai/gpt-image-2`, `openai/gpt-image-1-mini`

How your app routes today (see `src/lib/agent-router.functions.ts`):
- `agent.provider === "google"` → `google/gemini-2.5-flash`
- `anthropic` / `manus` / anything else → `openai/gpt-5-mini` (Anthropic and Manus aren't on the gateway, so they're silently aliased to GPT-5-mini)
- If the agent has `preferred_route = "byok:<provider>"` and the *calling user* has a key in `user_ai_connections`, the call goes direct to that provider via `src/lib/ai-providers.server.ts`, bypassing the gateway. Manus has no direct adapter yet.

## 2. Why DMs to a bot return nothing (bug fix)

In `src/routes/_auth.w.$workspaceId.d.$dmId.tsx`, `send()` passes `mention_agent_ids: mentions` — only @-mentioned agents. In `invokeAgentRouter`, the fallback that picks up "everyone in the room" only runs for `channel_id`, never `dm_id`. So a plain DM to a bot (no `@handle`) resolves to zero agents and the router returns `{ dispatched: 0 }`.

Fix:
- In the DM `send()`, when no mentions are present, pass the DM's agent participants as `mention_agent_ids` (use the existing `participantAgentIds`).
- Defensive: in `invokeAgentRouter`, also fall back to `dm_participants` (member_type=agent) when `agentIds` is empty and `dm_id` is set.

## 3. Why channel replies only appear on reload (realtime not enabled)

Both routes subscribe via `supabase.channel(...).on("postgres_changes", ...)` on `public.messages`. But `public.messages` is **not in the `supabase_realtime` publication**, so INSERTs are never broadcast. The agent reply is written by the server, but the client only sees it after a reload (initial fetch). The "thinking" bubble vanishes after the 60-second client-side timeout.

Fix (single migration):
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
```
RLS already scopes who can read messages, so subscribers only get rows they're allowed to see.

## 4. Give every agent context of itself and its teammates

In `invokeAgentRouter`, build a "team roster" block once per request and prepend it to each agent's system prompt:
- Load all agents in `workspace_id` (id, name, handle, role/title, one-line description from `system_prompt` or a new short bio field if present).
- Load the workspace's human members (display_name, role) from `workspace_members` + `profiles`.
- Inject as:
  ```
  YOU ARE: @{handle} — {name}, {role}.
  TEAMMATES (other AI):
   - @alex (Strategist): ...
   - @sam (Designer): ...
  HUMAN TEAMMATES:
   - Jane Doe (Owner)
   - ...
  When another @handle is mentioned, defer to them on their specialty.
  ```
- Keep it compact (cap each bio to ~120 chars) so it doesn't blow the context.

## Files to change
- `src/routes/_auth.w.$workspaceId.d.$dmId.tsx` — pass `participantAgentIds` when no mentions.
- `src/lib/agent-router.functions.ts` — DM fallback to `dm_participants`; build + inject team roster block.
- New migration — add `public.messages` to `supabase_realtime` + `REPLICA IDENTITY FULL`.

## Out of scope (ask before doing)
- Adding a `bio` / `title` column to `agents` for richer roster lines.
- Switching the default chat model from `gpt-5-mini` to `google/gemini-3-flash-preview` (cheaper/faster, current Lovable default).
- Streaming agent replies token-by-token instead of single insert at the end.
