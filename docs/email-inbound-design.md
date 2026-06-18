# Email-inbound fallback — design note

Status: **design only, not implemented**. Captures the scope so we can pick it
up later without re-deriving the shape.

## Goal

Let teammates participate in a Hypeforce channel from email when the web
client is impractical (mobile gap, external collaborator, "reply from your
inbox" CTA in a notification). An inbound email becomes a `messages` row
authored by the matching workspace member; the existing agent router then
fans out replies the same as any other message.

## Why this is small

Most pieces already exist:

- `src/routes/lovable/email/queue/process.ts` — outbound queue worker. We
  reuse its `pgmq` plumbing for inbound delivery receipts.
- `messages` table — already supports `author_type='user'` + `author_user_id`,
  so an inbound row is indistinguishable from a web-sent message.
- `invokeAgentRouter` — already idempotent per `message_id`. The inbound
  handler just inserts the row and calls it.

## New surface area

1. **`inbound_addresses` table** (per channel + per dm):
   ```
   id, workspace_id, channel_id?, dm_id?, address (unique),
   created_by, created_at, last_seen_at
   ```
   Address format: `c-<short-id>@inbound.hypeforce.io` /
   `d-<short-id>@inbound.hypeforce.io`. The short id is opaque so address
   discovery doesn't leak workspace structure.

2. **Inbound webhook**:
   `src/routes/api/public/email/inbound.ts` — receives parsed MIME from the
   email provider (Resend / Postmark / SES — TBD). HMAC-verified per the
   `public-api-endpoints` rules.

   Steps inside the handler:
   - Verify signature.
   - Look up `inbound_addresses` by recipient.
   - Resolve sender → `profiles.email` → `user_id`. Reject if not a member
     of the target workspace (send a bounce reply).
   - Strip quoted history (`---` separators, `On … wrote:` blocks).
   - Extract `@mention` tokens and resolve to `agents.handle` →
     `mention_agent_ids`.
   - `supabaseAdmin.from('messages').insert(...)` then
     `invokeAgentRouter({ data: {...}, headers: serviceJwt })`.

3. **Outbound notification reply-to header**:
   The notification email worker already exists. Add `Reply-To: <inbound
   address for this channel>` so users can just hit reply.

## Open questions (defer to implementation)

- Provider choice: Resend has the cleanest inbound parsing; Postmark has
  better deliverability + reply parsing. We already use neither for
  outbound — pick when implementing.
- File attachments: probably out of scope for v1.
- HTML vs markdown: convert HTML to markdown server-side
  (`turndown` is Worker-compatible).
- Rate limits: cap inserts per `(sender, channel)` per minute to defeat
  reply loops with an out-of-office responder.

## Out of scope (explicitly)

- Inbound DMs to the AI without a channel (defer; would need a per-user
  catch-all address).
- Sending agent replies back over email (only the original web channel gets
  the reply for v1; the email user pulls up the channel link in the
  notification).
