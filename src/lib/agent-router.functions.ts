import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ProviderId = "openai" | "anthropic" | "google" | "manus";

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

    // Verify the supplied channel_id / dm_id actually belong to workspace_id.
    // Without this, a caller can inject agent messages into channels in
    // workspaces they no longer (or never) had access to by supplying their
    // current workspace_id with a foreign channel_id.
    if (channel_id) {
      const { data: ch } = await supabaseAdmin
        .from("channels")
        .select("workspace_id")
        .eq("id", channel_id)
        .maybeSingle();
      if (!ch || ch.workspace_id !== workspace_id) {
        throw new Error("Channel does not belong to this workspace.");
      }
    }
    if (dm_id) {
      const { data: dm } = await supabaseAdmin
        .from("direct_messages")
        .select("workspace_id")
        .eq("id", dm_id)
        .maybeSingle();
      if (!dm || dm.workspace_id !== workspace_id) {
        throw new Error("DM does not belong to this workspace.");
      }
    }

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
    if (agentIds.length === 0 && dm_id) {
      const { data: parts } = await supabase
        .from("dm_participants")
        .select("agent_id")
        .eq("dm_id", dm_id)
        .eq("member_type", "agent");
      agentIds = (parts ?? []).map((m: any) => m.agent_id).filter(Boolean);
    }
    if (agentIds.length === 0) return { dispatched: 0 };


    const { data: agents } = await supabase.from("agents").select("*").in("id", agentIds);

    // Load last 10 messages for context.
    const baseQuery = supabase
      .from("messages")
      .select("content,author_type,author_agent_id,author_user_id,created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    const { data: recent } = channel_id
      ? await baseQuery.eq("channel_id", channel_id)
      : await baseQuery.eq("dm_id", dm_id ?? "");

    // Load workspace brand voice + KB briefs (kept short).
    const [{ data: ws }, { data: kb }] = await Promise.all([
      supabase.from("workspaces").select("brand_voice").eq("id", workspace_id).maybeSingle(),
      supabase
        .from("knowledge_base")
        .select("title,body")
        .eq("workspace_id", workspace_id)
        .limit(5),
    ]);

    // Pinned files in this channel (only those with extracted text).
    let pinned: { filename: string; content_text: string | null }[] = [];
    if (channel_id) {
      const { data: pf } = await supabase
        .from("files")
        .select("filename,content_text")
        .eq("channel_id", channel_id)
        .eq("is_pinned", true)
        .limit(10);
      pinned = (pf ?? []) as any;
    }

    const history: { role: "user" | "assistant"; content: string }[] = (recent ?? [])
      .reverse()
      .map((m: any) => ({
        role: (m.author_type === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content as string,
      }));

    const brandBlock = (ws as any)?.brand_voice
      ? `\n\n---\nBRAND VOICE & GUIDELINES (always follow):\n${(ws as any).brand_voice}\n---`
      : "";

    const kbBlock =
      (kb ?? []).length > 0
        ? `\n\nWorkspace knowledge:\n${(kb ?? [])
            .map((k: any) => `- ${k.title}: ${(k.body ?? "").slice(0, 400)}`)
            .join("\n")}`
        : "";

    const pinnedBlock =
      pinned.filter((p) => p.content_text).length > 0
        ? `\n\nPinned files in this channel:\n${pinned
            .filter((p) => p.content_text)
            .map((p) => `<<FILE: ${p.filename}>>\n${(p.content_text ?? "").slice(0, 4000)}\n<<END FILE>>`)
            .join("\n\n")}`
        : "";

    // Load the calling user's connected BYOK providers (we only need the
    // encrypted key for those we may actually route through).
    const { data: byokRows } = await supabase
      .from("user_ai_connections")
      .select("provider,encrypted_key,status")
      .eq("status", "active");
    const byok = new Map<ProviderId, string>();
    for (const row of byokRows ?? []) {
      byok.set(row.provider as ProviderId, (row as any).encrypted_key);
    }

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

      // Brand voice + pinned files come BEFORE the agent's own prompt so they
      // anchor tone, and KB comes after as supporting reference material.
      const systemPrompt = `${brandBlock}${pinnedBlock}\n\n${agent.system_prompt ?? `You are ${agent.name}.`}${kbBlock}\n\nReply concisely in markdown. Stay strictly on brand.`;

      // Resolve route explicitly. The only legal values for preferred_route
      // are null (== lovable gateway) or "byok:<provider>" where <provider>
      // is one of the supported providers. setAgentRoute enforces this on
      // write; we re-validate on read because old rows may predate the
      // constraint. Anything else degrades to "lovable" rather than throwing.
      let content = "";
      const pref = (agent as { preferred_route?: string | null }).preferred_route ?? null;
      const byokMatch = pref?.match(/^byok:(openai|anthropic|google|manus)$/);
      const byokProvider = byokMatch ? (byokMatch[1] as ProviderId) : null;

      if (byokProvider) {
        // BYOK route requested. Use the calling user's PERSONAL key; never
        // someone else's. If no active key exists, return a friendly agent
        // message rather than silently switching providers — admins set
        // routing intentionally and silent fallback hides misconfiguration.
        const encrypted = byok.get(byokProvider);
        if (!encrypted) {
          content = `_(@${agent.handle} is configured to use your own ${byokProvider} key, but you haven't connected one. Add it in Profile → AI Connections, or have a workspace admin switch this agent back to the Lovable gateway.)_`;
        } else {
          try {
            const { decryptApiKey } = await import("./ai-crypto.server");
            const { callProvider } = await import("./ai-providers.server");
            const apiKey = await decryptApiKey(encrypted);
            content = await callProvider(byokProvider, apiKey, agent.model ?? "", systemPrompt, history);
          } catch (e: any) {
            // Log message only — never log the key itself.
            console.error("BYOK call failed", { provider: byokProvider, message: e?.message });
            await supabaseAdmin
              .from("user_ai_connections")
              .update({ status: "invalid" })
              .eq("user_id", context.userId)
              .eq("provider", byokProvider);
            content = `_(@${agent.handle} couldn't reach ${byokProvider} with your key. It's been marked invalid — please re-connect it in Profile → AI Connections.)_`;
          }
        }
      } else {
        content = await callLLM(model, systemPrompt, history);
      }

      const { error: insertError } = await supabaseAdmin.from("messages").insert({
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
