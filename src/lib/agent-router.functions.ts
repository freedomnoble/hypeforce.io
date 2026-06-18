import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadRouterContext } from "./agent-router/context.server";
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

// Extract <memo title="..." tags="a,b">body</memo> blocks from a model reply.
function extractMemos(raw: string): {
  cleaned: string;
  memos: { title: string | null; tags: string[]; body: string }[];
} {
  const memos: { title: string | null; tags: string[]; body: string }[] = [];
  const re = /<memo\b([^>]*)>([\s\S]*?)<\/memo>/gi;
  let cleaned = raw.replace(re, (_full, attrs: string, body: string) => {
    const titleMatch = attrs.match(/title\s*=\s*"([^"]*)"/i);
    const tagsMatch = attrs.match(/tags\s*=\s*"([^"]*)"/i);
    const tags = tagsMatch
      ? tagsMatch[1]
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];
    memos.push({
      title: titleMatch ? titleMatch[1].trim().slice(0, 160) || null : null,
      tags,
      body: body.trim().slice(0, 8000),
    });
    return "";
  });
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  if (memos.length > 0) {
    const note =
      memos.length === 1
        ? "_— logged 1 memo to project log_"
        : `_— logged ${memos.length} memos to project log_`;
    cleaned = cleaned ? `${cleaned}\n\n${note}` : note;
  }
  return { cleaned, memos };
}

async function persistMemos(
  rowId: string,
  workspaceId: string,
  channelId: string,
  agentId: string,
  cleaned: string,
  memos: { title: string | null; tags: string[]; body: string }[],
) {
  if (memos.length === 0) return;
  await supabaseAdmin.from("messages").update({ content: cleaned }).eq("id", rowId);
  const rows = memos.map((m) => ({
    workspace_id: workspaceId,
    channel_id: channelId,
    author_type: "agent",
    author_agent_id: agentId,
    title: m.title,
    body: m.body,
    tags: m.tags,
    source_message_id: rowId,
  }));
  const { error } = await supabaseAdmin.from("channel_memos").insert(rows as any);
  if (error) console.error("memo insert failed", error);
}

// Stream from the Lovable AI gateway (OpenAI-compatible SSE), writing partial
// content into the given message row as tokens arrive. All chat viewers
// subscribe to message UPDATE events, so they see the reply type out live.
async function streamLLMIntoRow(
  rowId: string,
  model: string,
  system: string,
  history: { role: string; content: string }[],
): Promise<CreditsUsage> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    await supabaseAdmin
      .from("messages")
      .update({ content: "_(LOVABLE_API_KEY not configured — this is a stub reply.)_", status: "error" })
      .eq("id", rowId);
    return {};
  }

  let buffer = "";
  let lastFlushAt = 0;
  let usage: CreditsUsage = {};
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
        stream_options: { include_usage: true },
        messages: [{ role: "system", content: system }, ...history],
      }),
    });

    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      buffer = `_(AI gateway error ${res.status}: ${t.slice(0, 200)})_`;
      await supabaseAdmin.from("messages").update({ content: buffer, status: "error" }).eq("id", rowId);
      return {};
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
          if (json.usage) {
            usage = {
              prompt_tokens: json.usage.prompt_tokens ?? 0,
              completion_tokens: json.usage.completion_tokens ?? 0,
            };
          }
        } catch {
          // skip malformed SSE frame
        }
      }
    }
    if (buffer === "") buffer = "_(no reply)_";
    await flush(true);
    return usage;
  } catch (e: any) {
    buffer = buffer || `_(LLM error: ${e?.message ?? "unknown"})_`;
    await supabaseAdmin.from("messages").update({ content: buffer, status: "error" }).eq("id", rowId);
    return usage;
  }
}

