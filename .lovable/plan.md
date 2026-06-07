## Goal
Stop using `/login` for account/profile creation. `/login` should only be for returning users. New users should enter the custom Hypeforce onboarding flow from `/welcome`, create their profile there, then continue into the wireframed steps.

## Plan

1. **Turn `/welcome` into the true onboarding entry**
   - Replace the current **Create profile** link that points to `/login?mode=signup`.
   - Add an inline create-profile form or first-step action on `/welcome` matching the dictionary-definition title screen.
   - Keep the existing **Log in** action pointing to `/login` only.

2. **Create users from the custom flow**
   - On `/welcome`, call the auth signup flow directly instead of routing to `/login`.
   - Use copy/labels like **Create profile**, not **Create account**.
   - Send email confirmation redirects to `/app`, so confirmed users are routed through the onboarding gate and resume at `/onboarding`.
   - Store founder intent/billing in session storage as already started, so the features step can use the right plan.

3. **Make `/login` signup fall into onboarding too**
   - If someone still uses the signup mode on `/login`, update the post-signup messaging/redirect behavior so it does not become a separate onboarding path.
   - After confirmation/sign-in, `/app` already gates incomplete users to `/onboarding`; preserve that.

4. **Fix the first onboarding step mapping**
   - Ensure a newly created profile starts at the custom step after `/welcome` rather than bouncing through `/login`.
   - The current `/onboarding` index maps step `0/1` to `/onboarding/team`; keep that as the next step after the title/create-profile screen unless the existing database default needs a small adjustment.

5. **Guard against accidental `/login` redirects**
   - Search create-profile/founder/signup links and replace any remaining account-creation navigation to `/login` with `/welcome`.
   - Leave only explicit returning-user login links pointing to `/login`.

## Technical notes
- Expected files: `src/routes/welcome.tsx`, `src/routes/login.tsx`, and possibly `src/components/hypeforce/landing-page.tsx` if another signup CTA still points at login.
- No new database tables are needed.
- The existing profile trigger and onboarding columns can continue to create the backend records; the custom flow controls the user-facing path and redirect behavior.