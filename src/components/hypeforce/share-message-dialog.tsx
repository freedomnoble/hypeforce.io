import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Hash, MessageSquare, Loader2, Forward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeAgentRouter } from "@/lib/agent-router.functions";

export interface ShareableMessage {
  id: string;
  content: string;
  created_at: string;
  authorName: string;
}

interface ChannelDest {
  kind: "channel";
  id: string;
  name: string;
}
interface DmDest {
  kind: "dm";
  id: string;
  label: string;
}
type Destination = ChannelDest | DmDest;

export function ShareMessageDialog({
  open,
  onOpenChange,
  message,
  workspaceId,
  sourceLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  message: ShareableMessage | null;
  workspaceId: string;
  sourceLabel: string;
}) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loadingDest, setLoadingDest] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    setNote("");
    setSelectedKey("");
    setFilter("");
    setLoadingDest(true);
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const [{ data: ch }, { data: agents }, { data: dmRows }] = await Promise.all([
          supabase
            .from("channels")
            .select("id,name")
            .eq("workspace_id", workspaceId)
            .order("name"),
          supabase.from("agents").select("id,name,handle").eq("workspace_id", workspaceId),
          supabase
            .from("direct_messages")
            .select("id,title,dm_participants(user_id,agent_id,member_type)")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false }),
        ]);

        const agentMap = new Map((agents ?? []).map((a: any) => [a.id, a]));
        const userIds = Array.from(
          new Set(
            (dmRows ?? []).flatMap((d: any) =>
              (d.dm_participants ?? [])
                .filter((p: any) => p.member_type === "user" && p.user_id)
                .map((p: any) => p.user_id),
            ),
          ),
        );
        const profilesMap = new Map<string, any>();
        if (userIds.length) {
          const { data: ps } = await supabase
            .from("profiles")
            .select("id,display_name,email")
            .in("id", userIds);
          (ps ?? []).forEach((p: any) => profilesMap.set(p.id, p));
        }

        const chDest: Destination[] = (ch ?? []).map((c: any) => ({
          kind: "channel" as const,
          id: c.id,
          name: c.name,
        }));
        const dmDest: Destination[] = (dmRows ?? []).map((d: any) => {
          if (d.title) return { kind: "dm" as const, id: d.id, label: d.title };
          const others = (d.dm_participants ?? [])
            .map((p: any) => {
              if (p.agent_id) {
                const a = agentMap.get(p.agent_id);
                return a ? `@${(a as any).handle}` : null;
              }
              if (p.user_id && p.user_id !== u.user!.id) {
                const prof = profilesMap.get(p.user_id);
                return prof?.display_name ?? prof?.email ?? "user";
              }
              return null;
            })
            .filter(Boolean);
          return {
            kind: "dm" as const,
            id: d.id,
            label: others.length ? others.join(", ") : "Direct message",
          };
        });

        setDestinations([...chDest, ...dmDest]);
      } finally {
        setLoadingDest(false);
      }
    })();
  }, [open, workspaceId]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return destinations;
    return destinations.filter((d) =>
      (d.kind === "channel" ? d.name : d.label).toLowerCase().includes(q),
    );
  }, [destinations, filter]);

  const buildQuoted = (msg: ShareableMessage) => {
    const time = new Date(msg.created_at).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const quoted = msg.content
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
    return `> **Shared from ${sourceLabel}** — _${msg.authorName} · ${time}_\n${quoted}`;
  };

  const send = async () => {
    if (!message || !selectedKey || sending) return;
    const dest = destinations.find((d) => `${d.kind}:${d.id}` === selectedKey);
    if (!dest) return;
    setSending(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const quoted = buildQuoted(message);
      const content = note.trim() ? `${quoted}\n\n${note.trim()}` : quoted;

      // Parse @mentions in the user's note so agents can be triggered.
      const mentions: string[] = [];
      if (note.trim()) {
        const { data: agents } = await supabase
          .from("agents")
          .select("id,handle")
          .eq("workspace_id", workspaceId);
        const byHandle: Record<string, string> = {};
        (agents ?? []).forEach((a: any) => (byHandle[a.handle.toLowerCase()] = a.id));
        const re = /@([a-z0-9_-]+)/gi;
        let m;
        while ((m = re.exec(note))) {
          const id = byHandle[m[1].toLowerCase()];
          if (id) mentions.push(id);
        }
      }

      const insert: any = {
        workspace_id: workspaceId,
        author_type: "user",
        author_user_id: u.user.id,
        content,
        mentions: Array.from(new Set(mentions)),
      };
      if (dest.kind === "channel") insert.channel_id = dest.id;
      else insert.dm_id = dest.id;

      const { data: newMsg, error } = await supabase
        .from("messages")
        .insert(insert)
        .select()
        .single();
      if (error) throw error;

      // Trigger agents if mentioned (matches normal send behavior).
      if (insert.mentions.length > 0) {
        invokeAgentRouter({
          data: {
            workspace_id: workspaceId,
            ...(dest.kind === "channel"
              ? { channel_id: dest.id }
              : { dm_id: dest.id }),
            message_id: newMsg.id,
            mention_agent_ids: insert.mentions,
          },
        }).catch(console.error);
      }

      toast.success(
        `Shared to ${dest.kind === "channel" ? `#${dest.name}` : dest.label}`,
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to share");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="w-4 h-4" /> Share message
          </DialogTitle>
          <DialogDescription>
            Forward this message to another channel or DM as context. Add an
            optional note and @-mention an agent to act on it.
          </DialogDescription>
        </DialogHeader>

        {message && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs max-h-32 overflow-y-auto scrollbar-thin">
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">
              {message.authorName} · from {sourceLabel}
            </div>
            <div className="whitespace-pre-wrap line-clamp-6 text-foreground/80">
              {message.content}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Destination
          </label>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search channels or DMs…"
            className="w-full bg-background/40 border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="max-h-56 overflow-y-auto scrollbar-thin border border-border rounded-md divide-y divide-border">
            {loadingDest && (
              <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading…
              </div>
            )}
            {!loadingDest && filtered.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">No matches.</div>
            )}
            {filtered.map((d) => {
              const key = `${d.kind}:${d.id}`;
              const active = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent/30 transition-colors ${
                    active ? "bg-primary/15 text-foreground" : "text-foreground/80"
                  }`}
                >
                  {d.kind === "channel" ? (
                    <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className="truncate">
                    {d.kind === "channel" ? d.name : d.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Optional note (use @handle to ping an agent)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. @chatgpt — what do you make of this?"
            className="w-full bg-background/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={!selectedKey || sending} className="gap-1.5">
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Forward className="w-3.5 h-3.5" />
            )}
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
