import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  const themeKey = (content?.theme_key as string | null) ?? null;
  if (themeKey) {
    try {
      const { setResponseHeader } = await import("@tanstack/react-start/server");
      setResponseHeader(
        "set-cookie",
        `hf-landing-theme=${encodeURIComponent(themeKey)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`,
      );
    } catch {}
  }
  return {
    content: content ?? null,
    pricing: pricing ?? null,
    freeTrialLanding: !!flag?.enabled,
  };
});

export const getPublicLandingTheme = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("landing_content")
    .select("theme_key")
    .eq("id", 1)
    .maybeSingle();
  const themeKey = (data?.theme_key as string | null) ?? null;
  if (themeKey) {
    try {
      const { setResponseHeader } = await import("@tanstack/react-start/server");
      setResponseHeader(
        "set-cookie",
        `hf-landing-theme=${encodeURIComponent(themeKey)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`,
      );
    } catch {}
  }
  return { themeKey };
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        source: z.string().trim().max(80).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .upsert(
        { email: data.email, source: data.source ?? "landing" },
        { onConflict: "email", ignoreDuplicates: true },
      );
    // Don't leak whether the address was already on file.
    if (error && !/duplicate|conflict/i.test(error.message)) {
      // Log internally; return success to caller.
      console.error("[subscribeNewsletter]", error.message);
    }
    return { ok: true };
  });
