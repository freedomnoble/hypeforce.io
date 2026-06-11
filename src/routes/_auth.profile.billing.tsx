import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getMyBilling,
  cancelMySubscription,
  reactivateMySubscription,
  getCustomerPortalUrl,
} from "@/lib/billing.functions";
import { ArrowLeft, CreditCard, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_auth/profile/billing")({
  component: BillingPage,
  head: () => ({ meta: [{ title: "Billing — Hypeforce" }] }),
});

function fmtMoney(cents?: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtDate(s?: string | null) {
  return s ? new Date(s).toLocaleDateString() : "—";
}

function BillingPage() {
  const qc = useQueryClient();
  const fetchBilling = useServerFn(getMyBilling);
  const cancel = useServerFn(cancelMySubscription);
  const reactivate = useServerFn(reactivateMySubscription);
  const getPortal = useServerFn(getCustomerPortalUrl);
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["billing", "me"],
    queryFn: () => fetchBilling(),
    refetchOnWindowFocus: true,
  });
  const sub = data?.subscription as any;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["billing"] });

  const onSubscribe = async (plan: "monthly" | "annual") => {
    setBusy(`subscribe-${plan}`);
    try {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) {
        toast.error("Please sign in to subscribe");
        return;
      }
      await openCheckout({
        priceId: plan === "annual" ? "founder_annual" : "founder_monthly",
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id },
        successUrl: `${window.location.origin}/profile/billing?checkout=success`,
        onEvent: (e: any) => {
          if (e?.name === "checkout.completed") {
            toast.success("Payment received — your subscription is being activated");
            invalidate();
          }
        },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed");
    } finally {
      setBusy(null);
    }
  };


  const onCancel = async () => {
    if (!sub) return;
    if (!confirm("Cancel at the end of the current billing period?")) return;
    setBusy("cancel");
    try {
      await cancel({
        data: {
          paddle_subscription_id: sub.paddle_subscription_id,
          environment: sub.environment,
        },
      });
      toast.success("Cancellation scheduled");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to cancel");
    } finally {
      setBusy(null);
    }
  };

  const onReactivate = async () => {
    if (!sub) return;
    setBusy("reactivate");
    try {
      await reactivate({
        data: {
          paddle_subscription_id: sub.paddle_subscription_id,
          environment: sub.environment,
        },
      });
      toast.success("Subscription resumed");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reactivate");
    } finally {
      setBusy(null);
    }
  };

  const onPortal = async () => {
    if (!sub) return;
    setBusy("portal");
    try {
      const res = await getPortal({
        data: {
          paddle_subscription_id: sub.paddle_subscription_id,
          environment: sub.environment,
        },
      });
      const url = res?.overview ?? null;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("Could not open billing portal");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to open portal");
    } finally {
      setBusy(null);
    }
  };

  const isActive =
    sub && ["active", "trialing", "past_due"].includes(sub.status);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/profile">
          <ArrowLeft className="w-4 h-4 mr-1" /> Profile
        </Link>
      </Button>

      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CreditCard className="w-7 h-7 text-primary" />
          Subscription &amp; billing
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your plan, cancel, or update your payment method.
        </p>
      </header>

      {!sub ? (
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-xl font-semibold">Choose your plan</h2>
            <p className="text-sm text-muted-foreground">
              Founder pricing — locked in for as long as you stay subscribed.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => onSubscribe("monthly")}
              disabled={busy !== null || checkoutLoading}
              className="text-left rounded-xl border border-border p-4 hover:border-primary hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Monthly</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-bold">$9</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Check className="w-3 h-3" /> Cancel anytime
              </div>
              {busy === "subscribe-monthly" && (
                <div className="text-xs text-muted-foreground mt-2">Opening checkout…</div>
              )}
            </button>
            <button
              onClick={() => onSubscribe("annual")}
              disabled={busy !== null || checkoutLoading}
              className="relative text-left rounded-xl border border-primary/60 bg-primary/5 p-4 hover:border-primary hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="absolute -top-2 right-3 text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                Save ~10%
              </span>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Annual</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-bold">$97</span>
                <span className="text-sm text-muted-foreground">/yr</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Check className="w-3 h-3" /> Two months free
              </div>
              {busy === "subscribe-annual" && (
                <div className="text-xs text-muted-foreground mt-2">Opening checkout…</div>
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Payments are processed securely by Paddle, our Merchant of Record.
          </p>
        </Card>
      ) : (

        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Plan
              </div>
              <div className="text-2xl font-bold capitalize">{sub.plan}</div>
              <div className="text-sm text-muted-foreground">
                {fmtMoney(sub.amount_cents)} / {sub.interval}
              </div>
            </div>
            <div className="text-right">
              <Badge variant={isActive ? "default" : "secondary"}>
                {sub.status}
              </Badge>
              {sub.cancel_at_period_end && (
                <div className="text-xs text-amber-600 mt-1">
                  Cancels {fmtDate(sub.current_period_end)}
                </div>
              )}
              {sub.environment === "sandbox" && (
                <div className="text-xs text-orange-600 mt-1">Test mode</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Period start</div>
              <div>{fmtDate(sub.current_period_start)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">
                {sub.cancel_at_period_end ? "Access until" : "Renews"}
              </div>
              <div>{fmtDate(sub.current_period_end)}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={onPortal}
              disabled={busy !== null}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Update payment method
            </Button>
            {sub.cancel_at_period_end ? (
              <Button
                variant="default"
                onClick={onReactivate}
                disabled={busy !== null}
              >
                Resume subscription
              </Button>
            ) : isActive ? (
              <Button
                variant="destructive"
                onClick={onCancel}
                disabled={busy !== null}
              >
                Cancel subscription
              </Button>
            ) : null}
          </div>

          {sub.status === "past_due" && (
            <div className="rounded-lg bg-amber-100 border border-amber-300 text-amber-900 p-3 text-sm">
              Your last payment failed. Update your payment method to keep
              access — we'll retry automatically.
            </div>
          )}
        </Card>
      )}

      <Card className="p-4 text-sm text-muted-foreground">
        Looking for credit top-ups? Go to{" "}
        <Link to="/profile/credits" className="underline text-foreground">
          Credits
        </Link>
        .
      </Card>
    </div>
  );
}
