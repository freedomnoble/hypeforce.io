import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeatureFlag = { key: string; enabled: boolean; description: string | null };

export const listFeatureFlags = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("key, enabled, description")
    .order("key");
  if (error) throw new Error(error.message);
  return { flags: (data ?? []) as FeatureFlag[] };
});

const SetInput = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  enabled: z.boolean(),
});

export const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin, error: adminErr } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (adminErr) throw new Error(adminErr.message);
    if (!isAdmin) throw new Error("Forbidden: super-admin access required.");

    const { error } = await supabaseAdmin
      .from("feature_flags")
      .update({ enabled: data.enabled })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
