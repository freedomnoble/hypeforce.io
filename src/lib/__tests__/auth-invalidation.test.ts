import { describe, it, expect, vi } from "vitest";
import {
  createAuthInvalidationHandler,
  type AuthEvent,
  type AuthSessionLike,
} from "@/lib/auth-invalidation";

const session = (id: string | null): AuthSessionLike | null =>
  id === null ? null : { user: { id } };

describe("createAuthInvalidationHandler", () => {
  it("ignores INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED bursts", () => {
    const onTransition = vi.fn();
    const handler = createAuthInvalidationHandler(onTransition);

    const noisyEvents: AuthEvent[] = [
      "INITIAL_SESSION",
      "TOKEN_REFRESHED",
      "USER_UPDATED",
      "TOKEN_REFRESHED",
      "INITIAL_SESSION",
      "PASSWORD_RECOVERY",
      "MFA_CHALLENGE_VERIFIED",
    ];
    for (const e of noisyEvents) handler(e, session("user-1"));

    expect(onTransition).not.toHaveBeenCalled();
  });

  it("uses INITIAL_SESSION as a baseline without invalidating", () => {
    const onTransition = vi.fn();
    const handler = createAuthInvalidationHandler(onTransition);

    handler("INITIAL_SESSION", session("user-1"));
    handler("TOKEN_REFRESHED", session("user-1"));
    handler("USER_UPDATED", session("user-1"));
    handler("SIGNED_IN", session("user-1"));

    expect(onTransition).not.toHaveBeenCalled();
  });

  it("fires exactly once for a real SIGNED_IN, even with repeats", () => {
    const onTransition = vi.fn();
    const handler = createAuthInvalidationHandler(onTransition);

    // Simulate the exact storm seen in production auth logs: SIGNED_IN
    // followed by hundreds of TOKEN_REFRESHED / USER_UPDATED events for the
    // same user, plus duplicate SIGNED_IN re-emissions.
    handler("SIGNED_IN", session("user-1"));
    for (let i = 0; i < 500; i++) {
      handler("TOKEN_REFRESHED", session("user-1"));
      handler("USER_UPDATED", session("user-1"));
      if (i % 10 === 0) handler("SIGNED_IN", session("user-1"));
    }

    expect(onTransition).toHaveBeenCalledTimes(1);
    expect(onTransition).toHaveBeenCalledWith("user-1");
  });

  it("fires on SIGNED_OUT after a SIGNED_IN", () => {
    const onTransition = vi.fn();
    const handler = createAuthInvalidationHandler(onTransition);

    handler("SIGNED_IN", session("user-1"));
    handler("TOKEN_REFRESHED", session("user-1"));
    handler("SIGNED_OUT", null);
    handler("INITIAL_SESSION", null);

    expect(onTransition).toHaveBeenCalledTimes(2);
    expect(onTransition).toHaveBeenNthCalledWith(1, "user-1");
    expect(onTransition).toHaveBeenNthCalledWith(2, null);
  });

  it("fires on user switch (SIGNED_IN with a different user id)", () => {
    const onTransition = vi.fn();
    const handler = createAuthInvalidationHandler(onTransition);

    handler("SIGNED_IN", session("user-1"));
    handler("SIGNED_IN", session("user-1")); // duplicate, ignored
    handler("SIGNED_IN", session("user-2")); // switch, fires
    handler("SIGNED_IN", session("user-2")); // duplicate, ignored

    expect(onTransition).toHaveBeenCalledTimes(2);
    expect(onTransition).toHaveBeenNthCalledWith(1, "user-1");
    expect(onTransition).toHaveBeenNthCalledWith(2, "user-2");
  });

  it("survives a rapid mixed storm without runaway invalidations", () => {
    const onTransition = vi.fn();
    const handler = createAuthInvalidationHandler(onTransition);

    // Mixed storm: one real sign-in, lots of noise, one real sign-out.
    handler("SIGNED_IN", session("user-1"));
    const noise: AuthEvent[] = [
      "TOKEN_REFRESHED",
      "USER_UPDATED",
      "INITIAL_SESSION",
      "SIGNED_IN", // duplicate
    ];
    for (let i = 0; i < 1000; i++) {
      handler(noise[i % noise.length]!, session("user-1"));
    }
    handler("SIGNED_OUT", null);
    for (let i = 0; i < 1000; i++) {
      handler(noise[i % noise.length]!, null);
    }

    // Exactly two real transitions, regardless of storm size.
    expect(onTransition).toHaveBeenCalledTimes(2);
    expect(onTransition).toHaveBeenNthCalledWith(1, "user-1");
    expect(onTransition).toHaveBeenNthCalledWith(2, null);
  });

  it("does not fire when SIGNED_OUT arrives before any sign-in (no-op session)", () => {
    const onTransition = vi.fn();
    const handler = createAuthInvalidationHandler(onTransition);

    // Initial signed-out state is only a baseline, not a transition. This
    // avoids invalidating the public/login route on startup.
    handler("SIGNED_OUT", null);
    handler("SIGNED_OUT", null);
    handler("SIGNED_OUT", null);

    expect(onTransition).not.toHaveBeenCalled();
  });
});
