import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ location }) => {
    // Use getSession() — it reads from storage and does not make a network
    // call. getUser() hits the network on every navigation and, when slow or
    // flaky, transiently returns no user, which used to redirect us to
    // /login → /app → / → here in an infinite loop.
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("[_auth] getSession error", error);
    }
    if (!data.session?.user) {
      console.log("[_auth] no session, redirecting to /login", {
        from: location.pathname,
      });
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
