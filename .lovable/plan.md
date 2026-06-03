## Goal

Add a new theme card in workspace settings → Themes called **Custom Generated**. Clicking it opens a prompt panel where the user describes the colors/vibe; an AI call produces a palette; the user previews it live and either applies+saves it to their account or discards. Saved themes can be shared with friends via a copyable link that opens an import screen.

## UX flow

1. In `ThemesPanel`, after the preset cards, render a dashed "+ Custom Generated" card. Clicking opens a modal (shadcn `Dialog`).
2. Modal step 1 — **Prompt**: textarea ("Describe your vibe…"), optional name field, "Generate" button. Show spinner while generating.
3. Modal step 2 — **Preview**: shows the 6-color palette swatches + sample chips (background, panel, primary button, accent, muted text). A live preview is also applied to the app underneath the modal (theme set temporarily). Buttons: "Regenerate", "Tweak prompt", "Apply & save".
4. On Apply & save: insert into `custom_themes` table, set as active theme.
5. Saved custom themes appear in the Themes grid alongside presets, each with a small "Share" icon → copies `https://<host>/theme/import?d=<base64-json>` to clipboard, and a "Delete" icon.
6. Share link route `/theme/import` decodes the payload, shows the preview, and offers "Save to my themes" (requires sign-in) or "Just preview".

## Data model

New table `public.custom_themes`:
- `id uuid pk`, `user_id uuid` (auth.users), `name text`, `prompt text`, `tokens jsonb`, `created_at timestamptz`
- RLS: users read/insert/update/delete their own rows. GRANTs to authenticated + service_role.

`tokens` is a flat JSON of CSS variable values (background, foreground, card, primary, primary-foreground, secondary, muted, muted-foreground, accent, accent-foreground, border, ring, panel, sidebar, rail, electric, violet) in `oklch(...)` strings, plus an optional `bodyGradient` string.

## Theme engine changes

`src/components/hypeforce/theme-provider.tsx`:
- `ThemeId` becomes `string` (preset ids + `custom:<uuid>` for saved + `custom:preview` for unsaved preview).
- Add `customThemes: CustomTheme[]`, `previewTheme(tokens)`, `clearPreview()`, `saveCustomTheme(name, prompt, tokens)`, `deleteCustomTheme(id)`, `setTheme(id)`.
- On mount, fetch user's `custom_themes` via Supabase browser client; subscribe to updates is not needed.
- A new effect injects a `<style id="hf-custom-theme">` tag whose body is `:root[data-theme="custom"] { --background: …; … }` whenever a custom theme (saved or preview) is active, and sets `data-theme="custom"` on `<html>`.
- `THEMES_WITH_MODES` stays as-is (custom themes are single-mode for now per user's "colors + vibe only" choice).

## AI generation

New server function `src/lib/custom-theme.functions.ts` (no auth middleware required for generation — only for persistence which happens via direct browser supabase insert under RLS):

- `generateCustomTheme({ prompt })` calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with AI SDK `generateText` + `Output.object` (Zod schema for the 17 token keys, each constrained to a regex matching `oklch(...)`).
- System prompt: "You are a theme designer producing accessible oklch color tokens for a chat app. Ensure contrast ratio ≥ 4.5 between foreground/background and primary-foreground/primary…" plus the list of token roles.
- Returns `{ tokens, name }` (suggested name).

Reads `LOVABLE_API_KEY` from `process.env` inside the handler. Uses the shared `createLovableAiGatewayProvider` helper in `src/lib/ai-gateway.server.ts` (create if missing).

## Sharing

- Encoding: `btoa(JSON.stringify({ n: name, t: tokens }))` (URL-safe base64).
- New route `src/routes/theme.import.tsx` (public): decodes the `d` query param, shows the palette + sample preview, "Apply preview", "Save to my themes" (calls supabase insert if authed; otherwise prompts sign in), and "Cancel" → home.
- Share button uses `navigator.clipboard.writeText` and toasts "Share link copied".

## Files to create

- `supabase/migrations/<ts>_create_custom_themes.sql` (via migration tool)
- `src/lib/custom-theme.functions.ts`
- `src/lib/ai-gateway.server.ts` (if not present)
- `src/components/hypeforce/custom-theme-dialog.tsx`
- `src/routes/theme.import.tsx`

## Files to edit

- `src/components/hypeforce/theme-provider.tsx` — generalize id type, custom theme loading, preview/save/delete, dynamic style injection.
- `src/components/hypeforce/workspace-settings-sheet.tsx` — render "+ Custom Generated" card, render saved custom themes with share/delete actions, mount the dialog.
- `src/styles.css` — add a minimal `:root[data-theme="custom"]` baseline (variables come from the injected style tag; this just provides body gradient fallback).

## Out of scope (per user)

- No dark/light pair for generated themes.
- No public discovery feed — sharing is link-only.
- Layout, fonts, animations untouched.
