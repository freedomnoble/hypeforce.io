/**
 * Pure handler factory for Supabase auth events.
 *
 * Background: `supabase.auth.onAuthStateChange` fires on many events that are
 * NOT real sign-in/sign-out transitions — `INITIAL_SESSION`, `TOKEN_REFRESHED`,
 * `USER_UPDATED`, and even spuriously after `getUser()` calls. If we invalidate
 * the router / query cache on every event, loaders re-run, call `getUser()`,
 * which triggers another event, which invalidates again → infinite loop.
 *
 * This handler only invokes `onTransition` when the user identity actually
 * changes (signed in for the first time, signed out, or switched user).
 *
 * Exported separately so it can be unit-tested without React / the router.
 */

export type AuthEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"
  | "MFA_CHALLENGE_VERIFIED"
  | (string & {});

export interface AuthSessionLike {
  user?: { id?: string | null } | null;
}

export interface AuthInvalidationHandler {
  (event: AuthEvent, session: AuthSessionLike | null): void;
}

export function createAuthInvalidationHandler(
  onTransition: (userId: string | null) => void,
): AuthInvalidationHandler {
  // `undefined` sentinel so the very first SIGNED_IN with a real user fires,
  // but repeated SIGNED_IN events for the same user do not.
  let lastUserId: string | null | undefined = undefined;

  return (event, session) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
    const uid = session?.user?.id ?? null;
    if (uid === lastUserId) return;
    lastUserId = uid;
    onTransition(uid);
  };
}
