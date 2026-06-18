import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { WorkspaceShell } from "@/components/hypeforce/workspace-shell";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, Check, ArrowLeft, Plus } from "lucide-react";
import {
  getOpenclawFlags,
  getOpenclawWaitlistStatus,
  joinOpenclawWaitlist,
  listOpenclawAgents,
} from "@/lib/openclaw.functions";
import { AgentCard } from "@/components/hypeforce/openclaw/agent-card";
import { AgentWizard } from "@/components/hypeforce/openclaw/agent-wizard";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/w/$workspaceId/openclaw")({
  component: OpenclawPage,
});

function OpenclawPage() {
  const { workspaceId } = Route.useParams();
  const flagsFn = useServerFn(getOpenclawFlags);
  const statusFn = useServerFn(getOpenclawWaitlistStatus);
  const joinFn = useServerFn(joinOpenclawWaitlist);
  const listFn = useServerFn(listOpenclawAgents);
  const qc = useQueryClient();

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ["openclaw-flags"],
    queryFn: () => flagsFn(),
    staleTime: 60_000,
  });

  const enabled = !!flags?.enabled;
  const studioOn = !!flags?.studio;

  const { data: waitlist } = useQuery({
    queryKey: ["openclaw-waitlist-status"],
    queryFn: () => statusFn(),
    enabled: studioOn && !enabled,
  });

  const join = useMutation({
    mutationFn: () => joinFn(),
    onSuccess: () => {
      toast.success("You're on the list. We'll email you when OpenClaw goes live.");
      qc.invalidateQueries({ queryKey: ["openclaw-waitlist-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <WorkspaceShell workspaceId={workspaceId}>
      <div className="min-h-full w-full px-4 sm:px-8 py-10">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/w/$workspaceId"
            params={{ workspaceId }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to workspace
          </Link>

          {flagsLoading ? (
            <div className="text-sm text-muted-foreground font-mono">loading…</div>
          ) : !studioOn ? (
            <ComingSoonPanel
              onList={false}
              onJoin={() => {}}
              joining={false}
              hideButton
              copy="OpenClaw isn't available in this workspace yet."
            />
          ) : !enabled ? (
            <ComingSoonPanel
              onList={!!waitlist?.onList}
              onJoin={() => join.mutate()}
              joining={join.isPending}
            />
          ) : (
            <AgentList workspaceId={workspaceId} listFn={listFn} />
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}

function AgentList({
  workspaceId,
  listFn,
}: {
  workspaceId: string;
  listFn: ReturnType<typeof useServerFn<typeof listOpenclawAgents>>;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["openclaw-agents", workspaceId],
    queryFn: () => listFn({ data: { workspaceId } }),
  });

  const agents = data?.agents ?? [];

  return (
    <>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
            OpenClaw
          </div>
          <h1 className="font-display text-3xl tracking-tight">Your agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Private AI agents with their own skills, persona, and tools.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New agent
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground font-mono">loading…</div>
      ) : agents.length === 0 ? (
        <div className="paper-panel rounded-2xl p-10 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 grid place-items-center">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl tracking-tight">No agents yet</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Spin up your first OpenClaw agent — give it a persona, pick a model, and
              wire up the tools it can use.
            </p>
          </div>
          <Button onClick={() => setWizardOpen(true)} className="gap-2">
            <Sparkles className="w-4 h-4" /> Create your first agent
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} workspaceId={workspaceId} />
          ))}
        </div>
      )}

      <AgentWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        workspaceId={workspaceId}
      />
    </>
  );
}

function ComingSoonPanel({
  onList,
  onJoin,
  joining,
  hideButton,
  copy,
}: {
  onList: boolean;
  onJoin: () => void;
  joining: boolean;
  hideButton?: boolean;
  copy?: string;
}) {
  return (
    <div className="paper-panel rounded-2xl p-8 sm:p-10 text-center space-y-5">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 grid place-items-center">
        <Bot className="w-7 h-7 text-primary" />
      </div>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
          Coming soon
        </div>
        <h1 className="font-display text-3xl tracking-tight">
          Your own AI agent, built in.
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {copy ??
            "OpenClaw lets you spin up a private AI agent with its own skills, persona, and tools — all inside Hypeforce. No terminals, no config files. We're polishing the final pieces now."}
        </p>
      </div>

      {!hideButton && (
        <div className="pt-2">
          {onList ? (
            <div className="inline-flex items-center gap-2 text-sm text-foreground">
              <Check className="w-4 h-4 text-emerald-500" />
              You're on the list — we'll email you when it's ready.
            </div>
          ) : (
            <Button onClick={onJoin} disabled={joining} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {joining ? "Adding you…" : "Notify me when it's ready"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