async function callImageGen(
  model: string,
  prompt: string,
  handle: string,
): Promise<{ content: string; imageCount: number }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey)
    return {
      content: `_(@${handle} can't generate images — LOVABLE_API_KEY not configured.)_`,
      imageCount: 0,
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
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return {
        content: `_(@${handle} couldn't generate an image: ${res.status} ${t.slice(0, 200)})_`,
        imageCount: 0,
      };
    }
    const json = await res.json();
    const msg = json.choices?.[0]?.message;
    const url: string | undefined =
      msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url;
    if (!url) {
      const text = msg?.content ?? "";
      return {
        content: `_(@${handle} didn't return an image.)_${text ? `\n\n${text}` : ""}`,
        imageCount: 0,
      };
    }
    const caption = typeof msg?.content === "string" && msg.content.trim() ? msg.content.trim() : "";
    return {
      content: `${caption ? caption + "\n\n" : ""}![${prompt.slice(0, 100)}](${url})`,
      imageCount: 1,
    };
  } catch (e: any) {
    return { content: `_(@${handle} image gen error: ${e.message})_`, imageCount: 0 };
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

    // Load per-channel identity overrides + reply counters (server-only).
    const overrideByAgent = new Map<
      string,
      { display_name: string | null; role: string | null; personality: string | null }
    >();
    const counterByAgent = new Map<string, number>();
    if (channel_id) {
      const [{ data: ovr }, { data: ctr }] = await Promise.all([
        supabaseAdmin
          .from("channel_agent_overrides")
          .select("agent_id,display_name,role,personality")
          .eq("channel_id", channel_id)
          .in("agent_id", agentIds),
        supabaseAdmin
          .from("agent_reply_counters")
          .select("agent_id,count")
          .eq("channel_id", channel_id)
          .in("agent_id", agentIds),
      ]);
      for (const o of (ovr ?? []) as any[]) {
        overrideByAgent.set(o.agent_id, {
          display_name: o.display_name ?? null,
          role: o.role ?? null,
          personality: o.personality ?? null,
        });
      }
      for (const c of (ctr ?? []) as any[]) {
        counterByAgent.set(c.agent_id, c.count ?? 0);
      }
    }

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

    // Recent project-log memos for this channel.
    let memos: {
      title: string | null;
      body: string;
      tags: string[];
      created_at: string;
      author_type: string;
      author_user_id: string | null;
      author_agent_id: string | null;
    }[] = [];
    if (channel_id) {
      const { data: ms } = await supabase
        .from("channel_memos")
        .select("title,body,tags,created_at,author_type,author_user_id,author_agent_id")
        .eq("channel_id", channel_id)
        .order("created_at", { ascending: false })
        .limit(15);
      memos = ((ms ?? []) as any[]).reverse();
    }

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
    const handleByAgentId = new Map<string, string>(
      (allWsAgents ?? []).map((a: any) => [a.id, a.handle]),
    );
    const bio = (a: any) =>
      (a.description || (a.system_prompt ?? "").replace(/\s+/g, " ").slice(0, 120) || "Teammate").trim();
    const agentRosterLines = (allWsAgents ?? []).map(
      (a: any) => `- @${a.handle} (${a.name}): ${bio(a)}`,
    );
    const humanRosterLines = (wsMembers ?? []).map(
      (m: any) => `- ${profileById.get(m.user_id) ?? "Member"} (${m.role ?? "member"})`,
    );

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
        ? `\n\n# Pinned files (always-on context for this channel)\n${pinned
            .filter((p) => p.content_text)
            .map((p) => `<<FILE: ${p.filename}>>\n${(p.content_text ?? "").slice(0, 12000)}\n<<END FILE>>`)
            .join("\n\n")}`
        : "";

    const memoBlock =
      memos.length > 0
        ? `\n\n# Project log (shared notebook — humans and agents append memos here)\n${memos
            .map((m) => {
              const who =
                m.author_type === "agent" && m.author_agent_id
                  ? `@${handleByAgentId.get(m.author_agent_id) ?? "agent"}`
                  : m.author_type === "user" && m.author_user_id
                  ? profileById.get(m.author_user_id) ?? "human teammate"
                  : "teammate";
              const head = m.title ? `## ${m.title} — ${who}` : `## ${who}`;
              const tags = m.tags?.length ? ` _[${m.tags.join(", ")}]_` : "";
              return `${head}${tags}\n${(m.body ?? "").slice(0, 2000)}`;
            })
            .join("\n\n")}`
        : "";



    // Load the calling user's connected BYOK providers. The encrypted_key
    // column is NOT readable by the `authenticated` role (see migration
    // 20260618 — column-level GRANT excludes it). Use the admin client,
    // explicitly scoped to the authenticated userId.
    const { data: byokRows } = await supabaseAdmin
      .from("user_ai_connections")
      .select("provider,encrypted_key,status")
      .eq("user_id", context.userId)
      .eq("status", "active");
    const byok = new Map<ProviderId, string>();
    for (const row of byokRows ?? []) {
      byok.set(row.provider as ProviderId, (row as any).encrypted_key);
    }

    // For each agent, generate and insert a reply.
    let dispatched = 0;
    let blockedByCredits = false;
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

      // Effective identity = override ?? agent default.
      const ovr = overrideByAgent.get(agent.id);
      const effectiveDisplayName =
        ovr?.display_name?.trim() ||
        (agent as any).display_name?.trim() ||
        agent.name;
      const effectiveRole = ovr?.role?.trim() || (agent as any).role?.trim() || "";
      const effectivePersonality =
        ovr?.personality?.trim() || (agent as any).personality?.trim() || "";

      const identityHeader = `Identity: ${effectiveDisplayName}${effectiveRole ? ` — ${effectiveRole}` : ""}`;
      const fullIdentityBlock =
        effectiveRole || effectivePersonality
          ? `You are ${effectiveDisplayName}${effectiveRole ? `, ${effectiveRole}` : ""}.${
              effectivePersonality ? `\n${effectivePersonality}` : ""
            }\nStay in character. Don't break this persona.`
          : `You are ${effectiveDisplayName}.`;

      // Bump per-channel reply counter; every 10th reply re-inject full identity.
      let replyNumber = 0;
      if (channel_id) {
        replyNumber = (counterByAgent.get(agent.id) ?? 0) + 1;
        counterByAgent.set(agent.id, replyNumber);
        await supabaseAdmin
          .from("agent_reply_counters")
          .upsert(
            { channel_id, agent_id: agent.id, count: replyNumber, updated_at: new Date().toISOString() } as any,
            { onConflict: "channel_id,agent_id" },
          );
      }
      const shouldReinforceIdentity =
        replyNumber > 0 && replyNumber % 10 === 0 && (effectiveRole || effectivePersonality);
      const identityReminderBlock = shouldReinforceIdentity
        ? `\n\n# Reminder of who you are\n${fullIdentityBlock}`
        : "";

      const selfLine = `YOU ARE: @${agent.handle} — ${effectiveDisplayName}${effectiveRole ? `, ${effectiveRole}` : ""}${((agent as any).description) ? `. ${(agent as any).description}` : ""}.`;
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
      const memoInstructions = `\n\n# Project log — writing memos\nWhen you decide something concrete, learn a fact worth remembering, or finish a unit of work that teammates need to know about, emit one or more blocks like:\n<memo title="Optional short title" tags="decision,api">Markdown body that captures the takeaway concisely.</memo>\nThese blocks are stripped from your visible reply and saved to the channel's shared project log so humans and other agents can build on them. Use sparingly — only when it advances shared context, not for chit-chat.`;
      const systemPrompt = `${identityHeader}\n${brandBlock}${pinnedBlock}${memoBlock}${rosterBlock}${identityReminderBlock}\n\n${fullIdentityBlock}\n\n${agent.system_prompt ?? `You are ${effectiveDisplayName}.`}${kbBlock}${memoInstructions}\n\nReply concisely in markdown. Stay strictly on brand and in character.`;

      const pref = (agent as { preferred_route?: string | null }).preferred_route ?? null;
      const byokMatch = pref?.match(/^byok:(openai|anthropic|google|manus)$/);
      const byokProvider = byokMatch ? (byokMatch[1] as ProviderId) : null;

      // Pre-flight credit check for gateway-routed agents (BYOK is unmetered).
      if (!byokProvider) {
        try {
          await assertCanSpend(context.userId);
        } catch (e) {
          if (e instanceof CreditsExhaustedError) {
            blockedByCredits = true;
            continue;
          }
          throw e;
        }
      }

      if (isImageAgent) {
        const lastUser = [...history].reverse().find((m) => m.role === "user");
        const imgPrompt = lastUser?.content ?? "An image";
        const { content, imageCount } = await callImageGen(model, imgPrompt, agent.handle);
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("messages")
          .insert({
            workspace_id,
            channel_id: channel_id ?? null,
            dm_id: dm_id ?? null,
            author_type: "agent",
            author_agent_id: agent.id,
            content,
            status: "complete",
          } as any)
          .select("id")
          .single();
        if (insertError) {
          console.error("agent insert failed", insertError);
        } else {
          dispatched++;
          if (imageCount > 0 && !byokProvider) {
            await chargeCredits({
              user_id: context.userId,
              workspace_id,
              message_id: (inserted as { id: string } | null)?.id ?? null,
              agent_id: agent.id,
              model,
              kind: "image",
              usage: { image_count: imageCount },
            });
          }
        }
        continue;
      }

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
            const rawContent = await callProvider(byokProvider, apiKey, agent.model ?? "", systemPrompt, history);
            const { cleaned, memos } = extractMemos(rawContent);
            await supabaseAdmin
              .from("messages")
              .update({ content: cleaned, status: "complete" })
              .eq("id", rowId);
            if (channel_id && memos.length > 0) {
              await persistMemos(rowId, workspace_id, channel_id, agent.id, cleaned, memos);
            }
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
        const usage = await streamLLMIntoRow(rowId, model, systemPrompt, history);
        if ((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0) > 0) {
          await chargeCredits({
            user_id: context.userId,
            workspace_id,
            message_id: rowId,
            agent_id: agent.id,
            model,
            kind: "text",
            usage,
          });
        }
        // Post-process memo tags out of the streamed reply.
        if (channel_id) {
          const { data: finalRow } = await supabaseAdmin
            .from("messages")
            .select("content")
            .eq("id", rowId)
            .maybeSingle();
          const raw = (finalRow as { content: string } | null)?.content ?? "";
          const { cleaned, memos } = extractMemos(raw);
          if (memos.length > 0) {
            await persistMemos(rowId, workspace_id, channel_id, agent.id, cleaned, memos);
          }
        }
      }
      dispatched++;
    }

    // If at least one gateway-routed agent was blocked, post a single system
    // notice with a top-up CTA. We use the originating user's row as a
    // synthetic "system" message — channel-scoped, surfaced inline.
    if (blockedByCredits) {
      await supabaseAdmin.from("messages").insert({
        workspace_id,
        channel_id: channel_id ?? null,
        dm_id: dm_id ?? null,
        author_type: "agent",
        author_agent_id: (agents ?? [])[0]?.id ?? null,
        content:
          "_You're out of credits. Top up to continue using gateway agents, or switch this agent to your own API key in Profile → AI Connections._",
        status: "error",
      } as any);
    }

    return { dispatched, blockedByCredits };
  });
