import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const TOKEN_KEYS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "input",
  "ring",
  "electric",
  "violet",
  "rail",
  "rail-foreground",
  "panel",
  "panel-foreground",
  "sidebar",
  "sidebar-foreground",
] as const;

export type ThemeTokens = Record<(typeof TOKEN_KEYS)[number], string> & {
  bodyGradient?: string;
};

const InputSchema = z.object({
  prompt: z.string().min(2).max(1000),
});

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are a UI theme designer for a chat app. Given a user's vibe description, output a cohesive color theme using OKLCH color values only.

Rules:
- Every color value MUST be a valid CSS oklch() string, e.g. "oklch(0.18 0.05 260)" or with alpha "oklch(0.95 0.02 240 / 0.85)".
- Ensure WCAG AA contrast (≥ 4.5:1) between foreground/background and primary-foreground/primary.
- Pick ONE coherent palette — don't mix wildly different hues unless the prompt asks for chromatic chaos.
- bodyGradient is a CSS background-image string (typically 2-3 stacked radial/linear gradients in oklch). It paints the page background.
- name is a short evocative title (2-4 words) for the theme.

Return ONLY a JSON object with this exact shape, no markdown, no commentary:
{
  "name": "string",
  "tokens": {
    "background": "oklch(...)",
    "foreground": "oklch(...)",
    "card": "oklch(...)",
    "card-foreground": "oklch(...)",
    "popover": "oklch(...)",
    "popover-foreground": "oklch(...)",
    "primary": "oklch(...)",
    "primary-foreground": "oklch(...)",
    "secondary": "oklch(...)",
    "secondary-foreground": "oklch(...)",
    "muted": "oklch(...)",
    "muted-foreground": "oklch(...)",
    "accent": "oklch(...)",
    "accent-foreground": "oklch(...)",
    "border": "oklch(...)",
    "input": "oklch(...)",
    "ring": "oklch(...)",
    "electric": "oklch(...)",
    "violet": "oklch(...)",
    "rail": "oklch(...)",
    "rail-foreground": "oklch(...)",
    "panel": "oklch(...)",
    "panel-foreground": "oklch(...)",
    "sidebar": "oklch(...)",
    "sidebar-foreground": "oklch(...)",
    "bodyGradient": "linear-gradient(...), radial-gradient(...)"
  }
}`;

export const generateCustomTheme = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit exceeded — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 200)}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI returned no content");

    let parsed: { name: string; tokens: ThemeTokens };
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    // Validate required keys
    const missing = TOKEN_KEYS.filter((k) => !parsed.tokens?.[k]);
    if (missing.length > 0) {
      throw new Error(`AI response missing tokens: ${missing.slice(0, 3).join(", ")}`);
    }

    return {
      name: String(parsed.name ?? "Custom Theme").slice(0, 60),
      tokens: parsed.tokens,
    };
  });
