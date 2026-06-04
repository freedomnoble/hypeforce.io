import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listTickets, getTicketThread, replyTicket, setTicketStatus } from "@/lib/admin.functions";
import { GlassPanel } from "@/components/admin/admin-shell";
import { toast } from "sonner";

export const Route = createFileRoute("/pretentious/support")({
  component: SupportPage,
});

function SupportPage() {
  const listFn = useServerFn(listTickets);
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: tickets } = useQuery({
    queryKey: ["admin-tickets", status],
    queryFn: () => listFn({ data: { status } }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-tight">Support</h1>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
          {["all", "open", "in_progress", "resolved"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs rounded-lg ${status === s ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassPanel className="lg:col-span-1 max-h-[70vh] overflow-y-auto divide-y divide-white/5">
          {(tickets as any[] ?? []).map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`w-full text-left p-4 hover:bg-white/[0.04] ${selectedId === t.id ? "bg-white/[0.06]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-white truncate">{t.name}</div>
                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                  t.status === "open" ? "bg-amber-500/20 text-amber-200" :
                  t.status === "in_progress" ? "bg-blue-500/20 text-blue-200" :
                  "bg-emerald-500/20 text-emerald-200"
                }`}>{t.status}</span>
              </div>
              <div className="text-xs text-white/50 truncate">{t.email}</div>
              <div className="text-xs text-white/40 mt-1 line-clamp-2">{t.message}</div>
              <div className="text-[10px] font-mono text-white/30 mt-1">
                {new Date(t.created_at).toLocaleString()}
                {t.support_ticket_attachments?.length > 0 && ` · ${t.support_ticket_attachments.length} att`}
              </div>
            </button>
          ))}
          {(!tickets || (tickets as any[]).length === 0) && (
            <div className="p-6 text-sm text-white/40">No tickets.</div>
          )}
        </GlassPanel>

        <div className="lg:col-span-2">
          {selectedId ? (
            <TicketThread id={selectedId} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-tickets"] })} />
          ) : (
            <GlassPanel className="p-10 text-center text-white/40">Select a ticket to view the thread.</GlassPanel>
          )}
        </div>
      </div>
    </div>
  );
}

function TicketThread({ id, onChanged }: { id: string; onChanged: () => void }) {
  const fn = useServerFn(getTicketThread);
  const reply = useServerFn(replyTicket);
  const setSt = useServerFn(setTicketStatus);
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["admin-ticket", id],
    queryFn: () => fn({ data: { ticket_id: id } }),
  });

  const t: any = data?.ticket;
  if (!t) return <GlassPanel className="p-10 text-white/40">Loading…</GlassPanel>;

  return (
    <GlassPanel className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-xl">{t.name}</div>
          <div className="text-xs text-white/50">{t.email}</div>
          {t.page_url && <div className="text-[11px] font-mono text-white/40 mt-1">from {t.page_url}</div>}
        </div>
        <select
          value={t.status}
          onChange={async (e) => {
            await setSt({ data: { ticket_id: id, status: e.target.value as any } });
            await refetch();
            onChanged();
          }}
          className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs"
        >
          {["open", "in_progress", "resolved"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 whitespace-pre-wrap text-sm">{t.message}</div>

      {data?.attachments && data.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.attachments.map((a: any) => (
            <a
              key={a.id}
              href={a.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs hover:bg-white/10"
            >
              {a.kind === "image" ? "🖼" : a.kind === "video" ? "🎥" : "📎"} {a.file_path.split("/").pop()}
            </a>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {(data?.messages ?? []).map((m: any) => (
          <div
            key={m.id}
            className={`rounded-xl p-3 text-sm ${m.author === "admin" ? "bg-purple-500/10 border border-purple-400/20" : "bg-white/[0.03] border border-white/10"}`}
          >
            <div className="text-[10px] font-mono uppercase text-white/40 mb-1">{m.author} · {new Date(m.created_at).toLocaleString()}</div>
            <div className="whitespace-pre-wrap">{m.body}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Reply…"
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
        />
        <div className="flex gap-2">
          <button
            disabled={!body.trim()}
            onClick={async () => {
              try {
                await reply({ data: { ticket_id: id, body, status: "in_progress" } });
                setBody("");
                await refetch();
                onChanged();
                toast.success("Reply sent");
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm disabled:opacity-40"
          >
            Send reply
          </button>
          <button
            onClick={async () => {
              await setSt({ data: { ticket_id: id, status: "resolved" } });
              await refetch();
              onChanged();
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-sm"
          >
            Mark resolved
          </button>
        </div>
      </div>
    </GlassPanel>
  );
}
