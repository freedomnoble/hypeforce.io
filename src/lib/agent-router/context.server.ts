import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RouterAgent = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  system_prompt: string | null;
  model: string | null;
  provider: string | null;
  display_name: string | null;
  role: string | null;
  personality: string | null;
  preferred_route: string | null;
  workspace_id: string;
};

export type RouterContext = {
  agents: RouterAgent[];
  overrideByAgent: Map<
    string,
    { display_name: string | null; role: string | null; personality: string | null }
  >;
  counterByAgent: Map<string, number>;
  history: { role: "user" | "assistant"; content: string }[];
  brandVoice: string | null;
  kb: { title: string; body: string | null }[];
  pinned: { filename: string; content_text: string | null }[];
  memos: {
    title: string | null;
    body: string;
    tags: string[];
    created_at: string;
    author_type: string;
    author_user_id: string | null;
    author_agent_id: string | null;
  }[];
  wsAgents: { id: string; name: string; handle: string; description: string | null; system_prompt: string | null }[];
  wsMembers: { user_id: string; role: string | null; display_name: string }[];
  byok: Map<string, string>; // provider -> encrypted_key
};

/**
 * Single batched lookup for everything the agent router needs. Replaces ~10
 * sequential round-trips with one RPC call. The RPC is SECURITY DEFINER and
 * validates that channel_id / dm_id belong to workspace_id.
 */
export async function loadRouterContext(params: {
  workspaceId: string;
  channelId: string | null;
  dmId: string | null;
  agentIds: string[];
  userId: string;
}): Promise<RouterContext> {
  const { workspaceId, channelId, dmId, agentIds, userId } = params;

  const { data, error } = await supabaseAdmin.rpc("get_agent_router_context", {
    p_workspace_id: workspaceId,
    p_channel_id: channelId,
    p_dm_id: dmId,
    p_agent_ids: agentIds,
    p_user_id: userId,
  } as any);
  if (error) {
    if (
      error.message?.includes("channel_workspace_mismatch") ||
      error.message?.includes("dm_workspace_mismatch")
    ) {
      throw new Error("Channel or DM does not belong to this workspace.");
    }
    throw error;
  }

  const raw = (data ?? {}) as any;

  const overrideByAgent = new Map<
    string,
    { display_name: string | null; role: string | null; personality: string | null }
  >();
  for (const o of (raw.overrides ?? []) as any[]) {
    overrideByAgent.set(o.agent_id, {
      display_name: o.display_name ?? null,
      role: o.role ?? null,
      personality: o.personality ?? null,
    });
  }

  const counterByAgent = new Map<string, number>();
  for (const c of (raw.counters ?? []) as any[]) {
    counterByAgent.set(c.agent_id, c.count ?? 0);
  }

  const history: { role: "user" | "assistant"; content: string }[] = ((raw.recent_messages ?? []) as any[])
    .slice()
    .reverse()
    .map((m) => ({
      role: (m.author_type === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content as string,
    }));

  const byok = new Map<string, string>();
  for (const row of (raw.byok ?? []) as any[]) {
    if (row.encrypted_key) byok.set(row.provider, row.encrypted_key);
  }

  return {
    agents: (raw.agents ?? []) as RouterAgent[],
    overrideByAgent,
    counterByAgent,
    history,
    brandVoice: raw.brand_voice ?? null,
    kb: (raw.kb ?? []) as any[],
    pinned: (raw.pinned ?? []) as any[],
    memos: (raw.memos ?? []) as any[],
    wsAgents: (raw.ws_agents ?? []) as any[],
    wsMembers: (raw.ws_members ?? []) as any[],
    byok,
  };
}
