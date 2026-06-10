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
import { ArrowLeft, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";

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
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["billing", "me"],
    queryFn: () => fetchBilling(),
    refetchOnWindowFocus: true,
  });
  const sub = data?.subscription as any;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["billing"] });

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
        <Card className="p-6 text-center space-y-3">
          <p className="text-muted-foreground">
            You don't have an active subscription yet.
          </p>
          <Button asChild>
            <Link to="/onboarding/features">Subscribe</Link>
          </Button>
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
