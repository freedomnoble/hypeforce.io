import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ensureUserBootstrap } from "@/lib/bootstrap.functions";

export const Route = createFileRoute("/app")({
  component: Gateway,
});

type Status =
  | { kind: "loading"; step: "session" | "workspace" | "channel" | "bootstrap" }
  | { kind: "error"; message: string; detail?: string }
  | { kind: "no-session" };

function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log("[gateway]", ...args);
}

function Gateway() {
  const navigate = useNavigate();
  const ensureBootstrap = useServerFn(ensureUserBootstrap);
  const [status, setStatus] = useState<Status>({ kind: "loading", step: "session" });
  const [attempt, setAttempt] = useState(0);
  const inflight = useRef(false);
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (inflight.current || resolvedRef.current) return;
    inflight.current = true;
    let active = true;

    (async () => {
      try {
        setStatus({ kind: "loading", step: "session" });
        const { data: sess, error: sessErr } = await supabase.auth.getSession();
        if (!active) return;
        if (sessErr) {
          setStatus({ kind: "error", message: "Couldn't read your session.", detail: sessErr.message });
          return;
        }
        if (!sess.session?.user) {
          setStatus({ kind: "no-session" });
          navigate({ to: "/login", replace: true });
          return;
        }

        setStatus({ kind: "loading", step: "workspace" });
        const { data: ws, error: wsErr } = await supabase
          .from("workspaces")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!active) return;
        if (wsErr) {
          setStatus({
            kind: "error",
            message: "Couldn't reach the backend.",
            detail: `${wsErr.code ?? ""} ${wsErr.message}`.trim(),
          });
          return;
        }
        if (!ws) {
          setStatus({ kind: "loading", step: "bootstrap" });
          const repaired = await ensureBootstrap();
          if (!active) return;
          resolvedRef.current = true;
          navigate({
            to: "/w/$workspaceId/c/$channelId",
            params: { workspaceId: repaired.workspaceId, channelId: repaired.channelId },
            replace: true,
          });
          return;
        }

        setStatus({ kind: "loading", step: "channel" });
        const { data: ch } = await supabase
          .from("channels")
          .select("id")
          .eq("workspace_id", ws.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!active) return;
        if (ch) {
          resolvedRef.current = true;
          navigate({
            to: "/w/$workspaceId/c/$channelId",
            params: { workspaceId: ws.id, channelId: ch.id },
            replace: true,
          });
        } else {
          resolvedRef.current = true;
          navigate({ to: "/w/$workspaceId", params: { workspaceId: ws.id }, replace: true });
        }
      } catch (err: any) {
        log("error", err);
        if (!active) return;
        setStatus({
          kind: "error",
          message: "Something went wrong loading your workspace.",
          detail: err?.message ?? String(err),
        });
      } finally {
        inflight.current = false;
      }
    })();

    return () => {
      active = false;
    };
  }, [navigate, attempt]);

  const retry = () => {
    resolvedRef.current = false;
    inflight.current = false;
    setAttempt((a) => a + 1);
    setStatus({ kind: "loading", step: "session" });
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-2xl px-6 py-5 font-mono text-sm text-muted-foreground max-w-md w-full text-center space-y-3">
        {status.kind === "loading" && (
          <>
            <div className="text-foreground font-display text-base">loading workspace…</div>
            <div className="opacity-70">step: {status.step}</div>
          </>
        )}
        {status.kind === "no-session" && <div>redirecting to sign in…</div>}
        {status.kind === "error" && (
          <>
            <div className="text-foreground font-display text-base">{status.message}</div>
            {status.detail && <div className="opacity-70 break-words">{status.detail}</div>}
            <div className="flex gap-2 justify-center pt-1">
              <button onClick={retry} className="text-electric hover:underline">Retry</button>
              <span>·</span>
              <button onClick={signOut} className="text-electric hover:underline">Sign out</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
