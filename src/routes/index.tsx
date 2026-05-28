import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Gateway,
});

function Gateway() {
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!active) return;
      if (!u.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (!ws) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const { data: ch } = await supabase
        .from("channels")
        .select("id")
        .eq("workspace_id", ws.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (ch) {
        navigate({ to: "/w/$workspaceId/c/$channelId", params: { workspaceId: ws.id, channelId: ch.id }, replace: true });
      } else {
        navigate({ to: "/w/$workspaceId", params: { workspaceId: ws.id }, replace: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass rounded-2xl px-6 py-4 font-mono text-sm text-muted-foreground">
        loading workspace…
      </div>
    </div>
  );
}
