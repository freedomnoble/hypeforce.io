import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Inbox, CheckCheck, Mail, MailOpen } from "lucide-react";
import { listMyMessages, markMessageRead, markAllRead } from "@/lib/inbox.functions";

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function AdminInboxFlyout({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const list = useServerFn(listMyMessages);
  const markRead = useServerFn(markMessageRead);
  const markAll = useServerFn(markAllRead);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-inbox"],
    queryFn: () => list(),
    enabled: open,
  });

  const [expanded, setExpanded] = useState<string | null>(null);

  const onOpen = async (id: string, unread: boolean) => {
    setExpanded((prev) => (prev === id ? null : id));
    if (unread) {
      await markRead({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-inbox"] });
      qc.invalidateQueries({ queryKey: ["admin-inbox-unread"] });
    }
  };

  const onMarkAll = async () => {
    await markAll();
    qc.invalidateQueries({ queryKey: ["admin-inbox"] });
    qc.invalidateQueries({ queryKey: ["admin-inbox-unread"] });
  };

  const messages = data?.messages ?? [];
  const unreadCount = messages.filter((m) => !m.read_at).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Inbox className="w-4 h-4" /> Inbox
          </SheetTitle>
          <SheetDescription>
            Messages from the Hypeforce team.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {messages.length === 0
              ? "No messages yet"
              : `${messages.length} message${messages.length === 1 ? "" : "s"} · ${unreadCount} unread`}
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" onClick={onMarkAll} className="h-7 text-xs">
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
            </Button>
          )}
        </div>

        <div className="mt-3 space-y-2 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
          {isLoading && (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No messages from the team yet.
            </div>
          )}
          {messages.map((m) => {
            const unread = !m.read_at;
            const isOpen = expanded === m.id;
            const senderLabel =
              m.sender?.display_name || m.sender?.email || "Hypeforce team";
            return (
              <button
                key={m.id}
                onClick={() => onOpen(m.id, unread)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  unread
                    ? "bg-secondary/60 border-border hover:bg-secondary"
                    : "bg-background/40 border-border/60 hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 text-muted-foreground">
                    {unread ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${unread ? "font-semibold" : "font-medium"}`}>
                        {m.subject || "(no subject)"}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {relTime(m.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      from {senderLabel}
                    </div>
                    {isOpen ? (
                      <p className="mt-2 text-sm whitespace-pre-wrap text-foreground/90">
                        {m.body}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {m.body}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
