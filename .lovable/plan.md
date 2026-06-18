# Plan: Per-provider avatar defaults from the admin console

Let admins upload one avatar per AI provider (OpenAI, Anthropic, Google, Manus, Lovable). That avatar becomes the default everywhere a matching agent or logo shows up: landing's **Plays well with** bar, landing's **Day one roster**, and any in-app agent without a custom avatar.

## Storage

Add a JSON map to the existing `landing_content` row (id = 1) — no new table.

```sql
ALTER TABLE public.landing_content
  ADD COLUMN IF NOT EXISTS provider_avatars jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Shape: `{ "openai": "url", "anthropic": "url", "google": "url", "manus": "url", "lovable": "url" }`. RLS / grants on `landing_content` are already set up — no further policy changes needed because the row is already publicly readable via `getLandingContent`.

## Admin console

In `/pretentious/landing`, add a new **Provider avatars** panel below "Hero image & demo video":

- One row per provider (OpenAI, Anthropic, Google, Manus, Lovable) with the current avatar preview, a file input (reuses `createLandingUploadUrl`), and a URL field.
- Saves through the existing `updateLandingContent` server fn (extended to accept `provider_avatars`).

## Landing page wiring

`getLandingContent` / `landing.functions.ts` already returns the row publicly. Extend it to expose `provider_avatars`, then in `landing-page.tsx`:

- **Plays well with bar**: when an item has no `logo_url`, normalise its `label` (lowercase, trim "GPT/ChatGPT" → `openai`, "Claude" → `anthropic`, "Gemini" → `google`, "Manus" → `manus`, "Lovable" → `lovable`) and fall back to `provider_avatars[provider]`. Letter chip stays as last-resort fallback.
- **Day one roster (Meet your team)**: replace the gradient initial circle in `TeamAgentCard` with an `<img>` when `provider_avatars[provider]` is set; keep the initial as fallback. Pass `provider` ("openai" | "anthropic" | "google") into each of the three cards.

## In-app default avatars

Add a thin client helper `useProviderAvatars()` (react-query, queryKey `["provider-avatars"]`) that calls a new lightweight public server fn `getProviderAvatars` returning `{ openai?, anthropic?, google?, manus?, lovable? }`. No auth needed.

Add `resolveAgentAvatar(agent, providerAvatars)`:
1. If `agent.avatar_url` is set and is **not** one of the seed `/avatars/*.png` placeholders, use it.
2. Otherwise return `providerAvatars[agent.provider]`.
3. Otherwise return the existing `agent.avatar_url` (so today's behaviour still applies).

Apply at the existing render sites:
- `src/components/hypeforce/channel-log-panel.tsx`
- `src/components/hypeforce/workspace-shell.tsx`
- `src/components/hypeforce/workspace-settings-sheet.tsx`
- `src/routes/_auth.w.$workspaceId.c.$channelId.tsx`
- `src/routes/_auth.w.$workspaceId.d.$dmId.tsx`
- `src/routes/_auth.onboarding.team.tsx`
- `src/components/hypeforce/openclaw/agent-card.tsx`

No DB write to `agents.avatar_url` — the override is purely render-time, so changing a provider avatar instantly updates every existing agent that hasn't picked a custom one. Avatars assigned per-agent (e.g. through Avatar Studio) keep winning.

## Files touched

- New migration adding `provider_avatars` column.
- `src/lib/admin.functions.ts` — accept `provider_avatars` in `updateLandingContent`; return it in `getLandingContentAdmin`.
- `src/lib/landing.functions.ts` — return `provider_avatars` (or add a tiny `getProviderAvatars` fn for the app).
- `src/routes/pretentious.landing.tsx` — new Provider avatars panel.
- `src/components/hypeforce/landing-page.tsx` — plays-with bar + `TeamAgentCard` fallback.
- New `src/lib/provider-avatars.ts` — `useProviderAvatars()` + `resolveAgentAvatar()` helper.
- Seven render sites listed above — swap raw `agent.avatar_url` for `resolveAgentAvatar(agent, providerAvatars)`.

## Out of scope

- No new provider added to the wizard (Lovable BYOK is still deferred).
- No bulk migration of existing `agents.avatar_url` values; the helper handles fallback at render.
