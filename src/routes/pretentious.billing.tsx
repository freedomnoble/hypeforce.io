import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listUsers, approveCancellation, setSubscription, messageUser } from "@/lib/admin.functions";
import { GlassPanel } from "@/components/admin/admin-shell";
import { toast } from "sonner";

export const Route = createFileRoute("/pretentious/billing")({
  component: BillingPage,
});

function BillingPage() {
  const fn = useServerFn(listUsers);
  const approve = useServerFn(approveCancellation);
  const setSub = useServerFn(setSubscription);
  const msg = useServerFn(messageUser);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ["admin-users", "billing", 1], queryFn: () => fn({ data: { search: "", page: 1 } }) });
  const all: any[] = data?.users ?? [];
  const subs = all.filter((u) => u.subscription);
  const pending = subs.filter((u) => u.subscription.status === "cancel_requested");

  const wrap = async (id: string, label: string, fn: () => Promise<any>) => {
    setBusy(id);
    try { await fn(); toast.success(label); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-tight">Billing</h1>

      <GlassPanel className="p-5">
        <h3 className="font-display text-lg mb-3">Pending cancellations</h3>
        {pending.length === 0 && <p className="text-sm text-white/40">None.</p>}
        <div className="space-y-2">
          {pending.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
              <div>
                <div className="text-sm">{u.email}</div>
                <div className="text-[10px] font-mono text-white/40">{u.subscription.plan} · {u.subscription.interval}</div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy === u.id}
                  onClick={() => wrap(u.id, "Cancellation approved", () => approve({ data: { user_id: u.id } }))}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs"
                >Approve cancel</button>
                <button
                  disabled={busy === u.id}
                  onClick={() => {
                    const body = prompt("Message to send:") ?? "";
                    if (body.trim()) wrap(u.id, "Message sent", () => msg({ data: { user_id: u.id, body } }));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs"
                >Message</button>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Interval</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((u) => (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.subscription.plan}</td>
                  <td className="px-4 py-3">{u.subscription.interval}</td>
                  <td className="px-4 py-3">{u.subscription.status}</td>
                  <td className="px-4 py-3 text-right">${(u.subscription.amount_cents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    {u.subscription.status === "active" && (
                      <button
                        disabled={busy === u.id}
                        onClick={() => wrap(u.id, "Paused", () => setSub({ data: { ...u.subscription, status: "paused" } }))}
                        className="px-2 py-1 rounded bg-amber-500/20 text-amber-200 text-xs"
                      >Pause</button>
                    )}
                    {u.subscription.status === "paused" && (
                      <button
                        disabled={busy === u.id}
                        onClick={() => wrap(u.id, "Resumed", () => setSub({ data: { ...u.subscription, status: "active" } }))}
                        className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 text-xs"
                      >Resume</button>
                    )}
                  </td>
                </tr>
              ))}
              {subs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-white/40">No subscriptions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}
