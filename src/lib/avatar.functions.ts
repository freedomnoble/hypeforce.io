import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ALLOWED_MIME,
  AVATAR_ALLOWED_OUTPUT_FORMAT,
  GEMINI_IMAGE_MODEL,
  MAX_SOURCE_BYTES,
  generateMascotImage,
} from "./avatar.server";

const Input = z.object({
  // data URL: "data:image/png;base64,...."
  sourceDataUrl: z.string().startsWith("data:image/").max(15_000_000),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  byteLength: z.number().int().positive().max(MAX_SOURCE_BYTES),
});

export const generateMascotAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    if (!ALLOWED_MIME.includes(data.mimeType)) {
      throw new Error("Unsupported image type.");
    }

    // Mark in-progress
    await supabase
      .from("profiles")
      .update({ avatar_generation_status: "pending" })
      .eq("id", userId);

    let bytes: Uint8Array;
    try {
      bytes = await generateMascotImage(data.sourceDataUrl);
    } catch (err) {
      await supabase
        .from("profiles")
        .update({ avatar_generation_status: "failed" })
        .eq("id", userId);
      throw err;
    }

    // Upload generated avatar (use admin to write under user folder reliably)
    const path = `${userId}/mascot-${Date.now()}.${AVATAR_ALLOWED_OUTPUT_FORMAT}`;
    const contentType = `image/${AVATAR_ALLOWED_OUTPUT_FORMAT}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars-generated")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) {
      console.error("[avatar] upload failed", upErr);
      await supabase
        .from("profiles")
        .update({ avatar_generation_status: "failed" })
        .eq("id", userId);
      throw new Error("Could not save generated avatar.");
    }

    const publicUrl = supabaseAdmin.storage
      .from("avatars-generated")
      .getPublicUrl(path).data.publicUrl;

    const { error: profErr } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        avatar_generated_at: new Date().toISOString(),
        avatar_generation_status: "success",
        avatar_generation_model: GEMINI_IMAGE_MODEL,
      })
      .eq("id", userId);
    if (profErr) {
      console.error("[avatar] profile update failed", profErr);
      throw new Error("Could not update your profile.");
    }

    return { avatarUrl: publicUrl };
  });
