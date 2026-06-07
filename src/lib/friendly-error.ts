/**
 * Produce a short, user-safe error message.
 * Server functions can occasionally return our SSR fallback HTML page on a
 * 500, in which case `error.message` is the entire HTML document. Never
 * surface that — it looks broken and is unreadable in a toast.
 */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!raw) return fallback;
  const trimmed = raw.trim();
  // Detect HTML / DOCTYPE responses (SSR error page, gateway errors, etc.)
  if (/^<!?(doctype|html)/i.test(trimmed) || /<\/?(html|body|head|div|style)/i.test(trimmed)) {
    return fallback;
  }
  // Detect generic h3 JSON envelope
  if (trimmed.includes('"unhandled":true') && trimmed.includes('"HTTPError"')) {
    return fallback;
  }
  // Cap very long messages
  if (trimmed.length > 240) return fallback;
  return trimmed;
}
