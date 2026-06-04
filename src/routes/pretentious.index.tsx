import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getDashboardStats } from "@/lib/admin.functions";
import { GlassPanel } from "@/components/admin/admin-shell";

export const Route = createFileRoute("/pretentious/")({
  component: Dashboard,
});

const WINDOWS = [1, 2, 7, 14, 30] as const;

function Dashboard() {
  const [w, setW] = useState<(typeof WINDOWS)[number]>(7);
  const fn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dash", w],
    queryFn: () => fn({ data: { window: w } }),
  });

  const fmt$ = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Dashboard</h1>
          <p className="text-white/50 text-sm mt-1">Operator view across users, revenue and churn.</p>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
          {WINDOWS.map((n) => (
            <button
              key={n}
              onClick={() => setW(n)}
              className={`px-3 py-1.5 text-xs rounded-lg ${
                w === n ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              {n}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Total users" value={isLoading ? "…" : data?.totalUsers?.toString() ?? "0"} />
        <Stat label={`New (last ${w}d)`} value={isLoading ? "…" : data?.newUsers?.toString() ?? "0"} />
        <Stat label="Paid users" value={isLoading ? "…" : data?.paidUsers?.toString() ?? "0"} />
        <Stat label="MRR" value={isLoading ? "…" : fmt$(data?.mrrCents ?? 0)} />
        <Stat label="ARR" value={isLoading ? "…" : fmt$(data?.arrCents ?? 0)} />
        <Stat
          label="Churn"
          value={isLoading ? "…" : `${((data?.churnRate ?? 0) * 100).toFixed(1)}%`}
        />
      </div>

      <GlassPanel className="p-6">
        <h3 className="font-display text-lg mb-2">Quick links</h3>
        <p className="text-sm text-white/60">
          Jump into Users to manage subscriptions, usage limits and access. Support shows incoming
          tickets. Landing CMS edits the public homepage copy, hero image, demo video and theme.
          Billing lists subscriptions and pending cancellation requests.
        </p>
      </GlassPanel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <GlassPanel className="p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-mono">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </GlassPanel>
  );
}
