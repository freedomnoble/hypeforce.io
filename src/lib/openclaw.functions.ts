import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OpenclawFlags = {
  studio: boolean;
  enabled: boolean;
};

export const getOpenclawFlags = createServerFn({ method: "GET" }).handler(
  async (): Promise<OpenclawFlags> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("feature_flags")
      .select("key, enabled")
      .in("key", ["openclaw_studio", "openclaw_enabled"]);
    const map = new Map((data ?? []).map((r: any) => [r.key, !!r.enabled]));
    return {
      studio: map.get("openclaw_studio") ?? false,
      enabled: map.get("openclaw_enabled") ?? false,
    };
  },
);

export type WaitlistStatus = { onList: boolean };

export const getOpenclawWaitlistStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WaitlistStatus> => {
    const { data } = await context.supabase
      .from("openclaw_waitlist")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { onList: !!data };
  });

export const joinOpenclawWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WaitlistStatus> => {
    const { error } = await context.supabase
      .from("openclaw_waitlist")
      .upsert({ user_id: context.userId }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { onList: true };
  });

// ----- Phase 2: agent CRUD + Fly provisioning -----------------------------

export type OpenclawPersona = {
  description?: string;
  systemPrompt?: string;
  tone?: string;
};

export type OpenclawSkill = {
  id: string;
  name: string;
  instructions: string;
};

export type OpenclawAgent = {
  id: string;
  user_id: string;
  workspace_id: string;
  display_name: string;
  persona: OpenclawPersona;
  model_id: string;
  tool_allowlist: string[];
  skill_definitions: OpenclawSkill[];
  fly_app: string | null;
  fly_machine_id: string | null;
  gateway_url: string | null;
  gateway_status: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
};

export const AVAILABLE_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini" },
  { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5" },
] as const;

export type AvailableModel = {
  id: string;
  label: string;
  group: "gateway" | "byok";
  provider?: string;
  badge?: string;
};

const BYOK_PROVIDER_LABEL: Record<string, string> = {
  openai: "Your OpenAI key",
  anthropic: "Your Anthropic key",
  google: "Your Google key",
  manus: "Your Manus key",
};

/**
 * Returns the model list shown in the AgentWizard: the canonical gateway
 * models, plus one entry per provider the caller has connected via BYOK.
 * Only reads provider + status from `user_ai_connections` — never the
 * encrypted key.
 */
export const listAvailableModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AvailableModel[]> => {
    const gateway: AvailableModel[] = AVAILABLE_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      group: "gateway",
    }));

    const { data: conns } = await context.supabase
      .from("user_ai_connections")
      .select("provider,status")
      .eq("user_id", context.userId)
      .eq("status", "active");

    const byok: AvailableModel[] = (conns ?? []).map((c: any) => ({
      id: `byok:${c.provider}`,
      label: BYOK_PROVIDER_LABEL[c.provider] ?? `Your ${c.provider} key`,
      group: "byok",
      provider: c.provider,
      badge: "BYOK",
    }));

    return [...gateway, ...byok];
  });


export const AVAILABLE_TOOLS = [
  { id: "web_search", label: "Web search" },
  { id: "code_exec", label: "Code execution" },
  { id: "image_gen", label: "Image generation" },
  { id: "http_fetch", label: "HTTP fetch" },
] as const;

function normalizeAgent(row: any): OpenclawAgent {
  return {
    ...row,
    persona: (row.persona ?? {}) as OpenclawPersona,
    tool_allowlist: (row.tool_allowlist ?? []) as string[],
    skill_definitions: (row.skill_definitions ?? []) as OpenclawSkill[],
  };
}

async function assertCanUse(supabase: any, userId: string) {
  const { data } = await supabase.rpc("openclaw_can_use", { uid: userId });
  if (!data?.allowed) {
    throw new Error(
      data?.reason === "cogs_capped"
        ? "Monthly OpenClaw usage cap reached."
        : "OpenClaw requires an active subscription.",
    );
  }
}

export const listOpenclawAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string }) => d)
  .handler(async ({ data, context }): Promise<{ agents: OpenclawAgent[] }> => {
    const { data: rows, error } = await context.supabase
      .from("openclaw_agents")
      .select("*")
      .eq("user_id", context.userId)
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { agents: (rows ?? []).map(normalizeAgent) };
  });

