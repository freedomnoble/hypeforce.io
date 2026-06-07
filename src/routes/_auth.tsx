import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_auth")({
  // Auth state lives in localStorage (browser-only). Running beforeLoad on
  // the server (SSR/prerender) sees no session and redirects to /login,
  // which then sees a session client-side and redirects back to /app —
  // producing the visible /app ↔ /login loop after signup. Client-only
  // gating eliminates that race.
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession reads from storage and does not make a network call.
    let { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("[_auth] getSession error", error);
    }
    if (!data.session?.user) {
      // Brief retry: post-signup flushes the session to localStorage
      // asynchronously, so the very first read can come back empty.
      await new Promise((r) => setTimeout(r, 250));
      const retry = await supabase.auth.getSession();
      data = retry.data;
    }
    if (!data.session?.user) {
      console.log("[_auth] no session, redirecting to /login", {
        from: location.pathname,
      });
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: () => <Outlet />,
});
