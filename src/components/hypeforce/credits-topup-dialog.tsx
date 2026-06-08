import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Sparkles, Rocket } from "lucide-react";
import { toast } from "sonner";

type Pack = {
  priceId: string;
  credits: number;
  price: string;
  label: string;
  bonus?: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
};

const PACKS: Pack[] = [
  {
    priceId: "credits_small_onetime",
    credits: 500,
    price: "$5",
    label: "Starter",
    icon: Zap,
  },
  {
    priceId: "credits_medium_onetime",
    credits: 2200,
    price: "$20",
    label: "Standard",
    bonus: "+10% bonus",
    icon: Sparkles,
    highlight: true,
  },
  {
    priceId: "credits_large_onetime",
    credits: 6000,
    price: "$50",
    label: "Power",
    bonus: "+20% bonus",
    icon: Rocket,
  },
];

export function CreditsTopupDialog({
  open,
  onOpenChange,
  onPurchaseStarted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPurchaseStarted?: () => void;
}) {
  const { openCheckout, loading } = usePaddleCheckout();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleBuy = async (pack: Pack) => {
    setBusyId(pack.priceId);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        toast.error("Please sign in to purchase credits");
        return;
      }
      await openCheckout({
        priceId: pack.priceId,
        quantity: 1,
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id, kind: "credits_topup" },
        successUrl: `${window.location.origin}/profile/credits?topup=success`,
        onEvent: (e: any) => {
          if (e?.name === "checkout.completed") {
            onPurchaseStarted?.();
            toast.success("Payment received — credits arrive in seconds");
            onOpenChange(false);
          }
        },
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Checkout failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buy more credits</DialogTitle>
          <DialogDescription>
            Credits power AI agent replies. 1 credit ≈ $0.01 of model usage. Top-ups never expire.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {PACKS.map((pack) => {
            const Icon = pack.icon;
            return (
              <button
                key={pack.priceId}
                onClick={() => handleBuy(pack)}
                disabled={loading || busyId !== null}
                className={`relative text-left rounded-xl border p-4 transition-all hover:border-primary hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed ${
                  pack.highlight ? "border-primary/60 bg-primary/5" : "border-border"
                }`}
              >
                {pack.highlight && (
                  <span className="absolute -top-2 right-3 text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Best value
                  </span>
                )}
                <Icon className="w-5 h-5 text-primary mb-2" />
                <div className="text-xs text-muted-foreground">{pack.label}</div>
                <div className="text-2xl font-bold mt-1">
                  {pack.credits.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">credits</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {pack.price}
                  {pack.bonus && (
                    <span className="text-primary ml-2 font-medium">{pack.bonus}</span>
                  )}
                </div>
                {busyId === pack.priceId && (
                  <div className="text-xs text-muted-foreground mt-2">Opening checkout…</div>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          Or skip credits entirely by connecting your own API keys in Profile → Connections.
        </p>
      </DialogContent>
    </Dialog>
  );
}
