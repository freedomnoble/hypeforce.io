import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listUsers,
  setUsageLimit,
  setSubscription,
  approveCancellation,
  messageUser,
  deleteUser,
  bulkDeleteUsers,
} from "@/lib/admin.functions";
import { setUserCompFlags, setUserTrial } from "@/lib/invites.functions";
import { Switch } from "@/components/ui/switch";
import { GlassPanel } from "@/components/admin/admin-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/pretentious/users")({
  component: UsersPage,
});

function UsersPage() {
  const fn = useServerFn(listUsers);
  const bulkDel = useServerFn(bulkDeleteUsers);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: () => fn({ data: { search, page } }),
  });

  const users = (data?.users as any[]) ?? [];
  const allVisibleSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id));
  const someVisibleSelected = users.some((u) => selectedIds.has(u.id));

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) users.forEach((u) => next.delete(u.id));
      else users.forEach((u) => next.add(u.id));
      return next;
    });
  };

  const runBulkDelete = async () => {
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkDel({ data: { user_ids: ids } });
      if (res.failed.length) {
        console.error("Bulk delete failures:", res.failed);
        const firstErr = res.failed[0]?.error ?? "unknown error";
        toast.warning(`Deleted ${res.deleted}. ${res.failed.length} failed.`, {
          description: firstErr,
        });
      } else {
        toast.success(`Deleted ${res.deleted} user${res.deleted === 1 ? "" : "s"}.`);
      }
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e.message ?? "Bulk delete failed");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl tracking-tight">Users</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email…"
          className="px-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 outline-none focus:border-white/30 w-64"
        />
      </div>

      {selectedIds.size > 0 && (
        <GlassPanel className="flex items-center justify-between px-4 py-2">
          <div className="text-sm text-white/70">
            <span className="font-mono text-white">{selectedIds.size}</span> selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-xs text-white/60"
            >
              Clear
            </button>
            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs"
            >
              Delete selected
            </button>
          </div>
        </GlassPanel>
      )}

      <GlassPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              <tr className="border-b border-white/10">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={toggleAllVisible}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-right px-4 py-3">Workspaces</th>
                <th className="text-right px-4 py-3">Channels</th>
                <th className="text-right px-4 py-3">Agents</th>
                <th className="text-right px-4 py-3">Gateway / BYOK</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-6 text-white/40">Loading…</td></tr>
              )}
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer"
                  onClick={() => setSelected(u)}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleOne(u.id)}
                      aria-label={`Select ${u.email}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{u.email}</div>
                    <div className="text-[10px] font-mono text-white/40">{u.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 text-white/60">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right">{u.workspace_count}</td>
                  <td className="px-4 py-3 text-right">{u.channel_count}</td>
                  <td className="px-4 py-3 text-right">{u.agent_count}</td>
                  <td className="px-4 py-3 text-right text-xs">
                    <span className="text-purple-300">{u.gateway_agent_count} GW</span>
                    <span className="text-white/30 mx-1">·</span>
                    <span className="text-blue-300">{u.byok_count} BYOK</span>
                  </td>
                  <td className="px-4 py-3">
                    <PlanBadge sub={u.subscription} comped={u.profile_flags?.is_comped} />
                  </td>
                  <td className="px-4 py-3 text-right text-white/40 text-xs">›</td>
                </tr>
              ))}
              {!isLoading && users.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-white/40">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-xs text-white/50">
          <div>Page {page}</div>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30">Prev</button>
            <button onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded hover:bg-white/5">Next</button>
          </div>
        </div>
      </GlassPanel>

      {selected && (
        <UserDrawer
          user={selected}
          onClose={() => setSelected(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
        />
      )}

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} user{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected accounts and cascades to all their data
              (workspaces, channels, agents, messages). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkBusy}
              onClick={(e) => {
                e.preventDefault();
                runBulkDelete();
              }}
              className="bg-red-500/80 hover:bg-red-500 text-white"
            >
              {bulkBusy ? "Deleting…" : `Delete ${selectedIds.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function PlanBadge({ sub, comped }: { sub: any; comped?: boolean }) {
  if (comped) {
    return (
      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border text-emerald-300 border-emerald-300/30">
        comp
      </span>
    );
  }
  if (!sub) return <span className="text-white/40 text-xs">none</span>;
  const colors: Record<string, string> = {
    active: "text-emerald-300 border-emerald-300/30",
    paused: "text-amber-300 border-amber-300/30",
    canceled: "text-red-300 border-red-300/30",
    cancel_requested: "text-orange-300 border-orange-300/30",
    trialing: "text-blue-300 border-blue-300/30",
  };
  return (
    <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${colors[sub.status] ?? "text-white/50 border-white/20"}`}>
      {sub.plan} · {sub.interval} · {sub.status.replace("_", " ")}
    </span>
  );
}

function UserDrawer({ user, onClose, onChanged }: { user: any; onClose: () => void; onChanged: () => void }) {
  const setLim = useServerFn(setUsageLimit);
  const setSub = useServerFn(setSubscription);
  const approve = useServerFn(approveCancellation);
  const msg = useServerFn(messageUser);
  const del = useServerFn(deleteUser);
  const setFlags = useServerFn(setUserCompFlags);

  const [comped, setComped] = useState(!!user.profile_flags?.is_comped);
  const [upsell, setUpsell] = useState(!!user.profile_flags?.show_upsell);

  const [paused, setPaused] = useState(user.usage_limit?.lovable_gateway_paused ?? false);
  const [cap, setCap] = useState<string>(user.usage_limit?.monthly_message_cap?.toString() ?? "");
  const [plan, setPlan] = useState(user.subscription?.plan ?? "none");
  const [interval, setInterval] = useState(user.subscription?.interval ?? "monthly");
  const [status, setStatus] = useState(user.subscription?.status ?? "active");
  const [amount, setAmount] = useState((user.subscription?.amount_cents ?? 900).toString());
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const wrap = async (label: string, fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40 backdrop-blur-sm" />
      <div
        className="w-full max-w-lg h-full overflow-y-auto bg-[#0a0a14]/95 border-l border-white/10 p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-white font-display text-xl">{user.email}</div>
          <div className="text-[11px] font-mono text-white/40">{user.id}</div>
        </div>

        <Section title="Usage limits">
          <label className="flex items-center justify-between text-sm">
            <span>Pause Lovable AI gateway</span>
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
          </label>
          <label className="block text-sm">
            <span className="text-white/60 text-xs">Monthly message cap (blank = unlimited)</span>
            <input
              value={cap}
              onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm"
              placeholder="e.g. 1000"
            />
          </label>
          <button
            disabled={busy}
            onClick={() => wrap("Limits updated", () => setLim({ data: { user_id: user.id, lovable_gateway_paused: paused, monthly_message_cap: cap ? Number(cap) : null } }))}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
          >
            Save limits
          </button>
        </Section>

        <Section title="Subscription">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="px-2 py-1.5 rounded bg-white/5 border border-white/10">
              {["none", "founder", "pro", "team"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={interval} onChange={(e) => setInterval(e.target.value)} className="px-2 py-1.5 rounded bg-white/5 border border-white/10">
              <option value="monthly">monthly</option>
              <option value="annual">annual</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-2 py-1.5 rounded bg-white/5 border border-white/10">
              {["active", "paused", "canceled", "cancel_requested", "trialing"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="amount (cents)"
              className="px-2 py-1.5 rounded bg-white/5 border border-white/10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              disabled={busy}
              onClick={() => wrap("Subscription saved", () => setSub({ data: { user_id: user.id, plan, interval, status, amount_cents: Number(amount || 0) } }))}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
            >
              Save subscription
            </button>
            {user.subscription?.status === "cancel_requested" && (
              <button
                disabled={busy}
                onClick={() => wrap("Cancellation approved", () => approve({ data: { user_id: user.id } }))}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm"
              >
                Approve cancellation
              </button>
            )}
          </div>
        </Section>

        <Section title="Access">
          <label className="flex items-center justify-between text-sm">
            <div>
              <div>Free access (comp)</div>
              <div className="text-[10px] text-white/40">Skips paid subscription gating.</div>
            </div>
            <Switch
              checked={comped}
              onCheckedChange={(v) => {
                setComped(v);
                wrap("Access updated", () => setFlags({ data: { user_id: user.id, is_comped: v } }));
              }}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <div>
              <div>Show subscribe banner</div>
              <div className="text-[10px] text-white/40">Dismissible upsell at the top of the app.</div>
            </div>
            <Switch
              checked={upsell}
              onCheckedChange={(v) => {
                setUpsell(v);
                wrap("Upsell updated", () => setFlags({ data: { user_id: user.id, show_upsell: v } }));
              }}
            />
          </label>
        </Section>

        <Section title="Message user (in-app)">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Hey there — saw your cancellation request…"
            className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm"
          />
          <button
            disabled={busy || !body.trim()}
            onClick={() => wrap("Message sent", async () => {
              await msg({ data: { user_id: user.id, body } });
              setBody("");
            })}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm disabled:opacity-40"
          >
            Send
          </button>
        </Section>

        <Section title="Danger zone">
          <button
            disabled={busy}
            onClick={() => {
              if (!confirm(`Delete ${user.email}? This cascades to all their data.`)) return;
              wrap("User deleted", async () => {
                await del({ data: { user_id: user.id } });
                onClose();
              });
            }}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm"
          >
            Delete user
          </button>
        </Section>

        <button onClick={onClose} className="text-white/40 hover:text-white text-xs">Close</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassPanel className="p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-mono">{title}</div>
      {children}
    </GlassPanel>
  );
}
