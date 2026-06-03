import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/hypeforce/landing-page";

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
  component: LandingPage,
});