export const getOpenclawAgent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { agentId: string }) => d)
  .handler(async ({ data, context }): Promise<{ agent: OpenclawAgent | null }> => {
    const { data: row, error } = await context.supabase
      .from("openclaw_agents")
      .select("*")
      .eq("id", data.agentId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { agent: row ? normalizeAgent(row) : null };
  });

export type CreateAgentInput = {
  workspaceId: string;
  displayName: string;
  persona: OpenclawPersona;
  modelId: string;
  skills: OpenclawSkill[];
  tools: string[];
};

export const createOpenclawAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CreateAgentInput) => d)
  .handler(async ({ data, context }): Promise<{ agent: OpenclawAgent }> => {
    if (!data.displayName?.trim()) throw new Error("Display name is required.");
    if (!AVAILABLE_MODELS.find((m) => m.id === data.modelId)) {
      throw new Error("Unknown model.");
    }
    await assertCanUse(context.supabase, context.userId);

    const { data: inserted, error } = await context.supabase
      .from("openclaw_agents")
      .insert({
        user_id: context.userId,
        workspace_id: data.workspaceId,
        display_name: data.displayName.trim(),
        persona: data.persona ?? {},
        model_id: data.modelId,
        tool_allowlist: data.tools ?? [],
        skill_definitions: data.skills ?? [],
        gateway_status: "provisioning",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Kick off Fly provisioning. Failures are caught and recorded on the row
    // so the UI can show an error state without breaking the create flow.
    try {
      const { provisionAgent } = await import("@/lib/fly.server");
      const result = await provisionAgent({
        agentId: inserted.id,
        env: {
          AGENT_ID: inserted.id,
          AGENT_MODEL: inserted.model_id ?? "",
          AGENT_TOOLS: (inserted.tool_allowlist ?? []).join(","),
          AGENT_PERSONA: JSON.stringify(inserted.persona ?? {}),
          AGENT_SKILLS: JSON.stringify(inserted.skill_definitions ?? []),
          HYPEFORCE_USER_ID: context.userId,
        },
      });
      const { data: updated } = await context.supabase
        .from("openclaw_agents")
        .update({
          fly_app: result.app,
          fly_machine_id: result.machineId,
          gateway_url: result.gatewayUrl,
          gateway_status: "ready",
        })
        .eq("id", inserted.id)
        .select("*")
        .single();
      return { agent: normalizeAgent(updated ?? inserted) };
    } catch (e: any) {
      console.error("openclaw provision failed", e);
      await context.supabase
        .from("openclaw_agents")
        .update({ gateway_status: "error" })
        .eq("id", inserted.id);
      return { agent: normalizeAgent({ ...inserted, gateway_status: "error" }) };
    }
  });

export type UpdateAgentInput = {
  agentId: string;
  displayName?: string;
  persona?: OpenclawPersona;
  modelId?: string;
  skills?: OpenclawSkill[];
  tools?: string[];
};

export const updateOpenclawAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: UpdateAgentInput) => d)
  .handler(async ({ data, context }): Promise<{ agent: OpenclawAgent }> => {
    const patch: Record<string, any> = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName.trim();
    if (data.persona !== undefined) patch.persona = data.persona;
    if (data.modelId !== undefined) patch.model_id = data.modelId;
    if (data.skills !== undefined) patch.skill_definitions = data.skills;
    if (data.tools !== undefined) patch.tool_allowlist = data.tools;
    const { data: row, error } = await context.supabase
      .from("openclaw_agents")
      .update(patch as never)
      .eq("id", data.agentId)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { agent: normalizeAgent(row) };
  });

async function loadOwnedAgent(supabase: any, userId: string, agentId: string) {
  const { data: row, error } = await supabase
    .from("openclaw_agents")
    .select("*")
    .eq("id", agentId)
    .eq("user_id", userId)
    .single();
  if (error || !row) throw new Error("Agent not found.");
  return row;
}

export const restartOpenclawAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { agentId: string }) => d)
  .handler(async ({ data, context }) => {
    const row = await loadOwnedAgent(context.supabase, context.userId, data.agentId);
    if (!row.fly_app || !row.fly_machine_id) throw new Error("Agent is not provisioned.");
    await assertCanUse(context.supabase, context.userId);
    const { restartMachine } = await import("@/lib/fly.server");
    await restartMachine(row.fly_app, row.fly_machine_id);
    await context.supabase
      .from("openclaw_agents")
      .update({ gateway_status: "ready" })
      .eq("id", row.id);
    return { ok: true };
  });

export const stopOpenclawAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { agentId: string }) => d)
  .handler(async ({ data, context }) => {
    const row = await loadOwnedAgent(context.supabase, context.userId, data.agentId);
    if (!row.fly_app || !row.fly_machine_id) throw new Error("Agent is not provisioned.");
    const { stopMachine } = await import("@/lib/fly.server");
    await stopMachine(row.fly_app, row.fly_machine_id);
    await context.supabase
      .from("openclaw_agents")
      .update({ gateway_status: "stopped" })
      .eq("id", row.id);
    return { ok: true };
  });

export const deleteOpenclawAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { agentId: string }) => d)
  .handler(async ({ data, context }) => {
    const row = await loadOwnedAgent(context.supabase, context.userId, data.agentId);
    if (row.fly_app && row.fly_machine_id) {
      try {
        const { destroyAgent } = await import("@/lib/fly.server");
        await destroyAgent(row.fly_app, row.fly_machine_id);
      } catch (e) {
        console.error("openclaw destroy failed", e);
      }
    }
    const { error } = await context.supabase
      .from("openclaw_agents")
      .delete()
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refreshOpenclawAgentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { agentId: string }) => d)
  .handler(async ({ data, context }): Promise<{ agent: OpenclawAgent }> => {
    const row = await loadOwnedAgent(context.supabase, context.userId, data.agentId);
    if (!row.fly_app || !row.fly_machine_id) return { agent: normalizeAgent(row) };
    try {
      const { getMachine } = await import("@/lib/fly.server");
      const m = await getMachine(row.fly_app, row.fly_machine_id);
      const status =
        m?.state === "started" || m?.state === "running"
          ? "ready"
          : m?.state === "stopped"
            ? "stopped"
            : m?.state === "destroyed"
              ? "error"
              : (m?.state ?? row.gateway_status);
      const { data: updated } = await context.supabase
        .from("openclaw_agents")
        .update({ gateway_status: status })
        .eq("id", row.id)
        .select("*")
        .single();
      return { agent: normalizeAgent(updated ?? row) };
    } catch (e) {
      return { agent: normalizeAgent(row) };
    }
  });
