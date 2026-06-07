import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GlassPanel } from "@/components/admin/admin-shell";
import { Switch } from "@/components/ui/switch";
import { listFeatureFlags, setFeatureFlag } from "@/lib/feature-flags.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/pretentious/flags")({
  component: FlagsPage,
});

function FlagsPage() {
  const listFn = useServerFn(listFeatureFlags);
  const setFn = useServerFn(setFeatureFlag);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-feature-flags"],
    queryFn: () => listFn(),
  });

  const mutation = useMutation({
    mutationFn: (vars: { key: string; enabled: boolean }) => setFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(`${vars.key} ${vars.enabled ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: ["admin-feature-flags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Feature Flags</h1>
        <p className="text-white/50 text-sm mt-1">
          Global on/off switches. Changes take effect on next page load for users.
        </p>
      </div>

      <GlassPanel className="p-6">
        {isLoading ? (
          <div className="text-white/50 text-sm font-mono">loading flags…</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {data?.flags.map((f) => (
              <li key={f.key} className="py-4 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="font-mono text-sm text-white/90">{f.key}</div>
                  {f.description && (
                    <p className="text-xs text-white/50 mt-1">{f.description}</p>
                  )}
                </div>
                <Switch
                  checked={f.enabled}
                  disabled={mutation.isPending}
                  onCheckedChange={(enabled) => mutation.mutate({ key: f.key, enabled })}
                />
              </li>
            ))}
            {data?.flags.length === 0 && (
              <li className="py-4 text-white/50 text-sm">No flags configured.</li>
            )}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
