# Shared channel context: pinned files + project log

Three threads, all so humans and agents share one source of truth per channel:

1. **Pinned files → markdown, always in context.**
2. **Per-channel project log** (append-only notebook) visible in the details pane.
3. **Agents read the log and add to it** via inline `<memo>` tags.

---

## 1. Pinned files become markdown

### Upload + convert
- Add a paperclip in the channel composer and an "Add file" button in the details pane → opens the existing-style upload flow but scoped to the current channel (`files.channel_id = channelId`, `is_pinned = true`, `scope = 'channel'`).
- Server fn `extractFileText({ fileId })` runs after upload:
  - Downloads the object from storage.
  - Routes by mime/extension to a pure-JS converter (Worker-safe):
    - **PDF** → `unpdf` (pdfjs wrapper) → text → markdown
    - **DOCX** → `mammoth` → HTML → markdown via `turndown`
    - **XLSX/XLS/CSV** → `xlsx` (SheetJS) → markdown table per sheet
    - **MD/TXT/JSON/code** → read as text, fenced if not markdown
  - Stores result in `files.content_text` (existing column), truncated to ~80k chars with a "[truncated]" footer if longer.
  - Sets `files.extraction_status` (new column: `pending|ok|failed`) and `extraction_error`.
- Existing files get a "Re-extract" action in the details pane.

### Always-in-context
- `agent-router.functions.ts` already injects pinned-file content. Two changes:
  - Raise per-file slice from 4 000 → 12 000 chars (still bounded).
  - Add a clear header block (`# Pinned files (always-on context)`) so the model treats them as canonical.
- No truncation of the chat history beyond the existing 10-message window; pinned files supplement, never replace.

### Dependencies
`bun add unpdf mammoth turndown xlsx` — all pure JS, Worker-compatible.

---

## 2. Per-channel project log (the "git-style" space)

### Data model
New table `channel_memos`:
- `channel_id`, `workspace_id`
- `author_type` (`user` | `agent`), `author_user_id`, `author_agent_id`
- `title` (short, optional), `body` (markdown), `tags` (text[])
- `source_message_id` (nullable — links memo back to the reply that produced it)
- `created_at`

RLS: workspace members read; members insert; author or admin update/delete. Realtime enabled so the details pane updates live.

### UI in the details pane
- New section **"Project log"** between "In this room" and "Pinned files".
- Shows the 3 most recent memos (author avatar, title, first ~140 chars, relative time).
- "View all" opens a full-height side sheet with the complete log, filters (mine / agents / tag), and a "+ New memo" form (markdown textarea, optional title/tags).
- Each memo row has a "Copy as context" action and (for the author/admin) edit/delete.

### Channel header
- Small chip next to the agent stack: "Log · N" — click opens the full sheet.

---

## 3. Agents read + write the log

### Read
Extend the system prompt in `agent-router.functions.ts` with a `# Project log` block: the last ~15 memos, each as `## [title] — @handle · time` + body, truncated to a sensible per-memo cap. This sits alongside (not inside) the pinned-files block.

### Write (inline `<memo>` tags, no extra LLM calls)
- Append to every agent's system prompt:
  > When you decide something concrete, capture a fact worth referencing later, or finish a unit of work, emit one or more blocks like:
  > `<memo title="Optional short title" tags="decision,api">Markdown body…</memo>`
  > Memos are saved to the channel's project log and shown to teammates. Use sparingly — only when it advances shared context.
- After streaming completes, the server:
  1. Regex-extracts `<memo …>…</memo>` blocks from the final content.
  2. Inserts each as a `channel_memos` row with `author_type='agent'`, `author_agent_id`, `source_message_id`.
  3. Strips the raw tags from the message content and replaces them with a compact footer like `— logged 2 memos to project log`, so the chat reads cleanly while the memos appear in the log panel.
- Same hook runs once per streaming reply; image-agent path skipped.

### Mention support
`@log` in a user message opens the new memo form pre-populated (purely client-side convenience — no separate agent).

---

## Out of scope

- True git semantics (branches, diffs, named versioned documents). Append-only entries cover "stay aligned" without that complexity.
- Vector / RAG over file content — pinned files are injected wholesale, capped by char budget. Can be added later if budgets become a problem.
- Cross-channel memo sharing (already covered by the existing "Forward message" feature).

---

## Files touched

- **New**: `src/lib/file-extraction.functions.ts`, `src/lib/file-extraction.server.ts`, `src/lib/channel-memos.functions.ts`, `src/components/hypeforce/channel-log-panel.tsx`, `src/components/hypeforce/channel-log-sheet.tsx`, `src/components/hypeforce/channel-upload-button.tsx`.
- **Edited**: `src/routes/_auth.w.$workspaceId.c.$channelId.tsx` (composer paperclip, details pane log section + upload button, header chip), `src/lib/agent-router.functions.ts` (memo block in system prompt, post-stream memo extraction, pinned-file budget), `src/integrations/supabase/types.ts` (regenerated after migration), `package.json` (new deps).
- **Migration**: `channel_memos` table + RLS + grants + realtime; add `extraction_status` + `extraction_error` columns to `files`.
