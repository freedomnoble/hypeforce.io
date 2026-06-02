import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Atomic collaboration-creation server functions.
 *
 * These run server-side because each flow performs multiple inserts that
 * must either all succeed or all roll back. Performing them from the
 * browser leaves orphan rows (e.g. a workspace with no owner membership,
 * a channel the creator can't see, a DM with no participants) whenever
 * the second write fails or RLS rejects it. Running on the server lets
 * us validate membership with the authenticated user id and clean up
 * the parent row on partial failure.
 *
 * The authenticated userId is taken from `requireSupabaseAuth` (verified
 * JWT). We use the service-role admin client only on the server to
 * guarantee cleanup writes succeed even when RLS doesn't grant delete
 * (e.g. direct_messages has no DELETE policy).
 */

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ---------- createWorkspaceWithOwner ----------

const CreateWorkspaceInput = z.object({
  name: z.string().min(1).max(80),
});

export const createWorkspaceWithOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateWorkspaceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const admin = await getAdmin();

    const slug =
      data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);

    const { data: ws, error: wsErr } = await admin
      .from("workspaces")
      .insert({ name: data.name, slug, owner_id: userId })
      .select("id")
      .single();
    if (wsErr || !ws) throw new Error(`Couldn't create workspace: ${wsErr?.message ?? "unknown"}`);

    const { error: memErr } = await admin
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: userId, role: "owner" });
    if (memErr) {
      // Roll back orphan workspace
      await admin.from("workspaces").delete().eq("id", ws.id);
      throw new Error(`Couldn't create membership: ${memErr.message}`);
    }

    await admin
      .from("user_roles")
      .insert({ user_id: userId, workspace_id: ws.id, role: "owner" });

    return {
      workspaceId: ws.id,
      landingTo: "/w/$workspaceId" as const,
      landingParams: { workspaceId: ws.id },
    };
  });

// ---------- createChannelWithMembership ----------

const CreateChannelInput = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(80),
});

export const createChannelWithMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateChannelInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const admin = await getAdmin();

    // Validate the caller is a member of the workspace.
    const { data: mem, error: memErr } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!mem) throw new Error("You are not a member of this workspace.");

    const normalized = data.name.toLowerCase().replace(/\s+/g, "-");

    const { data: ch, error: chErr } = await admin
      .from("channels")
      .insert({
        workspace_id: data.workspaceId,
        name: normalized,
        created_by: userId,
      })
      .select("id, name, topic, is_pinned")
      .single();
    if (chErr || !ch) throw new Error(`Couldn't create channel: ${chErr?.message ?? "unknown"}`);

    const { error: cmErr } = await admin
      .from("channel_members")
      .insert({ channel_id: ch.id, member_type: "user", user_id: userId });
    if (cmErr) {
      await admin.from("channels").delete().eq("id", ch.id);
      throw new Error(`Couldn't add you to channel: ${cmErr.message}`);
    }

    return { channel: ch };
  });

// ---------- createDmWithParticipants ----------

const Participant = z.union([
  z.object({ kind: z.literal("agent"), agentId: z.string().uuid() }),
  z.object({ kind: z.literal("user"), userId: z.string().uuid() }),
]);

const CreateDmInput = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1).max(200),
  participants: z.array(Participant).min(1).max(50),
});

export const createDmWithParticipants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateDmInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const admin = await getAdmin();

    // Validate the caller is a member of the workspace.
    const { data: mem, error: memErr } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!mem) throw new Error("You are not a member of this workspace.");

    // Validate any referenced agents belong to this workspace.
    const agentIds = data.participants
      .filter((p): p is { kind: "agent"; agentId: string } => p.kind === "agent")
      .map((p) => p.agentId);
    if (agentIds.length > 0) {
      const { data: foundAgents, error: agErr } = await admin
        .from("agents")
        .select("id")
        .eq("workspace_id", data.workspaceId)
        .in("id", agentIds);
      if (agErr) throw new Error(agErr.message);
      if ((foundAgents?.length ?? 0) !== agentIds.length) {
        throw new Error("One or more agents are not in this workspace.");
      }
    }

    const { data: dm, error: dmErr } = await admin
      .from("direct_messages")
      .insert({
        workspace_id: data.workspaceId,
        created_by: userId,
        title: data.title,
      })
      .select("id, title")
      .single();
    if (dmErr || !dm) throw new Error(`Couldn't create DM: ${dmErr?.message ?? "unknown"}`);

    // Always include the creator as a participant; dedupe defensively.
    const rows: Array<{
      dm_id: string;
      member_type: "user" | "agent";
      user_id?: string;
      agent_id?: string;
    }> = [{ dm_id: dm.id, member_type: "user", user_id: userId }];
    for (const p of data.participants) {
      if (p.kind === "user") {
        if (p.userId === userId) continue;
        rows.push({ dm_id: dm.id, member_type: "user", user_id: p.userId });
      } else {
        rows.push({ dm_id: dm.id, member_type: "agent", agent_id: p.agentId });
      }
    }

    const { error: pErr } = await admin.from("dm_participants").insert(rows);
    if (pErr) {
      // Clean up — direct_messages has no DELETE RLS policy, so the
      // admin client is required here. Best-effort: also remove any
      // participants that did land.
      await admin.from("dm_participants").delete().eq("dm_id", dm.id);
      await admin.from("direct_messages").delete().eq("id", dm.id);
      throw new Error(`Couldn't add participants: ${pErr.message}`);
    }

    return { dm };
  });
