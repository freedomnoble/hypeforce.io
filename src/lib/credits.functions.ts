import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getMyCreditBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin.rpc("get_user_credit_balance", {
      uid: userId,
    });
    if (error) throw error;
    return { balance: Number(data ?? 0) };
  });

export const getMyCreditLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [grants, usage, balance] = await Promise.all([
      supabaseAdmin
        .from("credit_grants")
        .select("id, amount, source, note, expires_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("credit_usage")
        .select(
          "id, model, kind, prompt_tokens, completion_tokens, image_count, credits, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin.rpc("get_user_credit_balance", { uid: userId }),
    ]);
    return {
      balance: Number(balance.data ?? 0),
      grants: grants.data ?? [],
      usage: usage.data ?? [],
    };
  });
