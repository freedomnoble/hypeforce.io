import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SafeBg } from "@/components/hypeforce/safe-bg";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Hypeforce" }] }),
  beforeLoad: async () => {
    // Existing session? Go straight to the gateway resolver at /app.
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app", replace: true });
  },
  component: LoginPage,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="glass rounded-2xl px-6 py-5 max-w-md w-full text-center space-y-3">
        <div className="font-display text-base">This page didn't load.</div>
        <div className="text-xs text-muted-foreground break-words">
          {error?.message ?? "Unknown error"}
        </div>
        <button
          onClick={() => {
            reset();
            window.location.reload();
          }}
          className="text-electric hover:underline text-sm"
        >
          Retry
        </button>
      </div>
    </div>
  ),
});

type Mode = "signin" | "forgot";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a reset link.");
        setMode("signin");
      } else {
        // Preview's fetch proxy can occasionally hang Supabase auth POSTs,
        // leaving the button stuck on "…". Race with a timeout so the user
        // can retry instead of waiting forever.
        const result = await Promise.race([
          supabase.auth.signInWithPassword({ email, password }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Sign-in timed out. Try again, or use the published site.")), 15000),
          ),
        ]);
        if (result.error) throw result.error;
        navigate({ to: "/app", replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "signin" ? "Sign in" : "Send reset link";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <SafeBg interactive />
      <div className="glass-strong rounded-3xl p-8 w-full max-w-md ring-glow relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <img src="/app-icon.png" alt="Hypeforce" className="w-10 h-10 rounded-xl" />
          <div>
            <h1 className="text-2xl font-display font-semibold">Hypeforce</h1>
            <p className="text-xs text-muted-foreground font-mono">orchestrate your agents</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {null}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "..." : title}
          </Button>
        </form>

        <div className="mt-4 text-sm text-muted-foreground text-center space-y-1">
          {mode === "forgot" ? (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="hover:text-foreground transition-colors"
            >
              Back to sign in
            </button>
          ) : (
            <Link
              to="/welcome"
              className="hover:text-foreground transition-colors w-full block"
            >
              Need an account? Create profile
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

