import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VARIANT_COOKIE = "hf-landing-variant";
const VARIANT_COOKIE_DAYS = 30;

const VariantSchema = z.union([z.literal("a"), z.literal("b")]);
type Variant = "a" | "b";

async function readCookie(name: string): Promise<string | undefined> {
  try {
    const { getCookie } = await import("@tanstack/react-start/server");
    return getCookie(name) ?? undefined;
  } catch {
    return undefined;
  }
}

async function writeCookie(name: string, value: string, maxAgeDays: number) {
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(name, value, {
      path: "/",
      maxAge: maxAgeDays * 24 * 60 * 60,
      sameSite: "lax",
      httpOnly: false,
    });
  } catch {}
}

export const getPublicLandingContent = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z
      .object({ variant: VariantSchema.optional() })
      .parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const variantId = data.variant === "b" ? 2 : 1;

    const [{ data: rowA }, { data: rowB }, { data: pricing }, { data: flag }, { data: abCfg }] =
      await Promise.all([
        supabaseAdmin.from("landing_content").select("*").eq("id", 1).maybeSingle(),
        supabaseAdmin.from("landing_content").select("*").eq("id", 2).maybeSingle(),
        supabaseAdmin.from("pricing_config").select("*").eq("id", 1).maybeSingle(),
        supabaseAdmin
          .from("feature_flags")
          .select("enabled")
          .eq("key", "free_trial_landing")
          .maybeSingle(),
        supabaseAdmin.from("landing_ab_config").select("mode").eq("id", 1).maybeSingle(),
      ]);

    const base = rowA ?? null;
    const variantRow = variantId === 2 ? rowB ?? null : rowA;

    // Variant B inherits hero/theme/video/avatars from A unless explicitly set.
    const content =
      variantRow && base
        ? {
            ...variantRow,
            theme_key: variantRow.theme_key ?? base.theme_key,
            hero_image_url: variantRow.hero_image_url ?? base.hero_image_url,
            demo_video_url: variantRow.demo_video_url ?? base.demo_video_url,
            provider_avatars:
              variantRow.provider_avatars && Object.keys(variantRow.provider_avatars).length > 0
                ? variantRow.provider_avatars
                : base.provider_avatars,
          }
        : variantRow;

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
      abMode: (abCfg?.mode as "a" | "b" | "split") ?? "a",
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

/**
 * Resolves which landing variant the visitor should see, sets a sticky cookie,
 * and logs a deduped "view" event. Safe to call from a public route loader.
 */
export const assignLandingVariant = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: cfg } = await supabaseAdmin
    .from("landing_ab_config")
    .select("mode")
    .eq("id", 1)
    .maybeSingle();
  const mode = (cfg?.mode as "a" | "b" | "split") ?? "a";

  const existing = await readCookie(VARIANT_COOKIE);
  const existingVariant: Variant | undefined =
    existing === "a" || existing === "b" ? existing : undefined;

  let variant: Variant;
  if (mode === "a") variant = "a";
  else if (mode === "b") variant = "b";
  else variant = existingVariant ?? (Math.random() < 0.5 ? "a" : "b");

  // Always refresh cookie so it sticks for VARIANT_COOKIE_DAYS.
  await writeCookie(VARIANT_COOKIE, variant, VARIANT_COOKIE_DAYS);

  // Visitor id cookie — for view dedup. Doesn't identify the user.
  let visitorId = await readCookie("hf-landing-visitor");
  let isNewVisit = false;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    await writeCookie("hf-landing-visitor", visitorId, 365);
    isNewVisit = true;
  }

  // Log a view: once per (visitor, variant, day). Cheap: do a tiny lookup.
  try {
    if (isNewVisit) {
      await supabaseAdmin.from("landing_ab_events").insert({
        variant,
        kind: "view",
        visitor_id: visitorId,
      });
    } else {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("landing_ab_events")
        .select("id")
        .eq("kind", "view")
        .eq("variant", variant)
        .eq("visitor_id", visitorId)
        .gte("created_at", since)
        .limit(1);
      if (!recent || recent.length === 0) {
        await supabaseAdmin.from("landing_ab_events").insert({
          variant,
          kind: "view",
          visitor_id: visitorId,
        });
      }
    }
  } catch {
    // never block render on analytics
  }

  return { variant, mode };
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
    if (error && !/duplicate|conflict/i.test(error.message)) {
      console.error("[subscribeNewsletter]", error.message);
    }
    return { ok: true };
  });
