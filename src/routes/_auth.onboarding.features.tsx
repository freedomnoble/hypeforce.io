import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { OnboardingLayout, StepTitle } from "@/components/onboarding/OnboardingLayout";
import { advanceStep } from "@/lib/onboarding.functions";
import { useOnboardingState } from "@/lib/onboarding-query";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";
import { redeemInviteToken, requestTrialCancellation } from "@/lib/invites.functions";
import { PENDING_INVITE_KEY } from "@/routes/join.$token";
import { Users, AtSign, Pin, FileText, MessageCircle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_auth/onboarding/features")({
  component: FeaturesStep,
});

const FEATURES = [
  { icon: Users, title: "Channels with your AI team", text: "Briefing one agent or all of them is just a message." },
  { icon: AtSign, title: "@-mention to target", text: "Address one teammate, leave the rest watching." },
  { icon: Pin, title: "Pinned context, always", text: "Pin briefs and docs so every agent stays aligned." },
  { icon: FileText, title: "Brand voice baked in", text: "Drop your guidelines once, every reply matches your tone." },
  { icon: MessageCircle, title: "DMs with any agent", text: "Quick one-on-ones when you need a fast answer." },
];

const INTENT_KEY = "hf_subscribe_intent";

function FeaturesStep() {
  const navigate = useNavigate();
  const advance = useServerFn(advanceStep);
  const { data, patch } = useOnboardingState();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();

  const alreadySubscribed = !!(data?.has_active_subscription || data?.is_comped);
  const [intentGiven, setIntentGiven] = useState<boolean>(false);
  const [continuing, setContinuing] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const redeem = useServerFn(redeemInviteToken);
  const cancelTrial = useServerFn(requestTrialCancellation);
  const { invalidate } = useOnboardingState();

  const trialEndsMs = data?.trial_ends_at ? new Date(data.trial_ends_at).getTime() : 0;
  const trialActive = !!trialEndsMs && trialEndsMs > Date.now();
  const hoursLeft = trialActive ? Math.max(0, Math.ceil((trialEndsMs - Date.now()) / 3_600_000)) : 0;
  const isLastDay = trialActive && hoursLeft <= 24;
  const alreadyCancelled = !!data?.trial_cancel_requested_at || cancelRequested;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(INTENT_KEY) === "1") setIntentGiven(true);
    } catch {}
  }, []);

  // Redeem any pending invite token so invited users see "Gifted" here,
  // not "Subscribe". The /app fallback only fires after onboarding completes.
  useEffect(() => {
    if (!data || data.is_comped) return;
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(PENDING_INVITE_KEY);
    } catch {}
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        await redeem({ data: { token: token! } });
        try {
          sessionStorage.removeItem(PENDING_INVITE_KEY);
        } catch {}
        if (!cancelled) await invalidate();
      } catch {
        // Leave token in place — /app will retry after onboarding.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, redeem, invalidate]);

  const canContinue = intentGiven || alreadySubscribed;


  const onSubscribe = async () => {
    setIntentGiven(true);
    try {
      sessionStorage.setItem(INTENT_KEY, "1");
    } catch {}
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
      customerEmail: data?.email ?? u.user?.email,
      customData: { userId: u.user?.id ?? "", onboarding: "1" },
      successUrl: `${window.location.origin}/onboarding/features?checkout=success`,
    });
  };

  const onContinue = async () => {
    if (!canContinue || continuing) return;
    setContinuing(true);
    patch({ step: 4 });
    navigate({ to: "/onboarding/invites", replace: true });
    // Fire-and-forget; webhook is source of truth for actual subscription state.
    advance({ data: { to: 4 } }).catch((e) => {
      console.error("[onboarding] advance failed", e);
    });
  };

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

      <Button
        onClick={onSubscribe}
        disabled={checkoutLoading || alreadySubscribed || !!(data?.trial_ends_at && new Date(data.trial_ends_at) > new Date())}
        variant={alreadySubscribed || data?.trial_ends_at ? "secondary" : "default"}
        className="w-full h-12 text-base disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {checkoutLoading
          ? "Opening checkout…"
          : data?.is_comped
            ? "Gifted"
            : data?.has_active_subscription
              ? "Subscribed"
              : data?.trial_ends_at && new Date(data.trial_ends_at) > new Date()
                ? "5-day free trial"
                : "Subscribe"}
      </Button>

      <Button
        onClick={onContinue}
        disabled={!canContinue || continuing}
        variant="ghost"
        className="w-full h-11 mt-2"
      >
        Continue
      </Button>

      <p className="text-center text-xs text-muted-foreground mt-3">
        Cancel anytime. Your data is yours, always.
      </p>
    </OnboardingLayout>
  );
}
