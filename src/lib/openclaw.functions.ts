import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OpenclawFlags = {
  studio: boolean;
  enabled: boolean;
};

/**
 * Reads the two OpenClaw feature flags. Used by the sidebar (to decide
 * whether to render the entry) and the OpenClaw route (to decide whether
 * to show the coming-soon placeholder or the full wizard/chat).
 *
 * Public — no auth required. The flag values are not sensitive.
 */
export const getOpenclawFlags = createServerFn({ method: "GET" }).handler(
  async (): Promise<OpenclawFlags> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("feature_flags")
      .select("key, enabled")
      .in("key", ["openclaw_studio", "openclaw_enabled"]);
    const map = new Map((data ?? []).map((r: any) => [r.key, !!r.enabled]));
    return {
      studio: map.get("openclaw_studio") ?? false,
      enabled: map.get("openclaw_enabled") ?? false,
    };
  },
);

export type WaitlistStatus = { onList: boolean };

export const getOpenclawWaitlistStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WaitlistStatus> => {
    const { data } = await context.supabase
      .from("openclaw_waitlist")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { onList: !!data };
  });

export const joinOpenclawWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WaitlistStatus> => {
    const { error } = await context.supabase
      .from("openclaw_waitlist")
      .upsert({ user_id: context.userId }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { onList: true };
  });
