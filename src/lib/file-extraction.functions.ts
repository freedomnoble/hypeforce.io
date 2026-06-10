import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ fileId: z.string().uuid() });

export const extractFileText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // RLS-checked read first so we confirm the user can see this file.
    const { data: file, error: fErr } = await supabase
      .from("files")
      .select("id, workspace_id, bucket, path, filename, mime_type")
      .eq("id", data.fileId)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!file) throw new Error("File not found or you don't have access.");

    // Mark pending
    await supabaseAdmin
      .from("files")
      .update({ extraction_status: "pending", extraction_error: null })
      .eq("id", file.id);

    // Download object via admin (covers private buckets like 'attachments').
    const { data: blob, error: dErr } = await supabaseAdmin.storage
      .from(file.bucket as string)
      .download(file.path as string);
    if (dErr || !blob) {
      await supabaseAdmin
        .from("files")
        .update({ extraction_status: "failed", extraction_error: dErr?.message ?? "download failed" })
        .eq("id", file.id);
      throw new Error(dErr?.message ?? "Couldn't download file");
    }

    const buf = await blob.arrayBuffer();
    const { extractToMarkdown } = await import("./file-extraction.server");
    const res = await extractToMarkdown(file.filename as string, file.mime_type as string | null, buf);

    await supabaseAdmin
      .from("files")
      .update({
        content_text: res.status === "ok" ? res.content : null,
        extraction_status: res.status,
        extraction_error: res.error ?? null,
      })
      .eq("id", file.id);

    return { status: res.status, error: res.error, chars: res.content.length };
  });
