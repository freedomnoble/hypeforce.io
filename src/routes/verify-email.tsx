import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  confirmEmailVerification,
  sendVerificationEmail,
  getEmailVerificationStatus,
} from "@/lib/email-verification.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import appIcon from "@/assets/app-icon.png";

const search = z.object({ token: z.string().uuid().optional() });

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Verify your email" }] }),
  validateSearch: search,
  component: VerifyEmailPage,
});

type State = "idle" | "verifying" | "success" | "expired" | "error";

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const confirm = useServerFn(confirmEmailVerification);
  const resend = useServerFn(sendVerificationEmail);
  const status = useServerFn(getEmailVerificationStatus);
  const [state, setState] = useState<State>(token ? "verifying" : "idle");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    status()
      .then((r) => setEmail(r.email))
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (!token) return;
    confirm({ data: { token } })
      .then((r) => {
        if (r.ok) setState("success");
        else setState("expired");
      })
      .catch(() => setState("error"));
  }, [token, confirm]);

  const handleResend = async () => {
    try {
      const r = await resend();
      if (r.alreadyVerified) {
        setState("success");
        return;
      }
      if (r.throttled) {
        toast.message("Just sent — please check your inbox.");
        return;
      }
      toast.success("Verification email sent. Check your inbox.");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't send verification email");
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <img
          src={appIcon}
          alt="Hypeforce"
          className="w-20 h-20 mx-auto rounded-2xl ring-1 ring-border"
        />
        <div className="glass-strong rounded-2xl p-7 space-y-4">
          {state === "verifying" && (
            <>
              <h1 className="font-display text-xl">Verifying…</h1>
              <p className="text-sm text-muted-foreground">One moment.</p>
            </>
          )}
          {state === "success" && (
            <>
              <h1 className="font-display text-xl">Email verified</h1>
              <p className="text-sm text-muted-foreground">
                You can now invite teammates and create additional channels and workspaces.
              </p>
              <Button asChild className="w-full">
                <Link to="/app">Continue</Link>
              </Button>
            </>
          )}
          {(state === "expired" || state === "error") && (
            <>
              <h1 className="font-display text-xl">Link expired</h1>
              <p className="text-sm text-muted-foreground">
                Send a fresh verification email and try again.
              </p>
              <Button onClick={handleResend} className="w-full">
                Resend verification email
              </Button>
            </>
          )}
          {state === "idle" && (
            <>
              <h1 className="font-display text-xl">Verify your email</h1>
              <p className="text-sm text-muted-foreground">
                {email ? (
                  <>We'll send a link to <span className="text-foreground">{email}</span>.</>
                ) : (
                  <>We'll send a verification link to your email.</>
                )}
              </p>
              <Button onClick={handleResend} className="w-full">
                Send verification email
              </Button>
              <div className="text-xs text-muted-foreground pt-2">
                <Link to="/app" className="hover:text-foreground">
                  Back to app
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
