import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  assertCanSpend,
  chargeCredits,
  CreditsExhaustedError,
  type CreditsUsage,
} from "./credits.server";

type ProviderId = "openai" | "anthropic" | "google" | "manus";

const InputSchema = z.object({
  workspace_id: z.string().uuid(),
  channel_id: z.string().uuid().optional(),
  dm_id: z.string().uuid().optional(),
  message_id: z.string().uuid(),
  mention_agent_ids: z.array(z.string().uuid()).default([]),
});

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Stream from the Lovable AI gateway (OpenAI-compatible SSE), writing partial
// content into the given message row as tokens arrive. All chat viewers
// subscribe to message UPDATE events, so they see the reply type out live.
async function streamLLMIntoRow(
  rowId: string,
  model: string,
  system: string,
  history: { role: string; content: string }[],
): Promise<void> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    await supabaseAdmin
      .from("messages")
      .update({ content: "_(LOVABLE_API_KEY not configured — this is a stub reply.)_", status: "error" })
      .eq("id", rowId);
    return;
  }

  let buffer = "";
  let lastFlushAt = 0;
  const flush = async (final: boolean) => {
    const now = Date.now();
    if (!final && now - lastFlushAt < 120) return;
    lastFlushAt = now;
    await supabaseAdmin
      .from("messages")
      .update({ content: buffer, status: final ? "complete" : "streaming" })
      .eq("id", rowId);
  };

  try {
    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: "system", content: system }, ...history],
      }),
    });

    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      buffer = `_(AI gateway error ${res.status}: ${t.slice(0, 200)})_`;
      await supabaseAdmin.from("messages").update({ content: buffer, status: "error" }).eq("id", rowId);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let leftover = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      leftover += decoder.decode(value, { stream: true });
      const lines = leftover.split("\n");
      leftover = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta: string | undefined = json.choices?.[0]?.delta?.content;
          if (delta) {
            buffer += delta;
            await flush(false);
          }
        } catch {
          // skip malformed SSE frame
        }
      }
    }
    if (buffer === "") buffer = "_(no reply)_";
    await flush(true);
  } catch (e: any) {
    buffer = buffer || `_(LLM error: ${e?.message ?? "unknown"})_`;
    await supabaseAdmin.from("messages").update({ content: buffer, status: "error" }).eq("id", rowId);
  }
}

