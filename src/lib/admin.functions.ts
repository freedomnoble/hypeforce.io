import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WindowEnum = z.union([z.literal(1), z.literal(2), z.literal(7), z.literal(14), z.literal(30)]);

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { assertSuperAdmin } = await import("./admin.server");
  await assertSuperAdmin(context.supabase, context.userId);
}

export const checkSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { isSuperAdmin: !!data };
  });

// ============================================================ Dashboard
export const getDashboardStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { window: 1 | 2 | 7 | 14 | 30 }) => ({ window: WindowEnum.parse(i.window) }))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.window * 86400_000).toISOString();

    const [{ data: usersPage }, { data: subs }, { data: allSubs }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("subscriptions").select("user_id,plan,interval,status,amount_cents,canceled_at,started_at"),
      supabaseAdmin.from("subscriptions").select("status,canceled_at"),
    ]);
    const allUsers = usersPage?.users ?? [];
    const newUsers = allUsers.filter((u) => u.created_at && u.created_at >= since).length;
    const active = (subs ?? []).filter((s: any) => s.status === "active" || s.status === "cancel_requested");
    const paidUsers = active.length;
    const mrr = active.reduce((sum: number, s: any) => {
      const monthly = s.interval === "annual" ? s.amount_cents / 12 : s.amount_cents;
      return sum + (monthly ?? 0);
    }, 0);
    const periodCanceled = (allSubs ?? []).filter(
      (s: any) => s.canceled_at && s.canceled_at >= since,
    ).length;
    const baseActive = active.length + periodCanceled || 1;
    const churnRate = periodCanceled / baseActive;
    return {
      totalUsers: allUsers.length,
      newUsers,
      paidUsers,
      mrrCents: Math.round(mrr),
      arrCents: Math.round(mrr * 12),
      churnRate,
    };
  });

// ============================================================ Users
export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { search?: string; page?: number }) => ({
    search: i.search?.slice(0, 200) ?? "",
    page: Math.max(1, Math.min(50, i.page ?? 1)),
  }))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({
      page: data.page,
      perPage: 50,
    });
    const users = usersPage?.users ?? [];
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return { users: [], page: data.page };

    const [wsRes, chRes, agRes, connRes, subRes, limRes, profRes] = await Promise.all([
      supabaseAdmin.from("workspace_members").select("user_id,workspace_id").in("user_id", ids),
      supabaseAdmin.from("workspaces").select("id,owner_id").in("owner_id", ids),
      supabaseAdmin.from("agents").select("id,workspace_id,preferred_route"),
      supabaseAdmin.from("user_ai_connections").select("user_id,provider,status").in("user_id", ids),
      supabaseAdmin.from("subscriptions").select("*").in("user_id", ids),
      supabaseAdmin.from("user_usage_limits").select("*").in("user_id", ids),
      supabaseAdmin.from("profiles").select("id,is_comped,show_upsell").in("id", ids),
    ]);
    const [channelsRes] = await Promise.all([
      supabaseAdmin.from("channels").select("id,workspace_id,created_by").in("created_by", ids),
    ]);

    const wsByOwner = new Map<string, Set<string>>();
    (wsRes.data ?? []).forEach((w: any) => {
      const set = wsByOwner.get(w.user_id) ?? new Set();
      set.add(w.workspace_id);
      wsByOwner.set(w.user_id, set);
    });
    const channelsByOwner = new Map<string, number>();
    (channelsRes.data ?? []).forEach((c: any) => {
      channelsByOwner.set(c.created_by, (channelsByOwner.get(c.created_by) ?? 0) + 1);
    });
    const ownedWs = new Map<string, Set<string>>();
    (wsRes.data ?? []).forEach((w: any) => {
      const s = ownedWs.get(w.user_id) ?? new Set<string>();
      s.add(w.workspace_id);
      ownedWs.set(w.user_id, s);
    });
    const agentsByWs = new Map<string, any[]>();
    (agRes.data ?? []).forEach((a: any) => {
      const arr = agentsByWs.get(a.workspace_id) ?? [];
      arr.push(a);
      agentsByWs.set(a.workspace_id, arr);
    });
    const byokByUser = new Map<string, number>();
    (connRes.data ?? []).forEach((c: any) => {
      if (c.status === "active") byokByUser.set(c.user_id, (byokByUser.get(c.user_id) ?? 0) + 1);
    });
    const subByUser = new Map((subRes.data ?? []).map((s: any) => [s.user_id, s]));
    const limByUser = new Map((limRes.data ?? []).map((l: any) => [l.user_id, l]));
    const profByUser = new Map((profRes.data ?? []).map((p: any) => [p.id, p]));

    const out = users.map((u) => {
      const ws = ownedWs.get(u.id) ?? new Set<string>();
      let agentCount = 0;
      let gatewayAgents = 0;
      ws.forEach((wid) => {
        const list = agentsByWs.get(wid) ?? [];
        agentCount += list.length;
        gatewayAgents += list.filter((a: any) => !a.preferred_route).length;
      });
      const search = data.search.toLowerCase();
      if (search && !(u.email ?? "").toLowerCase().includes(search)) return null;
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        workspace_count: ws.size,
        channel_count: channelsByOwner.get(u.id) ?? 0,
        agent_count: agentCount,
        gateway_agent_count: gatewayAgents,
        byok_count: byokByUser.get(u.id) ?? 0,
        subscription: subByUser.get(u.id) ?? null,
        usage_limit: limByUser.get(u.id) ?? null,
        profile_flags: profByUser.get(u.id) ?? { is_comped: false, show_upsell: false },
      };
    }).filter(Boolean);

    return { users: out, page: data.page };
  });

