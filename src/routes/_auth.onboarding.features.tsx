import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { OnboardingLayout, StepTitle } from "@/components/onboarding/OnboardingLayout";
import { advanceStep, getOnboardingState } from "@/lib/onboarding.functions";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";
import { Users, AtSign, Pin, FileText, MessageCircle, Sparkles, Check, RefreshCw } from "lucide-react";
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

  
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const advancedRef = useRef(false);

  const advanceAndGo = useCallback(async () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    try {
      await advance({ data: { to: 4 } });
    } catch (e) {
      console.error("[onboarding] advance failed", e);
    }
    setTimeout(() => navigate({ to: "/onboarding/invites", replace: true }), 800);
  }, [advance, navigate]);

  // Poll once for active subscription. Returns true if found.
  const pollForSubscription = useCallback(
    async (maxAttempts = 8, intervalMs = 1500) => {
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const s = await fetchState();
          if (s.has_active_subscription || s.is_comped) return true;
        } catch {}
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      return false;
    },
    [fetchState],
  );

  const handleCheckAgain = useCallback(async () => {
    if (checking || confirming) return;
    setChecking(true);
    setSyncMessage(null);
    try {
      // Quick check first
      const s = await fetchState();
      if (s.is_comped || s.has_active_subscription) {
        setConfirming(true);
        await advanceAndGo();
        return;
      }
      // Then poll briefly in case the webhook is still in-flight
      const found = await pollForSubscription(6, 1500);
      if (found) {
        setConfirming(true);
        await advanceAndGo();
      } else {
        setSyncMessage("Payment is still syncing. Try again in a moment.");
      }
    } catch (e: any) {
      setSyncMessage(e?.message ?? "Couldn't check payment status. Try again.");
    } finally {
      setChecking(false);
    }
  }, [checking, confirming, fetchState, pollForSubscription, advanceAndGo]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await fetchState();
        if (!active) return;
        setEmail(s.email);
        if (s.is_comped || s.has_active_subscription) {
          setConfirming(true);
          await advanceAndGo();
          return;
        }
        if (search.checkout === "success") {
          setConfirming(true);
          const found = await pollForSubscription();
          if (found) {
            await advanceAndGo();
          } else {
            // Webhook delayed — drop back to subscribe screen with a sync notice
            if (!active) return;
            setConfirming(false);
            setSyncMessage("Payment is still syncing. Tap “I’ve paid — check again”.");
            setLoading(false);
          }
          return;
        }
        setLoading(false);
      } catch (e) {
        console.error("[onboarding] features init failed", e);
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchState, advanceAndGo, pollForSubscription, search.checkout]);

  const onSubscribe = async () => {
    const { data: u } = await supabase.auth.getUser();
    let billing: "monthly" | "annual" = "monthly";
    try {
      const raw = sessionStorage.getItem("hf_onboarding_intent");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.billing === "annual") billing = "annual";
      }
    } catch {}
    await openCheckout({
      priceId: billing === "annual" ? "founder_annual" : "founder_monthly",
      customerEmail: email ?? u.user?.email,
      customData: { userId: u.user?.id ?? "", onboarding: "1" },
      successUrl: `${window.location.origin}/onboarding/features?checkout=success`,
      onEvent: (event: any) => {
        if (event?.name === "checkout.completed" && !confirming) {
          setConfirming(true);
          (async () => {
            await pollForSubscription();
            await advanceAndGo();
          })();
        }
      },
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
          <Button
            variant="ghost"
            className="mt-6"
            onClick={() => navigate({ to: "/onboarding/invites", replace: true })}
          >
            Continue
          </Button>
        </div>
      </OnboardingLayout>
    );
  }

  // No loading gate: the subscribe screen is static content, so render it
  // immediately. Background state fetch will auto-advance if subscribed.


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

      <Button onClick={onSubscribe} disabled={checkoutLoading || checking} className="w-full h-12 text-base">
        {checkoutLoading ? "Opening checkout…" : "Subscribe"}
      </Button>

      <button
        type="button"
        onClick={handleCheckAgain}
        disabled={checking}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 text-sm text-electric hover:underline disabled:opacity-60"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
        {checking ? "Checking…" : "I’ve paid — check again"}
      </button>

      {syncMessage && (
        <p className="text-center text-xs text-muted-foreground mt-3">{syncMessage}</p>
      )}

      <p className="text-center text-xs text-muted-foreground mt-3">
        Cancel anytime. Your data is yours, always.
      </p>
    </OnboardingLayout>
  );
}
