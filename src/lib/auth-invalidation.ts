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
  // `undefined` means we have not observed the initial auth snapshot yet.
  // INITIAL_SESSION establishes that baseline without invalidating the app;
  // only later identity transitions should re-run protected route loaders.
  let lastUserId: string | null | undefined = undefined;

  return (event, session) => {
    const uid = session?.user?.id ?? null;

    if (event === "INITIAL_SESSION") {
      lastUserId = uid;
      return;
    }

    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;

    if (lastUserId === undefined) {
      lastUserId = uid;
      if (uid === null) return;
      onTransition(uid);
      return;
    }

    if (uid === lastUserId) return;
    lastUserId = uid;
    onTransition(uid);
  };
}
