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
      return {
        heroUrl: res.content?.hero_image_url ?? null,
        videoUrl: res.content?.demo_video_url ?? null,
      };
    } catch {
      return { heroUrl: null, videoUrl: null };
    }
  },
  component: IndexPage,
  errorComponent: () => <LandingPage />,
  notFoundComponent: () => <LandingPage />,
});

function IndexPage() {
  const { heroUrl, videoUrl } = Route.useLoaderData();
  return <LandingPage heroUrl={heroUrl} videoUrl={videoUrl} />;
}
