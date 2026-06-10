// Translates raw Supabase/Postgres send errors into customer-facing strings.
export function friendlySendError(e: unknown): string {
  const err = e as { code?: string; message?: string } | null | undefined;
  const code = err?.code ?? "";
  const msg = (err?.message ?? "").toLowerCase();
  if (
    code === "42501" ||
    msg.includes("row-level security") ||
    msg.includes("permission denied")
  ) {
    return "Couldn't send your message. Please refresh and try again — if it keeps happening, contact support.";
  }
  return "Couldn't send your message. Please try again.";
}
