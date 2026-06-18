import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import type { OpenclawAgent } from "@/lib/openclaw.functions";

const STATUS_STYLES: Record<string, string> = {
  ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  provisioning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  stopped: "bg-muted text-muted-foreground",
  error: "bg-red-500/15 text-red-600 dark:text-red-400",
};

function statusLabel(s: string | null) {
  if (!s) return "unknown";
  return s.replace(/_/g, " ");
}

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AgentCard({
  agent,
  workspaceId,
}: {
  agent: OpenclawAgent;
  workspaceId: string;
}) {
  const status = agent.gateway_status ?? "unknown";
  return (
    <Link
      to="/w/$workspaceId/openclaw/$agentId"
      params={{ workspaceId, agentId: agent.id }}
      className="paper-panel rounded-2xl p-5 hover:shadow-lg transition-shadow block"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg tracking-tight truncate">
              {agent.display_name}
            </h3>
            <span
              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono ${
                STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {statusLabel(status)}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
            {agent.model_id}
          </div>
          {agent.persona?.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {agent.persona.description}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>{agent.tool_allowlist.length} tools · {agent.skill_definitions.length} skills</span>
            <span>active {timeAgo(agent.last_active_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
