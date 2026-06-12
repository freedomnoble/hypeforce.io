import { createServerFn } from "@tanstack/react-start";

export const getPublicLandingContent = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: content }, { data: pricing }, { data: flag }] = await Promise.all([
    supabaseAdmin.from("landing_content").select("*").eq("id", 1).maybeSingle(),
    supabaseAdmin.from("pricing_config").select("*").eq("id", 1).maybeSingle(),
    supabaseAdmin
      .from("feature_flags")
      .select("enabled")
      .eq("key", "free_trial_landing")
      .maybeSingle(),
  ]);
  return {
    content: content ?? null,
    pricing: pricing ?? null,
    freeTrialLanding: !!flag?.enabled,
  };
});
