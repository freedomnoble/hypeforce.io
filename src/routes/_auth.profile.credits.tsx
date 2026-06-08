import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyCreditLedger } from "@/lib/credits.functions";
import { CreditsTopupDialog } from "@/components/hypeforce/credits-topup-dialog";
import { ArrowLeft, Coins } from "lucide-react";

export const Route = createFileRoute("/_auth/profile/credits")({
  component: CreditsPage,
  head: () => ({
    meta: [{ title: "Credits — Hypeforce" }],
  }),
});

function formatModel(m: string) {
  return m.replace(/^(openai|google|anthropic)\//, "");
}

function CreditsPage() {
  const fetchLedger = useServerFn(getMyCreditLedger);
  const [topupOpen, setTopupOpen] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["credits", "ledger"],
    queryFn: () => fetchLedger(),
    refetchOnWindowFocus: true,
  });

  const balance = data?.balance ?? 0;
  const grants = data?.grants ?? [];
  const usage = data?.usage ?? [];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/profile">
            <ArrowLeft className="w-4 h-4 mr-1" /> Profile
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Coins className="w-7 h-7 text-primary" />
            Credits
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Credits power AI agent replies. 1 credit ≈ $0.01 of model usage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Balance</div>
            <div className="text-3xl font-bold">{balance.toLocaleString()}</div>
          </div>
          <Button onClick={() => setTopupOpen(true)}>Buy credits</Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Recent usage</h2>
          {usage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage yet.</p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-auto">
              {usage.map((u: any) => (
                <li
                  key={u.id}
                  className="flex justify-between items-center text-sm border-b border-border/50 pb-2"
                >
                  <div>
                    <div className="font-medium">{formatModel(u.model)}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.kind === "image"
                        ? `${u.image_count} image${u.image_count > 1 ? "s" : ""}`
                        : `${u.prompt_tokens}→${u.completion_tokens} tokens`}{" "}
                      · {new Date(u.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-destructive">−{u.credits}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Credit history</h2>
          {grants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No grants yet.</p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-auto">
              {grants.map((g: any) => (
                <li
                  key={g.id}
                  className="flex justify-between items-center text-sm border-b border-border/50 pb-2"
                >
                  <div>
                    <div className="font-medium capitalize">
                      {g.source.replace("_", " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {g.note ? `${g.note} · ` : ""}
                      {new Date(g.created_at).toLocaleString()}
                      {g.expires_at
                        ? ` · expires ${new Date(g.expires_at).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-primary">+{g.amount}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card className="p-4">
        <h2 className="font-semibold mb-1">Skip credits entirely</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Connect your own OpenAI, Anthropic, or Google API keys and you'll be billed by them
          directly — Hypeforce won't charge any credits for those calls.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/profile/connections">Manage API connections</Link>
        </Button>
      </Card>

      <CreditsTopupDialog
        open={topupOpen}
        onOpenChange={setTopupOpen}
        onPurchaseStarted={() => {
          let n = 0;
          const t = setInterval(() => {
            refetch();
            if (++n > 15) clearInterval(t);
          }, 2000);
        }}
      />
    </div>
  );
}
