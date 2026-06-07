import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEmailVerified } from "./email-verification.functions";

const STEP_DONE = 8;

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, display_name, email, onboarding_step, onboarding_project_name, onboarding_brand_doc_url, onboarding_pending_invites, is_comped",
      )
      .eq("id", userId)
      .maybeSingle();

    if (!profile) throw new Error("Profile not found");

    // First workspace + agents (the trigger seeds these on signup).
    const { data: mem } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let agents: any[] = [];
    let channels: any[] = [];
    let workspaceId: string | null = mem?.workspace_id ?? null;
    if (workspaceId) {
      const [a, c] = await Promise.all([
        supabaseAdmin
          .from("agents")
          .select("id, name, handle, avatar_url")
          .eq("workspace_id", workspaceId)
          .order("name")
          .limit(3),
        supabaseAdmin
          .from("channels")
          .select("id, name, topic")
          .eq("workspace_id", workspaceId)
          .order("is_pinned", { ascending: false })
          .order("name"),
      ]);
      agents = a.data ?? [];
      channels = c.data ?? [];
    }

    // Active live or sandbox subscription
    const { data: subRows } = await supabaseAdmin
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    const hasActiveSub = (subRows ?? []).some(
      (s: any) =>
        ["active", "trialing", "past_due"].includes(s.status) &&
        (!s.current_period_end || new Date(s.current_period_end) > new Date()),
    );

    return {
      step: profile.onboarding_step as number,
      display_name: profile.display_name as string | null,
      email: profile.email as string | null,
      project_name: profile.onboarding_project_name as string | null,
      brand_doc_url: profile.onboarding_brand_doc_url as string | null,
      pending_invites: (profile.onboarding_pending_invites as any[]) ?? [],
      is_comped: !!profile.is_comped,
      has_active_subscription: hasActiveSub,
      workspace_id: workspaceId,
      agents,
      channels,
    };
  });

export const advanceStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { to: number }) => z.object({ to: z.number().int().min(0).max(8) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin
      .from("profiles")
      .select("onboarding_step")
      .eq("id", context.userId)
      .maybeSingle();
    const next = Math.max(cur?.onboarding_step ?? 0, data.to);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ onboarding_step: next, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { step: next };
  });

export const setDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { name: string }) =>
    z.object({ name: z.string().trim().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.name, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      user_metadata: { display_name: data.name },
    });
    return { ok: true };
  });

export const setProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { name: string }) =>
    z.object({ name: z.string().trim().min(1).max(120) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ onboarding_project_name: data.name, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    // Also rename first workspace from "The Atelier" to the project name.
    const { data: mem } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (mem?.workspace_id) {
      await supabaseAdmin
        .from("workspaces")
        .update({ name: data.name })
        .eq("id", mem.workspace_id);
    }
    return { ok: true };
  });

export const setBrandDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { url: string }) =>
    z.object({ url: z.string().url().max(2000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ onboarding_brand_doc_url: data.url, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const inviteSchema = z.object({
  invites: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(255),
      }),
    )
    .max(20),
});

export const savePendingInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => inviteSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        onboarding_pending_invites: data.invites,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendOnboardingInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => inviteSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Gate: sending invites requires a verified email.
    await assertEmailVerified(context.userId);
    let sent = 0;
    for (const inv of data.invites) {
      try {
        await supabaseAdmin.auth.admin.inviteUserByEmail(inv.email, {
          data: { display_name: inv.name, invited_by: context.userId },
        });
        sent++;
      } catch (e) {
        console.error("[onboarding] invite failed", inv.email, e);
      }
    }
    await supabaseAdmin
      .from("profiles")
      .update({
        onboarding_pending_invites: data.invites,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    return { ok: true, sent };
  });

export const createFirstChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { name: string }) =>
    z
      .object({
        name: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9-_]+$/i, "Letters, numbers, dashes only"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mem } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!mem?.workspace_id) throw new Error("No workspace");
    const { data: ch, error } = await supabaseAdmin
      .from("channels")
      .insert({
        workspace_id: mem.workspace_id,
        name: data.name.toLowerCase(),
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("channel_members")
      .insert({ channel_id: ch.id, member_type: "user", user_id: context.userId });
    return { channelId: ch.id, workspaceId: mem.workspace_id };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ onboarding_step: STEP_DONE, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    const { data: mem } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!mem?.workspace_id) throw new Error("No workspace");
    const { data: ch } = await supabaseAdmin
      .from("channels")
      .select("id")
      .eq("workspace_id", mem.workspace_id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return {
      workspaceId: mem.workspace_id,
      channelId: ch?.id ?? null,
    };
  });
