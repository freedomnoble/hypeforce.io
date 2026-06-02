import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyConnections,
  connectProvider,
  disconnectProvider,
} from "@/lib/ai-connections.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Plug, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/profile/connections")({
  head: () => ({ meta: [{ title: "AI Connections — Hypeforce" }] }),
  component: ConnectionsPage,
});

type ProviderId = "openai" | "anthropic" | "google" | "manus";

interface ProviderMeta {
  id: ProviderId;
  name: string;
  blurb: string;
  keyHint: string;
  keyUrl: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: "openai",
    name: "OpenAI",
    blurb: "Route GPT-powered agents through your own OpenAI account.",
    keyHint: "starts with sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    blurb: "Use your own Claude API access for Claude-powered agents.",
    keyHint: "starts with sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "google",
    name: "Google AI",
    blurb: "Bring your own Gemini API key from Google AI Studio.",
    keyHint: "AI Studio key",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "manus",
    name: "Manus",
    blurb: "Connect Manus when you have early access (preview).",
    keyHint: "preview key",
    keyUrl: "https://manus.im",
  },
];

interface Conn {
  provider: ProviderId;
  key_last4: string;
  status: "active" | "invalid" | "revoked";
  connected_at: string;
  last_validated_at: string | null;
}

function ConnectionsPage() {
  const [loading, setLoading] = useState(true);
  const [conns, setConns] = useState<Conn[]>([]);
  const [openProvider, setOpenProvider] = useState<ProviderMeta | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const listFn = useServerFn(listMyConnections);
  const connectFn = useServerFn(connectProvider);
  const disconnectFn = useServerFn(disconnectProvider);

  const refresh = async () => {
    const data = await listFn();
    setConns((data ?? []) as Conn[]);
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byProvider = new Map(conns.map((c) => [c.provider, c]));

  const handleConnect = async () => {
    if (!openProvider) return;
    if (keyValue.trim().length < 8) {
      toast.error("That key looks too short.");
      return;
    }
    setSubmitting(true);
    try {
      await connectFn({ data: { provider: openProvider.id, api_key: keyValue.trim() } });
      toast.success(`${openProvider.name} connected`);
      setOpenProvider(null);
      setKeyValue("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not connect");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (id: ProviderId) => {
    if (!confirm(`Disconnect ${id}? Your key will be deleted.`)) return;
    try {
      await disconnectFn({ data: { provider: id } });
      toast.success("Disconnected");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground font-mono">
        loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-2xl mx-auto">
      <Link
        to="/profile"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to profile
      </Link>

      <div className="glass-strong rounded-3xl p-6 md:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Plug className="w-4 h-4 text-electric" />
            <h1 className="font-display text-2xl font-semibold">AI Connections</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            By default every agent runs on the bundled Lovable AI Gateway — no setup needed.
            Connect your own provider keys here to route specific agents through your own
            account. Keys are encrypted and only used server-side.
          </p>
        </div>

        <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
          {PROVIDERS.map((p) => {
            const c = byProvider.get(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 p-4 hover:bg-secondary/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-display font-semibold">{p.name}</div>
                    {c?.status === "active" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-mint">
                        <CheckCircle2 className="w-3 h-3" /> connected · ••••{c.key_last4}
                      </span>
                    )}
                    {c?.status === "invalid" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-destructive">
                        <AlertTriangle className="w-3 h-3" /> key rejected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.blurb}</div>
                </div>
                {c ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setOpenProvider(p);
                        setKeyValue("");
                      }}
                    >
                      Replace
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDisconnect(p.id)}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setOpenProvider(p);
                      setKeyValue("");
                    }}
                  >
                    Connect
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog open={!!openProvider} onOpenChange={(o) => !o && setOpenProvider(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {openProvider?.name}</DialogTitle>
            <DialogDescription>
              Paste your API key. We'll test it once with the provider, encrypt it, and
              store it. You can disconnect any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="api_key">API key</Label>
            <Input
              id="api_key"
              type="password"
              autoComplete="off"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={openProvider?.keyHint}
            />
            {openProvider && (
              <a
                href={openProvider.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-electric hover:underline"
              >
                Get a key from {openProvider.name} ↗
              </a>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenProvider(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={submitting}>
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
