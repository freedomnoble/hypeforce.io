import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Gateway,
});

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "no-workspace" };

function Gateway() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!active) return;
        if (!sess.session?.user) {
          navigate({ to: "/login", replace: true });
          return;
        }

        const { data: ws, error: wsErr } = await supabase
          .from("workspaces")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!active) return;
        if (wsErr) {
          setStatus({ kind: "error", message: wsErr.message });
          return;
        }
        if (!ws) {
          // Authenticated but no workspace yet — do NOT bounce to /login
          // (causes a redirect loop because /login has a session and forwards
          // to /app → /).
          setStatus({ kind: "no-workspace" });
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
          navigate({
            to: "/w/$workspaceId/c/$channelId",
            params: { workspaceId: ws.id, channelId: ch.id },
            replace: true,
          });
        } else {
          navigate({
            to: "/w/$workspaceId",
            params: { workspaceId: ws.id },
            replace: true,
          });
        }
      } catch (err: any) {
        if (!active) return;
        setStatus({ kind: "error", message: err?.message ?? "Network error" });
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-2xl px-6 py-5 font-mono text-sm text-muted-foreground max-w-md text-center space-y-3">
        {status.kind === "loading" && <div>loading workspace…</div>}
        {status.kind === "no-workspace" && (
          <>
            <div className="text-foreground font-display text-base">
              No workspace yet
            </div>
            <div>Your account has no workspace. Sign out and back in to seed one, or contact your admin.</div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/login", replace: true });
              }}
              className="text-electric hover:underline"
            >
              Sign out
            </button>
          </>
        )}
        {status.kind === "error" && (
          <>
            <div className="text-foreground font-display text-base">Couldn't reach the backend</div>
            <div className="opacity-80">{status.message}</div>
            <button
              onClick={() => window.location.reload()}
              className="text-electric hover:underline"
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