export const setUsageLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    user_id: string;
    monthly_message_cap: number | null;
    lovable_gateway_paused: boolean;
  }) => z.object({
    user_id: z.string().uuid(),
    monthly_message_cap: z.number().int().min(0).max(1_000_000).nullable(),
    lovable_gateway_paused: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_usage_limits").upsert({
      user_id: data.user_id,
      monthly_message_cap: data.monthly_message_cap,
      lovable_gateway_paused: data.lovable_gateway_paused,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: any) => z.object({
    user_id: z.string().uuid(),
    plan: z.enum(["none", "founder", "pro", "team"]),
    interval: z.enum(["monthly", "annual"]),
    status: z.enum(["active", "paused", "canceled", "cancel_requested", "trialing"]),
    amount_cents: z.number().int().min(0).max(1_000_000),
    admin_note: z.string().max(2000).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // subscriptions has no UNIQUE on user_id (a user may re-subscribe over time),
    // so upsert(onConflict: user_id) is invalid. Update most recent row, else insert.
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const patch: any = { ...data, updated_at: new Date().toISOString() };
    if (data.status === "canceled") patch.canceled_at = new Date().toISOString();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .insert({ ...patch, environment: "live" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const approveCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Pull the most recent subscription so we can also tell Paddle to stop billing.
    const { data: row } = await supabaseAdmin
      .from("subscriptions")
      .select("id, paddle_subscription_id, environment, status")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (row?.paddle_subscription_id) {
      try {
        const { getPaddleClient } = await import("@/lib/paddle.server");
        const paddle = getPaddleClient(row.environment as "sandbox" | "live");
        await paddle.subscriptions.cancel(row.paddle_subscription_id, {
          effectiveFrom: "next_billing_period",
        });
      } catch (e: any) {
        // Don't block the admin action if Paddle is already canceled / unreachable.
        console.warn("[admin] paddle cancel failed:", e?.message);
      }
    }
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const messageUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: any) => z.object({
    user_id: z.string().uuid(),
    subject: z.string().max(200).optional(),
    body: z.string().min(1).max(5000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("admin_user_messages").insert({
      recipient_user_id: data.user_id,
      sender_user_id: context.userId,
      subject: data.subject ?? null,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================ Support
export const listTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { status?: string }) => ({ status: i.status ?? "all" }))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("support_tickets")
      .select("*, support_ticket_attachments(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: tickets, error } = await q;
    if (error) throw new Error(error.message);
    return tickets ?? [];
  });

export const getTicketThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { ticket_id: string }) => z.object({ ticket_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [ticketRes, msgRes, attRes] = await Promise.all([
      supabaseAdmin.from("support_tickets").select("*").eq("id", data.ticket_id).single(),
      supabaseAdmin.from("support_ticket_messages").select("*").eq("ticket_id", data.ticket_id).order("created_at"),
      supabaseAdmin.from("support_ticket_attachments").select("*").eq("ticket_id", data.ticket_id),
    ]);
    if (ticketRes.error) throw new Error(ticketRes.error.message);
    // sign attachment urls
    const attachments = await Promise.all(
      (attRes.data ?? []).map(async (a: any) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("support-attachments")
          .createSignedUrl(a.file_path, 3600);
        return { ...a, signed_url: signed?.signedUrl ?? null };
      }),
    );
    return { ticket: ticketRes.data, messages: msgRes.data ?? [], attachments };
  });

export const replyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: any) => z.object({
    ticket_id: z.string().uuid(),
    body: z.string().min(1).max(5000),
    status: z.enum(["open", "in_progress", "resolved"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("support_ticket_messages").insert({
      ticket_id: data.ticket_id,
      author: "admin",
      author_user_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    if (data.status) {
      await supabaseAdmin.from("support_tickets").update({ status: data.status }).eq("id", data.ticket_id);
    }
    return { ok: true };
  });

export const setTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: any) => z.object({
    ticket_id: z.string().uuid(),
    status: z.enum(["open", "in_progress", "resolved"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("support_tickets").update({ status: data.status }).eq("id", data.ticket_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================ Landing CMS
export const getLandingContentAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("landing_content").select("*").eq("id", 1).single();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateLandingContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: any) => z.object({
    content: z.record(z.string(), z.any()).optional(),
    theme_key: z.string().max(100).nullable().optional(),
    hero_image_url: z.string().max(1000).nullable().optional(),
    demo_video_url: z.string().max(1000).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("landing_content")
      .update({ ...data, updated_by: context.userId })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPricingConfigAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("pricing_config").select("*").eq("id", 1).single();
    if (error) throw new Error(error.message);
    return data;
  });

export const updatePricingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: any) => z.object({
    founder_price_monthly: z.number().int().min(0).max(100000).optional(),
    founder_seats_remaining: z.number().int().min(0).max(1_000_000).optional(),
    founder_active: z.boolean().optional(),
    pro_price_monthly: z.number().int().min(0).max(100000).optional(),
    pro_price_annual: z.number().int().min(0).max(10_000_00).optional(),
    team_price_monthly: z.number().int().min(0).max(100000).optional(),
    team_price_annual: z.number().int().min(0).max(10_000_00).optional(),
    discount_percent: z.number().int().min(0).max(100).optional(),
    standard_seat_active: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("pricing_config").update(data).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin asset upload — returns signed PUT url for landing hero/video
export const createLandingUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: any) => z.object({
    filename: z.string().min(1).max(200),
    kind: z.enum(["hero", "video"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Reuse avatars bucket (public) for landing assets so public URL works
    const path = `landing/${data.kind}-${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
    return { signedUrl: signed.signedUrl, token: signed.token, path, publicUrl: pub.publicUrl };
  });
