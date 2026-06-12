import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/hypeforce/landing-page";
import { getPublicLandingContent } from "@/lib/landing.functions";

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
      return {
        heroUrl: (row?.hero_image_url as string | null) ?? null,
        videoUrl: (row?.demo_video_url as string | null) ?? null,
        themeKey: (row?.theme_key as string | null) ?? null,
        content: (row?.content as Record<string, any> | null) ?? null,
        pricing: (res.pricing as Record<string, any> | null) ?? null,
        freeTrialLanding: !!res.freeTrialLanding,
      };
    } catch {
      return {
        heroUrl: null,
        videoUrl: null,
        themeKey: null,
        content: null,
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
  const { heroUrl, videoUrl, themeKey, content, pricing, freeTrialLanding } = Route.useLoaderData();
  return (
    <LandingPage
      heroUrl={heroUrl}
      videoUrl={videoUrl}
      themeKey={themeKey}
      content={content}
      pricing={pricing}
      freeTrialLanding={freeTrialLanding}
    />
  );
}
