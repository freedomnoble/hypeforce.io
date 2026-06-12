// Translates raw Supabase/Postgres send errors into customer-facing strings.
// Returns a small object so callers can branch on trial/sub expiry.
export type FriendlySendError = {
  message: string;
  /** True when the failure looks like the trial/sub gate (RLS / can_send_message). */
  paywall: boolean;
};

export function friendlySendError(e: unknown): FriendlySendError {
  const err = e as { code?: string; message?: string } | null | undefined;
  const code = err?.code ?? "";
  const msg = (err?.message ?? "").toLowerCase();
  const rls =
    code === "42501" ||
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("can_send_message");
  if (rls) {
    return {
      message: "Your free trial has ended. Subscribe to keep sending messages.",
      paywall: true,
    };
  }
  return { message: "Couldn't send your message. Please try again.", paywall: false };
}