async function callImageGen(model: string, prompt: string, handle: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return `_(@${handle} can't generate images — LOVABLE_API_KEY not configured.)_`;
  try {
    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return `_(@${handle} couldn't generate an image: ${res.status} ${t.slice(0, 200)})_`;
    }
    const json = await res.json();
    const msg = json.choices?.[0]?.message;
    const url: string | undefined =
      msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url;
    if (!url) {
      const text = msg?.content ?? "";
      return `_(@${handle} didn't return an image.)_${text ? `\n\n${text}` : ""}`;
    }
    const caption = typeof msg?.content === "string" && msg.content.trim() ? msg.content.trim() : "";
    return `${caption ? caption + "\n\n" : ""}![${prompt.slice(0, 100)}](${url})`;
  } catch (e: any) {
    return `_(@${handle} image gen error: ${e.message})_`;
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

    // Team roster — every agent gets to know its siblings + human teammates.
    const [{ data: allWsAgents }, { data: wsMembers }] = await Promise.all([
      supabase
        .from("agents")
        .select("id,name,handle,description,system_prompt")
        .eq("workspace_id", workspace_id),
      supabase
        .from("workspace_members")
        .select("user_id,role")
        .eq("workspace_id", workspace_id),
    ]);
    const memberUserIds = (wsMembers ?? []).map((m: any) => m.user_id).filter(Boolean);
    const { data: memberProfiles } =
      memberUserIds.length > 0
        ? await supabase.from("profiles").select("id,display_name").in("id", memberUserIds)
        : { data: [] as any[] };
    const profileById = new Map<string, string>(
      (memberProfiles ?? []).map((p: any) => [p.id, p.display_name ?? "Member"]),
    );
    const bio = (a: any) =>
      (a.description || (a.system_prompt ?? "").replace(/\s+/g, " ").slice(0, 120) || "Teammate").trim();
    const agentRosterLines = (allWsAgents ?? []).map(
      (a: any) => `- @${a.handle} (${a.name}): ${bio(a)}`,
    );
    const humanRosterLines = (wsMembers ?? []).map(
      (m: any) => `- ${profileById.get(m.user_id) ?? "Member"} (${m.role ?? "member"})`,
    );

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
      const agentModel: string = (agent as any).model ?? "";
      const isImageAgent =
        agent.handle === "nano" ||
        agentModel.endsWith("-image") ||
        agentModel.includes("image-preview");

      const providerDefault =
        agent.provider === "google" ? "google/gemini-2.5-flash" : "openai/gpt-5-mini";
      const model = isImageAgent
        ? agentModel && agentModel.includes("/")
          ? agentModel
          : "google/gemini-2.5-flash-image"
        : agentModel && agentModel.includes("/")
        ? agentModel
        : providerDefault;

      // Brand voice + pinned files come BEFORE the agent's own prompt so they
      // anchor tone, and KB comes after as supporting reference material.
      const selfLine = `YOU ARE: @${agent.handle} — ${agent.name}${((agent as any).description) ? `, ${(agent as any).description}` : ""}.`;
      const teammateLines = agentRosterLines.filter(
        (l) => !l.startsWith(`- @${agent.handle} `),
      );
      const rosterBlock = `\n\n---\n${selfLine}${
        teammateLines.length > 0
          ? `\nAI TEAMMATES (you can @-mention them to hand off):\n${teammateLines.join("\n")}`
          : ""
      }${
        humanRosterLines.length > 0
          ? `\nHUMAN TEAMMATES:\n${humanRosterLines.join("\n")}`
          : ""
      }\nDefer to a teammate on their specialty when relevant. Don't impersonate them.\n---`;
      const systemPrompt = `${brandBlock}${pinnedBlock}${rosterBlock}\n\n${agent.system_prompt ?? `You are ${agent.name}.`}${kbBlock}\n\nReply concisely in markdown. Stay strictly on brand.`;

      // Resolve route explicitly. The only legal values for preferred_route
      // are null (== lovable gateway) or "byok:<provider>" where <provider>
      // is one of the supported providers. setAgentRoute enforces this on
      // write; we re-validate on read because old rows may predate the
      // constraint. Anything else degrades to "lovable" rather than throwing.
      const pref = (agent as { preferred_route?: string | null }).preferred_route ?? null;
      const byokMatch = pref?.match(/^byok:(openai|anthropic|google|manus)$/);
      const byokProvider = byokMatch ? (byokMatch[1] as ProviderId) : null;

      if (isImageAgent) {
        // Image agents are one-shot — no incremental stream to render.
        const lastUser = [...history].reverse().find((m) => m.role === "user");
        const imgPrompt = lastUser?.content ?? "An image";
        const content = await callImageGen(model, imgPrompt, agent.handle);
        const { error: insertError } = await supabaseAdmin.from("messages").insert({
          workspace_id,
          channel_id: channel_id ?? null,
          dm_id: dm_id ?? null,
          author_type: "agent",
          author_agent_id: agent.id,
          content,
          status: "complete",
        } as any);
        if (insertError) console.error("agent insert failed", insertError);
        else dispatched++;
        continue;
      }

      // Text agent — insert an empty row up front so all viewers can see the
      // reply stream in via Postgres realtime UPDATE events.
      const { data: row, error: insertError } = await supabaseAdmin
        .from("messages")
        .insert({
          workspace_id,
          channel_id: channel_id ?? null,
          dm_id: dm_id ?? null,
          author_type: "agent",
          author_agent_id: agent.id,
          content: "",
          status: "streaming",
        } as any)
        .select("id")
        .single();
      if (insertError || !row) {
        console.error("agent insert failed", insertError);
        continue;
      }
      const rowId = (row as { id: string }).id;

      if (byokProvider) {
        const encrypted = byok.get(byokProvider);
        if (!encrypted) {
          await supabaseAdmin
            .from("messages")
            .update({
              content: `_(@${agent.handle} is configured to use your own ${byokProvider} key, but you haven't connected one. Add it in Profile → AI Connections, or have a workspace admin switch this agent back to the Lovable gateway.)_`,
              status: "error",
            })
            .eq("id", rowId);
        } else {
          try {
            const { decryptApiKey } = await import("./ai-crypto.server");
            const { callProvider } = await import("./ai-providers.server");
            const apiKey = await decryptApiKey(encrypted);
            const content = await callProvider(byokProvider, apiKey, agent.model ?? "", systemPrompt, history);
            await supabaseAdmin
              .from("messages")
              .update({ content, status: "complete" })
              .eq("id", rowId);
          } catch (e: any) {
            console.error("BYOK call failed", { provider: byokProvider, message: e?.message });
            await supabaseAdmin
              .from("user_ai_connections")
              .update({ status: "invalid" })
              .eq("user_id", context.userId)
              .eq("provider", byokProvider);
            await supabaseAdmin
              .from("messages")
              .update({
                content: `_(@${agent.handle} couldn't reach ${byokProvider} with your key. It's been marked invalid — please re-connect it in Profile → AI Connections.)_`,
                status: "error",
              })
              .eq("id", rowId);
          }
        }
      } else {
        await streamLLMIntoRow(rowId, model, systemPrompt, history);
      }
      dispatched++;
    }

    return { dispatched };
  });
