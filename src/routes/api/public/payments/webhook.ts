import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

function planFromProduct(productExternalId: string): string {
  if (productExternalId === "founder") return "founder";
  if (productExternalId === "pro") return "pro";
  if (productExternalId === "team") return "team";
  return productExternalId;
}

function intervalFromPriceId(priceExternalId: string): "monthly" | "annual" {
  return priceExternalId.includes("annual") || priceExternalId.includes("yearly")
    ? "annual"
    : "monthly";
}

async function grantMonthlyCreditsIfNew(args: {
  subscriptionRowId: string;
  userId: string;
  plan: string;
  periodStart: string | null | undefined;
}) {
  if (!args.periodStart) return;
  const supa = getSupabase();
  const { data: allowance } = await supa
    .from("plan_credit_allowances")
    .select("monthly_credits")
    .eq("plan", args.plan)
    .maybeSingle();
  const credits = Number(allowance?.monthly_credits ?? 0);
  if (credits <= 0) return;

  // Idempotency: claim (subscription, period_start) row first.
  const { data: period, error: periodErr } = await supa
    .from("subscription_credit_periods")
    .insert({
      subscription_id: args.subscriptionRowId,
      period_start: args.periodStart,
      credits_granted: credits,
    })
    .select("id")
    .single();
  if (periodErr) {
    if ((periodErr as any).code === "23505") return; // already granted
    console.error("[paddle webhook] period claim error", periodErr);
    return;
  }

  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: grant, error: grantErr } = await supa
    .from("credit_grants")
    .insert({
      user_id: args.userId,
      amount: credits,
      source: "subscription",
      expires_at: expiresAt,
      note: `${args.plan} monthly allowance`,
    })
    .select("id")
    .single();
  if (grantErr) {
    console.error("[paddle webhook] grant insert error", grantErr);
    return;
  }
  await supa
    .from("subscription_credit_periods")
    .update({ grant_id: grant.id })
    .eq("id", period.id);
}

async function upsertSubscriptionRow(args: {
  id: string;
  customerId?: string;
  userId: string;
  productId: string;
  priceId: string;
  amount: number;
  status: string;
  startsAt?: string;
  endsAt?: string;
  scheduledChange?: any;
  env: PaddleEnv;
}) {
  const { data, error } = await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: args.userId,
        paddle_subscription_id: args.id,
        paddle_customer_id: args.customerId,
        product_id: args.productId,
        price_id: args.priceId,
        plan: planFromProduct(args.productId),
        interval: intervalFromPriceId(args.priceId),
        amount_cents: args.amount,
        status: args.status,
        current_period_start: args.startsAt,
        current_period_end: args.endsAt,
        cancel_at_period_end: args.scheduledChange?.action === "cancel",
        environment: args.env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    )
    .select("id, plan")
    .single();
  if (error) {
    console.error("[paddle webhook] sub upsert error", error);
    return null;
  }
  return data as { id: string; plan: string };
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;
  const userId = customData?.userId;
  if (!userId) {
    console.error("[paddle webhook] no userId in customData", { id });
    return;
  }
  const item = items[0];
  const priceId = item.price.importMeta?.externalId;
  const productId = item.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn("[paddle webhook] missing importMeta.externalId");
    return;
  }
  const amount = parseInt(item.price.unitPrice?.amount ?? "0", 10);
  const row = await upsertSubscriptionRow({
    id, customerId, userId, productId, priceId, amount, status,
    startsAt: currentBillingPeriod?.startsAt,
    endsAt: currentBillingPeriod?.endsAt,
    env,
  });
  if (!row) return;
  await grantMonthlyCreditsIfNew({
    subscriptionRowId: row.id,
    userId,
    plan: row.plan,
    periodStart: currentBillingPeriod?.startsAt,
  });
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, scheduledChange, customData } = data;
  // Look up existing row (and capture user_id) so we can also grant credits on renewal.
  const { data: existing } = await getSupabase()
    .from("subscriptions")
    .select("id, user_id, plan, current_period_start")
    .eq("paddle_subscription_id", id)
    .eq("environment", env)
    .maybeSingle();

  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;

  // Prefer a full upsert so renewals + plan changes refresh every field, but
  // fall back to a thin update if importMeta is missing.
  let row: { id: string; plan: string; user_id?: string } | null = null;
  if (priceId && productId) {
    const userId = customData?.userId ?? existing?.user_id;
    if (userId) {
      const amount = parseInt(item.price.unitPrice?.amount ?? "0", 10);
      const upserted = await upsertSubscriptionRow({
        id, customerId, userId, productId, priceId, amount, status,
        startsAt: currentBillingPeriod?.startsAt,
        endsAt: currentBillingPeriod?.endsAt,
        scheduledChange,
        env,
      });
      if (upserted) row = { ...upserted, user_id: userId };
    }
  }
  if (!row) {
    await getSupabase()
      .from("subscriptions")
      .update({
        status,
        current_period_start: currentBillingPeriod?.startsAt,
        current_period_end: currentBillingPeriod?.endsAt,
        cancel_at_period_end: scheduledChange?.action === "cancel",
        updated_at: new Date().toISOString(),
      })
      .eq("paddle_subscription_id", id)
      .eq("environment", env);
    if (!existing) return;
    row = { id: existing.id, plan: existing.plan as string, user_id: existing.user_id as string };
  }

  // Grant monthly credits when a new billing period rolls (idempotent on period_start).
  if (row.user_id && currentBillingPeriod?.startsAt) {
    await grantMonthlyCreditsIfNew({
      subscriptionRowId: row.id,
      userId: row.user_id,
      plan: row.plan,
      periodStart: currentBillingPeriod.startsAt,
    });
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
}

const CREDIT_PACKS: Record<string, number> = {
  credits_small_onetime: 500,
  credits_medium_onetime: 2200,
  credits_large_onetime: 6000,
};

async function handleTransactionCompleted(data: any) {
  const { id, items, customData, status } = data;
  if (status !== "completed" && status !== "paid") return;
  const userId = customData?.userId;
  if (!userId) return;

  // Find a top-up price in the line items
  for (const item of items ?? []) {
    const externalPriceId = item.price?.importMeta?.externalId;
    const credits = externalPriceId ? CREDIT_PACKS[externalPriceId] : undefined;
    if (!credits) continue;

    const { error } = await getSupabase()
      .from("credit_grants")
      .insert({
        user_id: userId,
        amount: credits,
        source: "topup",
        paddle_transaction_id: id,
        note: externalPriceId,
      });
    if (error && error.code !== "23505") {
      // 23505 = unique_violation → idempotent replay, ignore
      console.error("[paddle webhook] credit grant insert error", error);
    }
    return;
  }
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data);
      break;
    default:
      console.log("[paddle webhook] unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[paddle webhook] error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
