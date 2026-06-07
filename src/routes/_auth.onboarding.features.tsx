import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { OnboardingLayout, StepTitle } from "@/components/onboarding/OnboardingLayout";
import { advanceStep, getOnboardingState } from "@/lib/onboarding.functions";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";
import { Users, AtSign, Pin, FileText, MessageCircle, Sparkles, Check } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ checkout: z.enum(["success"]).optional() });

export const Route = createFileRoute("/_auth/onboarding/features")({
  validateSearch: searchSchema,
  component: FeaturesStep,
});

const FEATURES = [
  { icon: Users, title: "Channels with your AI team", text: "Briefing one agent or all of them is just a message." },
  { icon: AtSign, title: "@-mention to target", text: "Address one teammate, leave the rest watching." },
  { icon: Pin, title: "Pinned context, always", text: "Pin briefs and docs so every agent stays aligned." },
  { icon: FileText, title: "Brand voice baked in", text: "Drop your guidelines once, every reply matches your tone." },
  { icon: MessageCircle, title: "DMs with any agent", text: "Quick one-on-ones when you need a fast answer." },
];

function FeaturesStep() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_auth/onboarding/features" });
  const fetchState = useServerFn(getOnboardingState);
  const advance = useServerFn(advanceStep);
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();

  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await fetchState();
      setEmail(s.email);
      // Comped or already subscribed: skip this step entirely.
      if (s.is_comped || s.has_active_subscription) {
        await advance({ data: { to: 4 } });
        navigate({ to: "/onboarding/invites", replace: true });
        return;
      }
      // Returning from successful Paddle checkout
      if (search.checkout === "success") {
        setConfirming(true);
        await advance({ data: { to: 4 } });
        setTimeout(() => navigate({ to: "/onboarding/invites", replace: true }), 2200);
        return;
      }
      setLoading(false);
    })();
  }, [fetchState, advance, navigate, search.checkout]);

  const onSubscribe = async () => {
    const { data: u } = await supabase.auth.getUser();
    await openCheckout({
      priceId: "founder_monthly",
      customerEmail: email ?? u.user?.email,
      customData: { userId: u.user?.id ?? "", onboarding: "1" },
      successUrl: `${window.location.origin}/onboarding/features?checkout=success`,
    });
  };

  if (confirming) {
    return (
      <OnboardingLayout step={4}>
        <div className="py-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-electric/15 grid place-items-center mb-4">
            <Check className="w-8 h-8 text-electric" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">You're in!</h1>
          <p className="text-sm text-muted-foreground">Setting up the next step…</p>
        </div>
      </OnboardingLayout>
    );
  }

  if (loading) {
    return (
      <OnboardingLayout step={4}>
        <div className="h-60 grid place-items-center text-sm text-muted-foreground">loading…</div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout step={4}>
      <StepTitle subtitle="Built for alignment and shared context. No prompt engineering required.">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-electric" />
          Everything you get
        </span>
      </StepTitle>

      <ul className="space-y-3 mb-6">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-foreground/[0.05] grid place-items-center shrink-0">
              <f.icon className="w-4 h-4 text-electric" />
            </div>
            <div>
              <div className="text-sm font-medium">{f.title}</div>
              <div className="text-xs text-muted-foreground">{f.text}</div>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl bg-gradient-to-br from-electric/15 to-primary/10 p-5 border border-electric/30 text-center mb-3">
        <div className="flex items-baseline justify-center gap-2 mb-1">
          <span className="font-display text-4xl font-bold">$9</span>
          <span className="text-sm text-muted-foreground">/month</span>
          <span className="text-base text-muted-foreground line-through ml-1">$19</span>
        </div>
        <div className="text-xs text-muted-foreground">Founding price · locked in</div>
      </div>

      <Button onClick={onSubscribe} disabled={checkoutLoading} className="w-full h-12 text-base">
        {checkoutLoading ? "Opening checkout…" : "Subscribe"}
      </Button>
      <p className="text-center text-xs text-muted-foreground mt-3">
        Cancel anytime. Your data is yours, always.
      </p>
    </OnboardingLayout>
  );
}
