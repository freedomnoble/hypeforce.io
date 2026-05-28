/**
 * Mascot avatar generation — server-only helpers and style constants.
 * Tune these values to adjust the house style without touching the endpoint.
 */

export const AVATAR_BACKGROUND_COLOR = "#005BBB"; // royal blue
export const AVATAR_LINE_COLOR = "#FFFFFF"; // white linework / fill
export const AVATAR_ALLOWED_OUTPUT_FORMAT: "png" | "webp" = "png";

// MVP default. Swap to "google/gemini-3-pro-image-preview" for higher quality.
export const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "google/gemini-3.1-flash-image-preview";

export const MAX_SOURCE_BYTES = 8 * 1024 * 1024; // 8MB
export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;

export const MASCOT_AVATAR_PROMPT = `Transform the provided real person photo into a single clean retro mascot profile avatar head in the exact same visual system as the platform's existing character avatars. CORE OUTPUT REQUIREMENTS: - Output a square profile-picture image, centered composition, head only. - The final avatar must be a stylized cartoon mascot head, not a realistic portrait. - Use a saturated royal-blue background, approximately #005BBB to #0064C8. - Draw the character as a white face and hair silhouette with thick royal-blue line art. - Add a thick white sticker-like outer border around the entire head shape so the mascot pops from the blue background. - Use only two main colors: royal blue linework/background and white fill. Do not use skin tones, gradients, realistic shading, photographic texture, gray shadows, or extra colors. - Use bold, rounded, smooth vector-style strokes, like a mid-century cereal-box mascot, vintage sticker, retro app icon, or friendly 1950s cartoon head. - Keep the image simple, iconic, and readable at small profile-avatar sizes. HOUSE STYLE PATTERNS TO FOLLOW: - Large expressive head filling most of the square canvas, with generous blue margin around it. - No body, neck, shoulders, clothing, scenery, text, logos, hats, or full-object props. - Simple rounded cartoon ears when visible, using C-shaped inner ear strokes. - Simplified face: curved eyebrows, small rounded nose, simple smiling mouth, and minimal cheek or expression lines. - Eyes may be dots, ovals, sleepy half-lids, a wink, or star/twinkle highlights, but they must stay simple and blue-on-white. - Hair should be one of the main identity anchors. Convert the person's real hair into a simple mascot silhouette: curls, swoop, quiff, short side part, bun, pigtails, waves, shaved outline, bald head shape, or other clear simplified form based on the photo. - Keep every line clean, thick, rounded, and confident. Avoid sketchiness, cross-hatching, thin detail lines, painterly texture, 3D rendering, anime rendering, or comic-book shading. PRESERVE FROM THE USER PHOTO: - Preserve the person's high-level recognizable traits without copying photorealistic identity. - Reflect visible hairstyle, hair volume, hairline, facial hair, glasses, face shape, age cues, freckles, distinctive eyebrows, smile style, and other non-sensitive visible traits when present. - If the person has a beard or mustache, render it as ONE simple solid white shape with a single clean blue outline — like a smooth rounded silhouette. Absolutely no dots, stubble, speckles, hatching, dashes, texture, individual hairs, shading, or fill pattern inside the beard. The beard must read as a single flat sticker shape, the same visual weight as the hair silhouette. Keep it small and tidy, not bushy or detailed. - If the person has wrinkles or older age cues, render them as one or two simple forehead or cheek lines only. - If the person has glasses, render them as simple round or rounded-square blue frames. - If the person has freckles, render them as a few small blue dots on the cheeks. - If the person has long hair, render it as a bold simple silhouette behind or around the face. - If the person has very short hair or is bald, make the head shape and eyebrows expressive so the avatar still feels designed. OPTIONAL GENERATIVE VARIATION: - Add at most one small playful detail if it fits the person and does not clutter the avatar, such as twinkling eyes, one wink, tiny freckles, a simple eyebrow flourish, a tiny pencil tucked behind the ear, or a small curl accent. - Optional details must remain blue-and-white only, simple, and consistent with the existing mascot set. - Do not add random large accessories. Do not add text, background objects, clothing, earrings, necklaces, hats, animals, tools, scenery, or branding. STRICT NEGATIVE RULES: - Do not create a realistic portrait, semi-realistic portrait, painted portrait, 3D character, anime character, manga character, Pixar-style character, clay figure, emoji, Bitmoji, sticker with multicolor fills, or photo edit. - Do not use skin colors, brown hair colors, black outlines, gradients, shadows, texture, halftone dots, paper grain, or any color outside royal blue and white. - Do not include shoulders, torso, hands, clothes, background patterns, frames, captions, usernames, initials, or platform logos. - Do not distort the face into an unflattering caricature. Keep it warm, friendly, optimistic, and approachable. - Do not make the avatar too detailed. The result should look reusable in a cohesive collection. FINAL QUALITY TARGET: The result should look like it belongs to the same blue-and-white retro mascot avatar collection as the platform examples: a clean, bold, friendly, head-only mascot icon that captures the user's visible traits through a small set of reusable generative elements.`;

/**
 * Call Lovable AI Gateway (Gemini image model) with the user photo + style prompt.
 * Returns raw PNG bytes of the generated mascot.
 */
export async function generateMascotImage(sourceDataUrl: string): Promise<Uint8Array> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GEMINI_IMAGE_MODEL,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: MASCOT_AVATAR_PROMPT },
            { type: "image_url", image_url: { url: sourceDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[avatar] gateway error", res.status, errText);
    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
    throw new Error("Generation failed. Please try a different photo.");
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.find((d) => d?.b64_json)?.b64_json;
  if (!b64) {
    console.error("[avatar] no image in response", JSON.stringify(json).slice(0, 500));
    throw new Error("No image returned from generator.");
  }
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
