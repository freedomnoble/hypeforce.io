import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { WorkspaceShell } from "@/components/hypeforce/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Bot, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AVAILABLE_MODELS,
  AVAILABLE_TOOLS,
  deleteOpenclawAgent,
  getOpenclawAgent,
  refreshOpenclawAgentStatus,
  restartOpenclawAgent,
  stopOpenclawAgent,
  updateOpenclawAgent,
  type OpenclawAgent,
} from "@/lib/openclaw.functions";

export const Route = createFileRoute("/_auth/w/$workspaceId/openclaw/$agentId")({
  component: AgentDetailPage,
});

const STATUS_STYLES: Record<string, string> = {
  ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  provisioning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  stopped: "bg-muted text-muted-foreground",
  error: "bg-red-500/15 text-red-600 dark:text-red-400",
};

function AgentDetailPage() {
  const { workspaceId, agentId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getOpenclawAgent);
  const refreshFn = useServerFn(refreshOpenclawAgentStatus);
  const restartFn = useServerFn(restartOpenclawAgent);
  const stopFn = useServerFn(stopOpenclawAgent);
  const deleteFn = useServerFn(deleteOpenclawAgent);

  const { data, isLoading } = useQuery({
    queryKey: ["openclaw-agent", agentId],
    queryFn: () => getFn({ data: { agentId } }),
  });
  const agent = data?.agent ?? null;

  // Auto-refresh status when provisioning
  useEffect(() => {
    if (agent?.gateway_status !== "provisioning") return;
    const t = setInterval(() => {
      refreshFn({ data: { agentId } }).then(() => {
        qc.invalidateQueries({ queryKey: ["openclaw-agent", agentId] });
      });
    }, 4000);
    return () => clearInterval(t);
  }, [agent?.gateway_status, agentId, refreshFn, qc]);

  const restart = useMutation({
    mutationFn: () => restartFn({ data: { agentId } }),
    onSuccess: () => {
      toast.success("Agent restarted");
      qc.invalidateQueries({ queryKey: ["openclaw-agent", agentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stop = useMutation({
    mutationFn: () => stopFn({ data: { agentId } }),
    onSuccess: () => {
      toast.success("Agent stopped");
      qc.invalidateQueries({ queryKey: ["openclaw-agent", agentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteFn({ data: { agentId } }),
    onSuccess: () => {
      toast.success("Agent deleted");
      qc.invalidateQueries({ queryKey: ["openclaw-agents", workspaceId] });
      navigate({ to: "/w/$workspaceId/openclaw", params: { workspaceId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <WorkspaceShell workspaceId={workspaceId}>
      <div className="min-h-full w-full px-4 sm:px-8 py-10">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/w/$workspaceId/openclaw"
            params={{ workspaceId }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All agents
          </Link>

          {isLoading ? (
            <div className="text-sm text-muted-foreground font-mono">loading…</div>
          ) : !agent ? (
            <div className="paper-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Agent not found.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 grid place-items-center shrink-0">
                    <Bot className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-display text-2xl tracking-tight truncate">
                      {agent.display_name}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground font-mono truncate">
                        {agent.model_id}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono ${
                          STATUS_STYLES[agent.gateway_status ?? ""] ??
                          "bg-muted text-muted-foreground"
                        }`}
                      >
                        {agent.gateway_status ?? "unknown"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {agent.gateway_status === "stopped" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restart.mutate()}
                      disabled={restart.isPending}
                      className="gap-1"
                    >
                      <Play className="w-3.5 h-3.5" /> Start
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restart.mutate()}
                      disabled={restart.isPending}
                      className="gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restart
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => stop.mutate()}
                    disabled={stop.isPending || agent.gateway_status === "stopped"}
                    className="gap-1"
                  >
                    <Square className="w-3.5 h-3.5" /> Stop
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This destroys the agent's Fly machine and removes all its
                          config. This can't be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => del.mutate()}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          Delete agent
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="config">Config</TabsTrigger>
                  <TabsTrigger value="runtime">Runtime</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                  <OverviewTab agent={agent} />
                </TabsContent>
                <TabsContent value="config" className="mt-4">
                  <ConfigTab agent={agent} />
                </TabsContent>
                <TabsContent value="runtime" className="mt-4">
                  <RuntimeTab agent={agent} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}

function OverviewTab({ agent }: { agent: OpenclawAgent }) {
  return (
    <>
      <div className="paper-panel rounded-2xl p-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
          Persona
        </div>
        {agent.persona.description && (
          <p className="text-sm mb-3">{agent.persona.description}</p>
        )}
        {agent.persona.tone && (
          <div className="text-xs text-muted-foreground mb-3">
            Tone: <span className="font-mono">{agent.persona.tone}</span>
          </div>
        )}
        {agent.persona.systemPrompt && (
          <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/40 rounded-lg p-3">
            {agent.persona.systemPrompt}
          </pre>
        )}
      </div>

      <div className="paper-panel rounded-2xl p-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-3">
          Skills ({agent.skill_definitions.length})
        </div>
        {agent.skill_definitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills defined.</p>
        ) : (
          <div className="space-y-3">
            {agent.skill_definitions.map((s) => (
              <div key={s.id} className="border-l-2 border-primary/30 pl-3">
                <div className="text-sm font-medium">{s.name || "Untitled"}</div>
                <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
                  {s.instructions}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="paper-panel rounded-2xl p-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-3">
          Tools ({agent.tool_allowlist.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {agent.tool_allowlist.length === 0 ? (
            <span className="text-sm text-muted-foreground">No tools enabled.</span>
          ) : (
            agent.tool_allowlist.map((t) => (
              <span
                key={t}
                className="text-xs font-mono px-2 py-1 rounded-md bg-muted"
              >
                {t}
              </span>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function ConfigTab({ agent }: { agent: OpenclawAgent }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateOpenclawAgent);
  const [displayName, setDisplayName] = useState(agent.display_name);
  const [description, setDescription] = useState(agent.persona.description ?? "");
  const [tone, setTone] = useState(agent.persona.tone ?? "Friendly");
  const [systemPrompt, setSystemPrompt] = useState(agent.persona.systemPrompt ?? "");
  const [modelId, setModelId] = useState(agent.model_id);
  const [tools, setTools] = useState<string[]>(agent.tool_allowlist);

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          agentId: agent.id,
          displayName,
          persona: { description, tone, systemPrompt },
          modelId,
          tools,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["openclaw-agent", agent.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="paper-panel rounded-2xl p-5 space-y-5">
      <div className="space-y-2">
        <Label>Display name</Label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Tone</Label>
        <Input value={tone} onChange={(e) => setTone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>System prompt</Label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
        />
      </div>
      <div className="space-y-2">
        <Label>Model</Label>
        <div className="space-y-2">
          {AVAILABLE_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModelId(m.id)}
              className={`w-full text-left p-3 rounded-xl border ${
                modelId === m.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              <div className="font-medium text-sm">{m.label}</div>
              <div className="text-xs text-muted-foreground font-mono">{m.id}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Tools</Label>
        <div className="space-y-2">
          {AVAILABLE_TOOLS.map((t) => {
            const checked = tools.includes(t.id);
            return (
              <label
                key={t.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:border-foreground/30"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    setTools(v ? [...tools, t.id] : tools.filter((x) => x !== t.id))
                  }
                />
                <span className="text-sm">{t.label}</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                  {t.id}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
        {save.isPending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

function RuntimeTab({ agent }: { agent: OpenclawAgent }) {
  const rows: [string, string | null][] = [
    ["Status", agent.gateway_status],
    ["Fly app", agent.fly_app],
    ["Fly machine", agent.fly_machine_id],
    ["Gateway URL", agent.gateway_url],
    ["Last active", agent.last_active_at],
    ["Created", agent.created_at],
  ];
  return (
    <div className="paper-panel rounded-2xl p-5">
      <dl className="divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="py-3 grid grid-cols-3 gap-3 items-start text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="col-span-2 font-mono text-xs break-all">{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
