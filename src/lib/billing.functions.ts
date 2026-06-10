import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Env = "sandbox" | "live";

export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select(
        "id, paddle_subscription_id, paddle_customer_id, plan, interval, status, amount_cents, current_period_start, current_period_end, cancel_at_period_end, environment, started_at, canceled_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { subscription: data };
  });

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { paddle_subscription_id: string; environment: Env }) =>
    z
      .object({
        paddle_subscription_id: z.string().min(3),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify ownership
    const { data: row } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("paddle_subscription_id", data.paddle_subscription_id)
      .eq("environment", data.environment)
      .maybeSingle();
    if (!row || row.user_id !== context.userId) {
      throw new Error("Subscription not found");
    }
    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(data.environment);
    await paddle.subscriptions.cancel(data.paddle_subscription_id, {
      effectiveFrom: "next_billing_period",
    });
    // Optimistic flag — webhook will reconcile.
    await supabaseAdmin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        cancel_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("paddle_subscription_id", data.paddle_subscription_id)
      .eq("environment", data.environment);
    return { ok: true };
  });

export const reactivateMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { paddle_subscription_id: string; environment: Env }) =>
    z
      .object({
        paddle_subscription_id: z.string().min(3),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("paddle_subscription_id", data.paddle_subscription_id)
      .eq("environment", data.environment)
      .maybeSingle();
    if (!row || row.user_id !== context.userId) {
      throw new Error("Subscription not found");
    }
    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(data.environment);
    // Clearing scheduled_change reverses the pending cancel.
    await paddle.subscriptions.update(data.paddle_subscription_id, {
      scheduledChange: null,
    });
    await supabaseAdmin
      .from("subscriptions")
      .update({
        cancel_at_period_end: false,
        cancel_requested_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("paddle_subscription_id", data.paddle_subscription_id)
      .eq("environment", data.environment);
    return { ok: true };
  });

export const getCustomerPortalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { paddle_subscription_id: string; environment: Env }) =>
    z
      .object({
        paddle_subscription_id: z.string().min(3),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, paddle_customer_id")
      .eq("paddle_subscription_id", data.paddle_subscription_id)
      .eq("environment", data.environment)
      .maybeSingle();
    if (!row || row.user_id !== context.userId || !row.paddle_customer_id) {
      throw new Error("Subscription not found");
    }
    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(data.environment);
    const session = await paddle.customerPortalSessions.create(
      row.paddle_customer_id,
      [data.paddle_subscription_id],
    );
    return {
      overview: session.urls?.general?.overview ?? null,
      subscriptions: session.urls?.subscriptions ?? [],
    };
  });
