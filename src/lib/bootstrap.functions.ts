import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Idempotent repair path for new/broken user accounts.
 * Verifies & creates: profile, default workspace + owner membership +
 * user_role, default channel, starter agents. Safe to call repeatedly.
 *
 * Uses the admin client (server-only) to bypass RLS on initial seed,
 * but is always scoped to the authenticated userId from the request.
 */
export const ensureUserBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Profile
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authUser?.user?.email ?? null;
    const displayName =
      (authUser?.user?.user_metadata as Record<string, unknown> | undefined)?.[
        "display_name"
      ] as string | undefined ?? (email ? email.split("@")[0] : "User");

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: userId, email, display_name: displayName },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (profileErr) throw new Error(`profile: ${profileErr.message}`);

    // 2. Workspace membership
    const { data: existingMembership, error: memErr } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (memErr) throw new Error(`membership lookup: ${memErr.message}`);

    let workspaceId: string;

    if (existingMembership?.workspace_id) {
      workspaceId = existingMembership.workspace_id;
    } else {
      const slug = `atelier-${userId.slice(0, 8)}`;
      const { data: ws, error: wsErr } = await supabaseAdmin
        .from("workspaces")
        .insert({ name: "The Atelier", slug, owner_id: userId })
        .select("id")
        .single();
      if (wsErr || !ws) throw new Error(`workspace: ${wsErr?.message ?? "unknown"}`);
      workspaceId = ws.id;

      const { error: wmErr } = await supabaseAdmin
        .from("workspace_members")
        .insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
      if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, workspace_id: workspaceId, role: "owner" });
    }

    // 3. Starter agents (idempotent — only insert missing handles)
    const starters = [
      {
        name: "Manus",
        handle: "manus",
        provider: "manus",
        model: "manus-default",
        description: "Autonomous research & ops agent",
        system_prompt:
          "You are Manus, an autonomous research and operations agent. Be concise, practical, and structured.",
        avatar_url: "/avatars/manus.png",
      },
      {
        name: "ChatGPT",
        handle: "chatgpt",
        provider: "openai",
        model: "openai/gpt-5-mini",
        description: "Generalist & code copilot",
        system_prompt:
          "You are ChatGPT, a friendly generalist and code copilot. Be helpful, accurate, and clear.",
        avatar_url: "/avatars/chatgpt.png",
      },
      {
        name: "Claude",
        handle: "claude",
        provider: "anthropic",
        model: "openai/gpt-5-mini",
        description: "Long-form writing & reasoning",
        system_prompt:
          "You are Claude, a thoughtful writer and reasoner. Favor clarity, nuance, and warmth.",
        avatar_url: "/avatars/claude.png",
      },
      {
        name: "Gemini",
        handle: "gemini",
        provider: "google",
        model: "google/gemini-3-flash-preview",
        description: "Fast multimodal assistant",
        system_prompt:
          "You are Gemini, a fast multimodal assistant. Be quick, structured, and friendly.",
        avatar_url: "/avatars/gemini.png",
      },
    ];

    const { data: existingAgents } = await supabaseAdmin
      .from("agents")
      .select("handle")
      .eq("workspace_id", workspaceId);
    const existingHandles = new Set((existingAgents ?? []).map((a) => a.handle));
    const toInsert = starters
      .filter((s) => !existingHandles.has(s.handle))
      .map((s) => ({ ...s, workspace_id: workspaceId }));
    if (toInsert.length > 0) {
      await supabaseAdmin.from("agents").insert(toInsert);
    }

    // 4. Default channel
    const { data: existingChannel } = await supabaseAdmin
      .from("channels")
      .select("id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let channelId: string;
    if (existingChannel?.id) {
      channelId = existingChannel.id;
    } else {
      const { data: ch, error: chErr } = await supabaseAdmin
        .from("channels")
        .insert({
          workspace_id: workspaceId,
          name: "launch-plan",
          topic: "Q3 launch sequence — agents collaborating on GTM",
          is_pinned: true,
          created_by: userId,
        })
        .select("id")
        .single();
      if (chErr || !ch) throw new Error(`channel: ${chErr?.message ?? "unknown"}`);
      channelId = ch.id;

      // Add the user + all agents as channel members
      await supabaseAdmin
        .from("channel_members")
        .insert({ channel_id: channelId, member_type: "user", user_id: userId });

      const { data: agents } = await supabaseAdmin
        .from("agents")
        .select("id")
        .eq("workspace_id", workspaceId);
      if (agents && agents.length > 0) {
        await supabaseAdmin.from("channel_members").insert(
          agents.map((a) => ({
            channel_id: channelId,
            member_type: "agent" as const,
            agent_id: a.id,
          })),
        );
      }
    }

    return { workspaceId, channelId };
  });
