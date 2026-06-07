import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import appIcon from "@/assets/app-icon.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { sendVerificationEmail } from "@/lib/email-verification.functions";

const InfiniteGridBg = lazy(() =>
  import("@/components/hypeforce/infinite-grid-bg").then((m) => ({ default: m.InfiniteGridBg })),
);

const searchSchema = z.object({
  intent: z.enum(["founder"]).optional(),
  billing: z.enum(["monthly", "annual"]).optional(),
});

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Welcome to Hypeforce" }] }),
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app", replace: true });
  },
  component: WelcomePage,
});

type Stage = "intro" | "form";

function WelcomePage() {
  const navigate = useNavigate();
  const { intent, billing } = Route.useSearch();
  const [stage, setStage] = useState<Stage>("intro");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (intent) {
      try {
        sessionStorage.setItem(
          "hf_onboarding_intent",
          JSON.stringify({ intent, billing: billing ?? "monthly" }),
        );
      } catch {}
    }
  }, [intent, billing]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { display_name: name.trim() || email.split("@")[0] },
        },
      });
      if (error) throw error;
      // If email confirmation is required, no session is returned yet.
      if (data.session) {
        navigate({ to: "/app", replace: true });
      } else {
        toast.success("Check your email to confirm, then continue your setup.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't create your profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center px-4 py-8 relative">
      <ClientOnly fallback={null}>
        <InfiniteGridBg />
      </ClientOnly>

      <div className="w-full max-w-[440px] relative z-10 text-center">
        <img
          src={appIcon}
          alt="Hypeforce"
          className="w-24 h-24 mx-auto rounded-3xl ring-1 ring-border shadow-2xl mb-6"
        />

        {stage === "intro" ? (
          <>
            <div className="glass-strong rounded-3xl p-7 ring-glow text-left">
              <div className="font-mono text-xs text-muted-foreground mb-1">
                hype·force <span className="opacity-60">/ˈhīpfôrs/</span>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-electric mb-3">
                noun
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                A small team of humans and AI agents working in the same room — sharing context,
                briefing each other in channels, and shipping faster together than alone.
              </p>
              <div className="text-xs text-muted-foreground italic mt-3">
                "Our hypeforce got the launch out in three days."
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                onClick={() => setStage("form")}
                className="w-full h-12 text-base font-medium"
              >
                Create profile
              </Button>
              <Link
                to="/login"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                I already have an account · Log in
              </Link>
            </div>
          </>
        ) : (
          <>
            <form
              onSubmit={handleCreate}
              className="glass-strong rounded-3xl p-7 ring-glow text-left space-y-4"
            >
              <div>
                <h1 className="font-display text-xl">Create your profile</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  This is how your hypeforce will know you.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@studio.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-12">
                {submitting ? "…" : "Create profile"}
              </Button>
            </form>

            <div className="mt-4 text-sm text-muted-foreground space-y-1">
              <button
                type="button"
                onClick={() => setStage("intro")}
                className="hover:text-foreground transition-colors"
              >
                Back
              </button>
              <div>
                <Link to="/login" className="hover:text-foreground transition-colors">
                  Already have an account? Log in
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
