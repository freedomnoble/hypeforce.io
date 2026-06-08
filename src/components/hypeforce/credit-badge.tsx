import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getMyCreditBalance } from "@/lib/credits.functions";
import { CreditsTopupDialog } from "./credits-topup-dialog";
import { supabase } from "@/integrations/supabase/client";

export function CreditBadge() {
  const fetchBalance = useServerFn(getMyCreditBalance);
  const qc = useQueryClient();
  const [topupOpen, setTopupOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => fetchBalance(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const balance = data?.balance ?? null;

  // Realtime: re-query on grants/usage insert
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`credits:${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "credit_grants", filter: `user_id=eq.${uid}` },
          () => qc.invalidateQueries({ queryKey: ["credits"] }),
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "credit_usage", filter: `user_id=eq.${uid}` },
          () => qc.invalidateQueries({ queryKey: ["credits"] }),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  const onPurchaseStarted = useCallback(() => {
    // Re-poll for ~30s after checkout
    let n = 0;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["credits"] });
      if (++n > 15) clearInterval(t);
    }, 2000);
  }, [qc]);

  const tone =
    balance === null
      ? "text-muted-foreground"
      : balance <= 20
        ? "text-destructive"
        : balance < 100
          ? "text-amber-500"
          : "text-foreground";

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3 h-8 text-xs font-medium glass hover:bg-accent transition-colors ${tone}`}
            aria-label="Credit balance"
          >
            <Coins className="w-3.5 h-3.5" />
            {balance === null ? "—" : balance.toLocaleString()}
            <span className="text-muted-foreground font-normal">credits</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="text-2xl font-bold">
                {balance === null ? "—" : balance.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground ml-1">credits</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Each AI reply uses credits based on the model and length. 1 credit ≈ $0.01.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={() => setTopupOpen(true)}>
                Buy more credits
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/profile/credits">View usage & history</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/profile/connections">Use your own API keys</Link>
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <CreditsTopupDialog
        open={topupOpen}
        onOpenChange={setTopupOpen}
        onPurchaseStarted={onPurchaseStarted}
      />
    </>
  );
}
