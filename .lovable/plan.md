## Goal
Make agent replies appear progressively (token-by-token) in the chat instead of popping in as one finished block.

## Approach
Stream from the AI gateway and write the partial text to the message row as it grows. All viewers already subscribe to Postgres realtime, so streaming via row UPDATEs means every participant sees it type out — not just the sender.

## Changes

### 1. `src/lib/agent-router.functions.ts`
- For Lovable gateway text calls (`callLLM`) and BYOK text calls (`callProvider`), switch to streaming:
  - Insert the agent message row up front with `content: ""` and a new `status: "streaming"` flag.
  - Request `stream: true` from the gateway (SSE) and parse `data:` chunks, accumulating `delta.content`.
  - Throttled flush (~every 120ms or every ~40 chars) calls `supabaseAdmin.from("messages").update({ content: accumulated }).eq("id", rowId)`.
  - On completion: final update with `content` + `status: "complete"`. On error: update with error text + `status: "error"`.
- Image agents (`callImageGen`) stay one-shot — images don't stream meaningfully. Insert row when the image URL is ready, same as today.
- `callProvider` (BYOK in `ai-providers.server.ts`) gets a parallel `streamProvider` variant for openai/anthropic/google using each SDK's native streaming endpoint. Manus stays non-streaming (already a stub).

### 2. `src/routes/_auth.w.$workspaceId.c.$channelId.tsx` and `_auth.w.$workspaceId.d.$dmId.tsx`
- Add an UPDATE subscription on the same realtime channel, merging updated rows by id into local `messages` state.
- Render the streaming row normally; the user will see content grow in place. Optional: render a subtle blinking caret when `status === "streaming"`.

### 3. Schema
- Add `status text` column to `messages` (`'complete' | 'streaming' | 'error'`, default `'complete'`). Migration + GRANTs unchanged (table already granted).

## Out of scope
- Token-level SSE to the originating client (we lean on Postgres realtime instead — simpler and works for all viewers).
- Cancel/stop button mid-stream.
- Image agent streaming.

## Trade-offs
- Throttled DB UPDATEs (~8/sec per active agent reply) add write load but stay well within Supabase limits for normal chat volume.
- If the Worker is killed mid-stream the row is left in `status: "streaming"`; a follow-up message from any author won't be blocked, and a small client-side fallback ("…" after 30s with no update) can mark it stale later if needed.