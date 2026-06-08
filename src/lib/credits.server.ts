import { supabaseAdmin } from "@/integrations/supabase/client.server";

export class CreditsExhaustedError extends Error {
  balance: number;
  constructor(balance: number) {
    super("Out of credits");
    this.name = "CreditsExhaustedError";
    this.balance = balance;
  }
}

type PricingRow = {
  model: string;
  kind: "text" | "image";
  input_credits_per_1k: number;
  output_credits_per_1k: number;
  per_image_credits: number;
};

let pricingCache: { rows: Map<string, PricingRow>; at: number } | null = null;
const PRICING_TTL_MS = 5 * 60_000;

async function loadPricing(): Promise<Map<string, PricingRow>> {
  if (pricingCache && Date.now() - pricingCache.at < PRICING_TTL_MS) {
    return pricingCache.rows;
  }
  const { data } = await supabaseAdmin.from("model_pricing").select("*");
  const map = new Map<string, PricingRow>();
  for (const r of data ?? []) {
    map.set(r.model, {
      model: r.model,
      kind: r.kind as "text" | "image",
      input_credits_per_1k: Number(r.input_credits_per_1k),
      output_credits_per_1k: Number(r.output_credits_per_1k),
      per_image_credits: Number(r.per_image_credits),
    });
  }
  pricingCache = { rows: map, at: Date.now() };
  return map;
}

export type CreditsUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  image_count?: number;
};

export async function calcCredits(
  model: string,
  kind: "text" | "image",
  usage: CreditsUsage,
): Promise<number> {
  const pricing = await loadPricing();
  const row = pricing.get(model);
  if (!row) {
    // Unknown model — conservative fallback so we still meter something.
    if (kind === "image") return Math.max(1, usage.image_count ?? 1) * 20;
    const p = (usage.prompt_tokens ?? 0) / 1000;
    const c = (usage.completion_tokens ?? 0) / 1000;
    return Math.max(1, Math.ceil(p * 0.5 + c * 2));
  }
  if (kind === "image" || row.kind === "image") {
    return Math.max(1, (usage.image_count ?? 1) * row.per_image_credits);
  }
  const p = (usage.prompt_tokens ?? 0) / 1000;
  const c = (usage.completion_tokens ?? 0) / 1000;
  const raw = p * row.input_credits_per_1k + c * row.output_credits_per_1k;
  return Math.max(1, Math.ceil(raw));
}

export async function getBalance(user_id: string): Promise<number> {
  const { data } = await supabaseAdmin.rpc("get_user_credit_balance", { uid: user_id });
  return Number(data ?? 0);
}

export async function assertCanSpend(user_id: string): Promise<number> {
  const balance = await getBalance(user_id);
  if (balance <= 0) throw new CreditsExhaustedError(balance);
  return balance;
}

export async function chargeCredits(args: {
  user_id: string;
  workspace_id?: string | null;
  message_id?: string | null;
  agent_id?: string | null;
  model: string;
  kind: "text" | "image";
  usage: CreditsUsage;
}): Promise<number> {
  const credits = await calcCredits(args.model, args.kind, args.usage);
  await supabaseAdmin.from("credit_usage").insert({
    user_id: args.user_id,
    workspace_id: args.workspace_id ?? null,
    message_id: args.message_id ?? null,
    agent_id: args.agent_id ?? null,
    model: args.model,
    kind: args.kind,
    prompt_tokens: args.usage.prompt_tokens ?? 0,
    completion_tokens: args.usage.completion_tokens ?? 0,
    image_count: args.usage.image_count ?? 0,
    estimated_cost_usd_micros: 0,
    credits,
  } as never);
  return credits;
}
