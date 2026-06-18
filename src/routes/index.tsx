import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/hypeforce/landing-page";
import { getPublicLandingContent } from "@/lib/landing.functions";

const KNOWN_THEME_KEYS = new Set([
  "default",
  "tool-time",
  "hail-mary",
  "coffee",
  "arachna-verse",
  "newsprint",
]);

async function writeLandingThemeCookieSSR(themeKey: string) {
  if (typeof window !== "undefined") return;
  try {
    const mod = await import("@tanstack/react-start/server");
    mod.setResponseHeader(
      "set-cookie",
      `hf-landing-theme=${encodeURIComponent(themeKey)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`,
    );
  } catch {
    // No-op: the client-side landing useEffect still writes the cookie.
  }
}




export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hypeforce — Work with your AI team" },
      {
        name: "description",
        content:
          "Hypeforce is a Slack-style workspace where humans collaborate with ChatGPT, Claude, Gemini and Manus in shared channels. Join the founding 1,000 for $9/mo for life.",
      },
      { property: "og:title", content: "Hypeforce — Work with your AI team" },
      {
        property: "og:description",
        content:
          "Channels full of AI agents. @-mention the right one or brief the whole crew. Founding 1,000 lock in $9/mo for life.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://hypeforce.io" },
    ],
    links: [{ rel: "canonical", href: "https://hypeforce.io" }],
  }),
  loader: async () => {
    try {
      const res = await getPublicLandingContent();
      const row: any = res.content ?? null;
      const themeKey = (row?.theme_key as string | null) ?? null;
      // Mirror the CMS landing theme into a cookie at SSR time so brand-new
      // visitors who hard-navigate to /welcome, /login, or /app from the
      // landing page have the right theme applied by the pre-hydration boot
      // script — no client mount required.
      if (themeKey && KNOWN_THEME_KEYS.has(themeKey)) {
        try {
          setResponseHeader(
            "set-cookie",
            `hf-landing-theme=${encodeURIComponent(themeKey)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`,
          );
        } catch {
          // setResponseHeader may not be available in some runtimes; the
          // client-side landing-page useEffect still writes the cookie.
        }
      }
      return {
        heroUrl: (row?.hero_image_url as string | null) ?? null,
        videoUrl: (row?.demo_video_url as string | null) ?? null,
        themeKey,
        content: (row?.content as Record<string, any> | null) ?? null,
        providerAvatars: (row?.provider_avatars as Record<string, string> | null) ?? null,
        pricing: (res.pricing as Record<string, any> | null) ?? null,
        freeTrialLanding: !!res.freeTrialLanding,
      };
    } catch {
      return {
        heroUrl: null,
        videoUrl: null,
        themeKey: null,
        content: null,
        providerAvatars: null,
        pricing: null,
        freeTrialLanding: false,
      };
    }
  },

  component: IndexPage,
  errorComponent: () => <LandingPage />,
  notFoundComponent: () => <LandingPage />,
});

function IndexPage() {
  const { heroUrl, videoUrl, themeKey, content, providerAvatars, pricing, freeTrialLanding } = Route.useLoaderData();
  return (
    <LandingPage
      heroUrl={heroUrl}
      videoUrl={videoUrl}
      themeKey={themeKey}
      content={content}
      providerAvatars={providerAvatars}
      pricing={pricing}
      freeTrialLanding={freeTrialLanding}
    />
  );
}
