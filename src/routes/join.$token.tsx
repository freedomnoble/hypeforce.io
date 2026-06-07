import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { redeemInviteToken } from "@/lib/invites.functions";

export const Route = createFileRoute("/join/$token")({
  head: () => ({ meta: [{ title: "Join — Hypeforce" }] }),
  component: JoinPage,
});

const STORAGE_KEY = "hypeforce.pending_invite_token";

function JoinPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const redeem = useServerFn(redeemInviteToken);
  const [state, setState] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session?.user) {
        try {
          sessionStorage.setItem(STORAGE_KEY, token);
        } catch {}
        navigate({ to: "/login", replace: true });
        return;
      }
      try {
        await redeem({ data: { token } });
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {}
        navigate({ to: "/app", replace: true });
      } catch (e: any) {
        setState("error");
        setMessage(e?.message ?? "This invite link is no longer active.");
      }
    })();
    return () => {
      active = false;
    };
  }, [token, navigate, redeem]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-2xl px-6 py-5 max-w-md w-full text-center space-y-3">
        {state === "loading" ? (
          <div className="text-foreground font-display">Joining…</div>
        ) : (
          <>
            <div className="text-foreground font-display text-lg">Invite unavailable</div>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Link to="/" className="text-electric text-sm hover:underline inline-block">
              Back to home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export { STORAGE_KEY as PENDING_INVITE_KEY };
