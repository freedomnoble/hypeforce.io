# Trim default agents to ChatGPT + Gemini + Nano Banana

Anthropic and Manus stay available as BYOK providers — only the auto-seeded starter agents and existing seeded rows change. Marketing copy is left alone.

## 1. Update starter seed (`src/lib/bootstrap.functions.ts`)

Replace the 4-agent `starters` array with 3:
- **ChatGPT** — `provider: "openai"`, `model: "openai/gpt-5-mini"` (unchanged).
- **Gemini** — `provider: "google"`, `model: "google/gemini-3-flash-preview"` (unchanged).
- **Nano Banana** — `handle: "nano"`, `provider: "google"`, `model: "google/gemini-2.5-flash-image"`, description "Image generator — @nano to make pictures".

Drop Manus and Claude entries. Tighten the local provider union type to `"openai" | "google"` since those are the only seeded providers (the broader `SUPPORTED_PROVIDERS` list in `ai-connections.functions.ts` is unchanged so BYOK still works for Anthropic/Manus).

## 2. Replace the DB-side seed trigger (`handle_new_user`)

The `public.handle_new_user()` function (run on signup) also seeds Manus + Claude and adds them to the `launch-plan` channel. Migration to:
- Rewrite the function to insert only ChatGPT, Gemini, Nano Banana.
- Add all three to the default `launch-plan` channel (replacing the manus/chatgpt/claude trio).
- Change the welcome message author from `agent_manus_id` to `agent_chatgpt_id` and update the copy to reference the 3-agent roster.

## 3. Image-only agent behavior (`src/lib/agent-router.functions.ts`)

Nano Banana must reply with a generated image, not text. Add a branch in the per-agent loop:
- If `agent.model === "google/gemini-2.5-flash-image"` (or `handle === "nano"`), call the Lovable AI Gateway `/v1/chat/completions` endpoint with that model and `modalities: ["image","text"]` (gateway-supported), grab the returned image URL/data, and insert a message whose `content` is a markdown image: `![generated](<url>)` (optionally with a short caption above).
- On any error, insert a friendly fallback text reply instead.
- Skip brand voice / KB blocks for the image path (they bloat the prompt and the model ignores them); keep just the last user message as the prompt.

No schema change to `messages` needed — image is embedded in markdown and the chat UI already renders markdown.

## 4. Backfill existing workspaces (data migration via insert tool)

Run a one-off cleanup:
- `DELETE FROM public.messages WHERE author_agent_id IN (SELECT id FROM public.agents WHERE handle IN ('manus','claude'));` — required because `messages.author_agent_id` FKs to agents.
- `DELETE FROM public.channel_members WHERE agent_id IN (SELECT id FROM public.agents WHERE handle IN ('manus','claude'));`
- `DELETE FROM public.dm_participants WHERE agent_id IN (SELECT id FROM public.agents WHERE handle IN ('manus','claude'));`
- `DELETE FROM public.agents WHERE handle IN ('manus','claude');`
- For every workspace missing a `nano` agent, insert the Nano Banana row and add it as a member of the workspace's first/`launch-plan` channel.

## Files / migrations
- Edit: `src/lib/bootstrap.functions.ts`
- Edit: `src/lib/agent-router.functions.ts`
- New migration: rewrite `public.handle_new_user()`
- Data cleanup: bulk delete + nano backfill via insert tool

## Out of scope
- Landing page, tour, FAQ, and index `<head>` copy still mention Claude/Manus (per your call — they remain valid BYOK options).
- `SUPPORTED_PROVIDERS` / BYOK connect screen unchanged — Anthropic + Manus stay connectable.
- No streaming/tool-call rework for Nano Banana; it's a single-shot image response.
