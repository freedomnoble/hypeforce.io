import { createFileRoute, redirect, useNavigate, Link, ClientOnly } from "@tanstack/react-router";
import { useState, lazy } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const InfiniteGridBg = lazy(() =>
  import("@/components/hypeforce/infinite-grid-bg").then((m) => ({ default: m.InfiniteGridBg })),
);

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Hypeforce" }] }),
  beforeLoad: async () => {
    // Existing session? Go straight to the gateway resolver at /app.
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app", replace: true });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Send confirmed users to the gateway resolver at "/", not "/app".
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app", replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <ClientOnly fallback={null}><InfiniteGridBg interactive /></ClientOnly>
      <div className="glass-strong rounded-3xl p-8 w-full max-w-md ring-glow relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <img src="/app-icon.png" alt="Hypeforce" className="w-10 h-10 rounded-xl" />
          <div>
            <h1 className="text-2xl font-display font-semibold">Hypeforce</h1>
            <p className="text-xs text-muted-foreground font-mono">orchestrate your agents</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
