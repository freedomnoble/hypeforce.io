# Plan: "Build your own AI workforce" newsletter signup

A new section between **Pricing/Subscriptions** and **FAQ** that captures emails for a weekly tips series. No gatekeeping, no paywall — just hype + email field.

## Section design

A full-width glass band with:

- Eyebrow: `WEEKLY DROP`
- Headline: *"Not ready yet? Build your own AI workforce."*
- Subhead: *"Get a weekly breakdown of how teams are wiring ChatGPT, Claude, Gemini and Manus into real work — popular stacks, prompts that ship, and the playbooks behind Hypeforce. No spam, unsubscribe anytime."*
- Inline form: email input + "Get the playbook" button.
- Success state replaces the form with a thank-you line.
- All copy is CMS-editable via new `newsletter_*` keys in `landing_content.content` so the admin CMS can override without a redeploy.

## Where it goes

`src/components/hypeforce/landing-page.tsx`, between the existing Pricing section and the FAQ section. The "How it works → Platform → Use cases" reorder you set earlier stays untouched.

## Data capture

New table `public.newsletter_subscribers` with:

- `email` (citext, unique, primary key-ish)
- `source` (text, default `'landing'`) — so future placements can be attributed
- `confirmed_at` (nullable, reserved for future double-opt-in)
- `unsubscribed_at` (nullable)
- `created_at`

RLS: anon can `INSERT` only; nobody else can read/update/delete from the client. Super admins read via existing admin gating. Conflict on `(email)` resolves silently (so re-submits don't error).

Grants follow project convention:
```
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
```

## Server function

New public `subscribeNewsletter` in `src/lib/landing.functions.ts` (no auth):
- Zod-validates email (`.email().max(255)`).
- Inserts with `onConflict: email, ignoreDuplicates: true`.
- Returns `{ ok: true }` either way so we don't leak whether the address is already on file.

## Admin visibility

Small additions to `/pretentious/landing`:
- New "Newsletter copy" fields (`newsletter_eyebrow`, `newsletter_headline`, `newsletter_subhead`, `newsletter_cta`, `newsletter_success`) appended to the existing FIELDS list — admin can rewrite the section without code.
- A read-only count + "Export CSV" button in a new `Newsletter` panel powered by a new admin-only server fn `listNewsletterSubscribers` (returns email + created_at). Keeps the door open for sending later.

## Sending the actual newsletter (out of scope, called out)

This plan only **collects** subscribers. A recurring marketing newsletter is a separate decision — Lovable's built-in Emails is transactional-only and not appropriate for weekly tips. When you're ready to actually send, the right path is a marketing tool (Beehiiv, Mailchimp, ConvertKit, Substack, Resend Broadcasts) — we can wire the export or a webhook to it in a follow-up. The CSV export means no subscriber is lost in the meantime.

## Files touched

- New migration: `newsletter_subscribers` table + RLS + grants.
- `src/lib/landing.functions.ts` — add `subscribeNewsletter` public server fn.
- `src/lib/admin.functions.ts` — add `listNewsletterSubscribers` (admin-gated).
- `src/components/hypeforce/landing-page.tsx` — new section between Pricing and FAQ, plus a small `NewsletterSignup` subcomponent.
- `src/routes/pretentious.landing.tsx` — append 5 newsletter copy fields and a Newsletter panel with the export.
