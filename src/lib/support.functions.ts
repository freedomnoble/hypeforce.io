import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

const SubmitSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1).max(5000),
  page_url: z.string().max(500).optional(),
  user_id: z.string().uuid().nullable().optional(),
  attachments: z
    .array(
      z.object({
        path: z.string().max(500),
        mime: z.string().max(100),
        size_bytes: z.number().int().min(0).max(30_000_000),
        kind: z.enum(["image", "video", "other"]),
      }),
    )
    .max(10)
    .optional(),
});

export const submitSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((i: any) => SubmitSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // simple rate limit: 5 tickets / hour / ip
    let ip = "unknown";
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    } catch {
      // not in request context
    }
    const now = new Date();
    const { data: rl } = await supabaseAdmin
      .from("support_rate_limit")
      .select("*")
      .eq("ip", ip)
      .maybeSingle();
    if (rl) {
      const windowAge = (now.getTime() - new Date(rl.window_start).getTime()) / 1000;
      if (windowAge < 3600 && rl.count >= 5) {
        throw new Error("Too many support requests. Try again in an hour.");
      }
      if (windowAge >= 3600) {
        await supabaseAdmin
          .from("support_rate_limit")
          .update({ count: 1, window_start: now.toISOString() })
          .eq("ip", ip);
      } else {
        await supabaseAdmin
          .from("support_rate_limit")
          .update({ count: rl.count + 1 })
          .eq("ip", ip);
      }
    } else {
      await supabaseAdmin.from("support_rate_limit").insert({ ip, count: 1 });
    }

    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        name: data.name,
        email: data.email,
        message: data.message,
        page_url: data.page_url ?? null,
        user_id: data.user_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.attachments && data.attachments.length > 0) {
      const rows = data.attachments.map((a) => ({
        ticket_id: ticket.id,
        file_path: a.path,
        mime: a.mime,
        size_bytes: a.size_bytes,
        kind: a.kind,
      }));
      await supabaseAdmin.from("support_ticket_attachments").insert(rows);
    }
    return { ok: true, ticket_id: ticket.id };
  });

export const createSupportUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((i: any) => z.object({
    filename: z.string().min(1).max(200),
    kind: z.enum(["image", "video", "other"]),
  }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("support-attachments")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { signedUrl: signed.signedUrl, token: signed.token, path };
  });
