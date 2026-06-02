import { createFileRoute, redirect } from "@tanstack/react-router";

// Backward-compatible alias for old links / email templates that still point
// at /app. Use `replace: true` so we don't accumulate history entries, and
// resolve in beforeLoad so no UI ever mounts here (no extra loading hop).
export const Route = createFileRoute("/app")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
