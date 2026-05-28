import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  workspace_id: z.string().uuid(),
  channel_id: z.string().uuid().optional(),
  dm_id: z.string().uuid().optional(),
  message_id: z.string().uuid(),
  mention_agent_ids: z.array(z.string().uuid()).default([]),
});

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callLLM(model: string, system: string, history: { role: string; content: string }[]) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return "_(LOVABLE_API_KEY not configured — this is a stub reply.)_";
  try {
    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...history],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return `_(AI gateway error ${res.status}: ${t.slice(0, 200)})_`;
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "_(no reply)_";
  } catch (e: any) {
    return `_(LLM error: ${e.message})_`;
  }
}

export const invokeAgentRouter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { workspace_id, channel_id, dm_id, mention_agent_ids } = data;

    // Determine which agents should reply.
    let agentIds: string[] = mention_agent_ids;
    if (agentIds.length === 0 && channel_id) {
      const { data: members } = await supabase
        .from("channel_members")
        .select("agent_id")
        .eq("channel_id", channel_id)
        .eq("member_type", "agent");
      agentIds = (members ?? []).map((m: any) => m.agent_id).filter(Boolean);
    }
    if (agentIds.length === 0) return { dispatched: 0 };

    const { data: agents } = await supabase.from("agents").select("*").in("id", agentIds);

    // Load last 20 messages for context.
    const baseQuery = supabase
      .from("messages")
      .select("content,author_type,author_agent_id,author_user_id,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: recent } = channel_id
      ? await baseQuery.eq("channel_id", channel_id)
      : await baseQuery.eq("dm_id", dm_id ?? "");

    // Load knowledge base briefs (kept short).
    const { data: kb } = await supabase
      .from("knowledge_base")
      .select("title,body")
      .eq("workspace_id", workspace_id)
      .limit(5);

    const history = (recent ?? [])
      .reverse()
      .map((m: any) => ({
        role: m.author_type === "user" ? "user" : "assistant",
        content: m.content,
      }));

    const kbBlock =
      (kb ?? []).length > 0
        ? `\n\nWorkspace knowledge:\n${(kb ?? [])
            .map((k: any) => `- ${k.title}: ${(k.body ?? "").slice(0, 400)}`)
            .join("\n")}`
        : "";

    // For each agent, generate and insert a reply.
    let dispatched = 0;
    for (const agent of agents ?? []) {
      const model =
        agent.provider === "google"
          ? "google/gemini-2.5-flash"
          : agent.provider === "anthropic"
          ? "openai/gpt-5-mini"
          : agent.provider === "manus"
          ? "openai/gpt-5-mini"
          : "openai/gpt-5-mini";

      const systemPrompt = `${agent.system_prompt ?? `You are ${agent.name}.`}${kbBlock}\n\nReply concisely in markdown.`;
      const content = await callLLM(model, systemPrompt, history);

      const { error: insertError } = await supabase.from("messages").insert({
        workspace_id,
        channel_id: channel_id ?? null,
        dm_id: dm_id ?? null,
        author_type: "agent",
        author_agent_id: agent.id,
        content,
      } as any);
      if (insertError) console.error("agent insert failed", insertError);
      else dispatched++;
    }

    return { dispatched };
  });
