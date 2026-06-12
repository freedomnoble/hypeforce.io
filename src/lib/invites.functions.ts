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

export const redeemInviteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { token: string }) =>
    z.object({ token: z.string().min(8).max(128).regex(/^[a-f0-9]+$/i) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("invite_links")
      .select("token, enabled")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.enabled) throw new Error("This invite link is no longer active.");
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ is_comped: true, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (upErr) throw new Error(upErr.message);
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
