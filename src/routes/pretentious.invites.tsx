import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GlassPanel } from "@/components/admin/admin-shell";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import {
  getInviteConfig,
  setInviteEnabled,
  rotateInviteToken,
  listCompedUsers,
  setUserCompFlags,
} from "@/lib/invites.functions";

export const Route = createFileRoute("/pretentious/invites")({
  component: InvitesPage,
});

function InvitesPage() {
  const fetchCfg = useServerFn(getInviteConfig);
  const fetchComped = useServerFn(listCompedUsers);
  const toggleEnabled = useServerFn(setInviteEnabled);
  const rotate = useServerFn(rotateInviteToken);
  const setFlags = useServerFn(setUserCompFlags);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: cfg } = useQuery({ queryKey: ["invite-config"], queryFn: () => fetchCfg() });
  const { data: comped } = useQuery({ queryKey: ["comped-users"], queryFn: () => fetchComped() });

  // Always share the canonical published origin so previews and OG metadata
  // resolve to the real site, not a Lovable preview URL.
  const url = cfg ? `https://hypeforce.io/join/${cfg.token}` : "";
  const trialUrl = cfg?.trial ? `https://hypeforce.io/join/${cfg.trial.token}` : "";

  const wrap = async (label: string, fn: () => Promise<any>, keys: string[][] = []) => {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-tight">Invites</h1>
      <p className="text-sm text-white/50 max-w-2xl">
        Share this link privately to give someone free access. They sign up like a normal user but
        are automatically marked as a free (comp) account and skip checkout.
      </p>

      <GlassPanel className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-mono">
              Invite link
            </div>
            <div className="text-sm text-white/60 mt-1">
              {cfg?.enabled ? "Active" : "Disabled — link will not redeem."}
            </div>
          </div>
          <Switch
            checked={!!cfg?.enabled}
            disabled={busy || !cfg}
            onCheckedChange={(v) =>
              wrap(v ? "Invite enabled" : "Invite disabled", () =>
                toggleEnabled({ data: { enabled: v } }),
                [["invite-config"]],
              )
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 px-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 font-mono outline-none"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("Copied");
            }}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (!confirm("Rotate the invite token? The current link will stop working.")) return;
              wrap("Token rotated", () => rotate(), [["invite-config"]]);
            }}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Rotate
          </button>
        </div>
      </GlassPanel>

      <GlassPanel className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-mono">
              Free-trial link
            </div>
            <div className="text-sm text-white/60 mt-1">
              {cfg?.trial
                ? cfg.trial.enabled
                  ? "Active — gives a 5-day comp trial on sign-up."
                  : "Disabled — link will not redeem."
                : "Not configured."}
            </div>
          </div>
          <Switch
            checked={!!cfg?.trial?.enabled}
            disabled={busy || !cfg?.trial}
            onCheckedChange={(v) =>
              wrap(v ? "Trial invite enabled" : "Trial invite disabled", () =>
                toggleEnabled({ data: { enabled: v, kind: "trial" } }),
                [["invite-config"]],
              )
            }
          />
        </div>

        {cfg?.trial && (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={trialUrl}
              className="flex-1 px-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 font-mono outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(trialUrl);
                toast.success("Copied");
              }}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm("Rotate the trial token? The current link will stop working.")) return;
                wrap("Trial token rotated", () => rotate({ data: { kind: "trial" } }), [["invite-config"]]);
              }}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Rotate
            </button>
          </div>
        )}
      </GlassPanel>


      <GlassPanel className="overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="font-display text-lg">Comped users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-center px-4 py-3">Show upsell</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(comped?.users ?? []).map((u: any) => (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    <div>{u.display_name ?? u.email}</div>
                    <div className="text-[10px] font-mono text-white/40">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-white/60">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={!!u.show_upsell}
                      disabled={busy}
                      onCheckedChange={(v) =>
                        wrap(
                          v ? "Upsell on" : "Upsell off",
                          () => setFlags({ data: { user_id: u.id, show_upsell: v } }),
                          [["comped-users"], ["admin-users"]],
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={busy}
                      onClick={() =>
                        wrap(
                          "Comp removed",
                          () => setFlags({ data: { user_id: u.id, is_comped: false, show_upsell: false } }),
                          [["comped-users"], ["admin-users"]],
                        )
                      }
                      className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
              {comped && comped.users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-white/40 text-center">
                    No comped users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}
