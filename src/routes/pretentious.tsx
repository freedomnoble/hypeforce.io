import { createFileRoute, redirect, Outlet, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { checkSuperAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/pretentious")({
  ssr: false,
  component: PretentiousLayout,
});

function PretentiousLayout() {
  const [state, setState] = useState<"checking" | "ok" | "no-auth" | "not-admin">("checking");
  const check = useServerFn(checkSuperAdmin);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        if (active) setState("no-auth");
        return;
      }
      try {
        const res = await check();
        if (!active) return;
        setState(res.isSuperAdmin ? "ok" : "not-admin");
      } catch {
        if (active) setState("not-admin");
      }
    })();
    return () => {
      active = false;
    };
  }, [check]);

  if (state === "checking") {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white/50 text-sm font-mono">
        verifying access…
      </div>
    );
  }
  if (state === "no-auth") return <Navigate to="/login" />;
  if (state === "not-admin") return <Navigate to="/" />;

  return <AdminShell />;
}
