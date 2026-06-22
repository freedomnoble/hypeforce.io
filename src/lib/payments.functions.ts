import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) =>
    z
      .object({
        priceId: z.string().min(1).max(200),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = await response.json();
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id as string;
  });

/**
 * Server-side checkout transaction creation.
 *
 * Security: `customData.userId` is stamped from the verified JWT (context.userId),
 * never from client input. The frontend then opens Paddle.Checkout with the
 * returned `transactionId`, so the user cannot redirect a real payment's
 * subscription/credits to another account.
 */
export const createPaddleCheckoutTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    priceId: string;
    quantity?: number;
    environment: PaddleEnv;
    customData?: Record<string, string>;
  }) =>
    z
      .object({
        priceId: z.string().min(1).max(200),
        quantity: z.number().int().min(1).max(100).optional(),
        environment: z.enum(["sandbox", "live"]),
        // Allow extra client-supplied keys for context, but userId is overwritten server-side.
        customData: z.record(z.string(), z.string()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Resolve human-readable price ID → Paddle internal ID
    const priceLookup = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const priceResult = await priceLookup.json();
    if (!priceResult.data?.length) throw new Error("Price not found");
    const paddlePriceId = priceResult.data[0].id as string;

    const body: Record<string, unknown> = {
      items: [{ price_id: paddlePriceId, quantity: data.quantity ?? 1 }],
      collection_mode: "automatic",
      custom_data: {
        ...(data.customData ?? {}),
        // Server-stamped — overrides any client-supplied value.
        userId: context.userId,
      },
    };

    const res = await gatewayFetch(data.environment, `/transactions`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.data?.id) {
      console.error("[paddle] createTransaction failed", json);
      throw new Error("Could not create checkout transaction");
    }
    return { transactionId: json.data.id as string };
  });
