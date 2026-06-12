import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supa: any, userId: string) {
  const { data, error } = await supa.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super-admin access required.");
}

export const getInviteConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("invite_links")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const comp = (data ?? []).find((r: any) => (r.kind ?? "comp") === "comp");
    const trial = (data ?? []).find((r: any) => r.kind === "trial");
    if (!comp) throw new Error("Invite link config missing.");
    return {
      id: comp.id,
      token: comp.token,
      enabled: comp.enabled,
      rotated_at: comp.rotated_at,
      trial: trial
        ? { id: trial.id, token: trial.token, enabled: trial.enabled, rotated_at: trial.rotated_at }
        : null,
    };
  });

export const setInviteEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { enabled: boolean; kind?: "comp" | "trial" }) =>
    z
      .object({ enabled: z.boolean(), kind: z.enum(["comp", "trial"]).optional().default("comp") })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("invite_links")
      .select("id")
      .eq("kind", data.kind)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!row) throw new Error("Invite link config missing.");
    const { error } = await supabaseAdmin
      .from("invite_links")
      .update({ enabled: data.enabled })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rotateInviteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { kind?: "comp" | "trial" } | undefined) =>
    z
      .object({ kind: z.enum(["comp", "trial"]).optional().default("comp") })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("invite_links")
      .select("id")
      .eq("kind", data.kind)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!row) throw new Error("Invite link config missing.");
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabaseAdmin
      .from("invite_links")
      .update({ token, rotated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { token };
  });

const TRIAL_DAYS = 5;

async function startTrialForUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("trial_started_at, trial_ends_at, is_comped")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) throw new Error("Profile not found.");
  // No-op if already comped or trial already started (don't extend on re-redeem).
  if (prof.is_comped || prof.trial_started_at) return { started: false };
  const now = new Date();
  const ends = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      trial_started_at: now.toISOString(),
      trial_ends_at: ends.toISOString(),
      trial_cancel_requested_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return { started: true };
}

export const redeemInviteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { token: string }) =>
    z.object({ token: z.string().min(8).max(128).regex(/^[a-f0-9]+$/i) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("invite_links")
      .select("token, enabled, kind")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.enabled) throw new Error("This invite link is no longer active.");
    const kind = (row as any).kind ?? "comp";
    if (kind === "trial") {
      await startTrialForUser(context.userId);
      return { ok: true, kind: "trial" as const };
    }
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ is_comped: true, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, kind: "comp" as const };
  });

/**
 * Start a 5-day free trial for the current user. Used by the landing-flag
 * flow where there is no token to redeem. No-op if already comped or
 * already on a trial.
 */
export const startTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return startTrialForUser(context.userId);
  });

/**
 * Mark a trial as cancel-requested and notify the team via a support ticket.
 * Idempotent.
 */
export const requestTrialCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, display_name, trial_ends_at, trial_cancel_requested_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof) throw new Error("Profile not found.");
    if (prof.trial_cancel_requested_at) return { ok: true, alreadyRequested: true };
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ trial_cancel_requested_at: now, updated_at: now })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("support_tickets").insert({
      user_id: context.userId,
      name: prof.display_name ?? "Trial user",
      email: prof.email ?? "unknown@hypeforce.io",
      message: `Trial cancellation requested.\n\nTrial ends: ${prof.trial_ends_at ?? "n/a"}\nUser would like to cancel before being charged.`,
      page_url: "/onboarding/features",
    });
    return { ok: true, alreadyRequested: false };
  });

export const setUserTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string; action: "start" | "extend" | "end" }) =>
    z
      .object({
        user_id: z.string().uuid(),
        action: z.enum(["start", "extend", "end"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    let patch: any = { updated_at: now.toISOString() };
    if (data.action === "start") {
      patch.trial_started_at = now.toISOString();
      patch.trial_ends_at = new Date(now.getTime() + TRIAL_DAYS * 86400000).toISOString();
      patch.trial_cancel_requested_at = null;
    } else if (data.action === "extend") {
      const { data: cur } = await supabaseAdmin
        .from("profiles")
        .select("trial_ends_at")
        .eq("id", data.user_id)
        .maybeSingle();
      const base = cur?.trial_ends_at ? new Date(cur.trial_ends_at as string) : now;
      const from = base > now ? base : now;
      patch.trial_ends_at = new Date(from.getTime() + TRIAL_DAYS * 86400000).toISOString();
      patch.trial_cancel_requested_at = null;
      if (!cur?.trial_ends_at) patch.trial_started_at = now.toISOString();
    } else {
      patch.trial_ends_at = now.toISOString();
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserCompFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string; is_comped?: boolean; show_upsell?: boolean }) =>
    z
      .object({
        user_id: z.string().uuid(),
        is_comped: z.boolean().optional(),
        show_upsell: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.is_comped !== undefined) patch.is_comped = data.is_comped;
    if (data.show_upsell !== undefined) {
      patch.show_upsell = data.show_upsell;
      patch.upsell_updated_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCompedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, is_comped, show_upsell, created_at")
      .eq("is_comped", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { users: data ?? [] };
  });
