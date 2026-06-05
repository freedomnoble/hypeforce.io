import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const SubmitSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1).max(5000),
  page_url: z.string().max(500).optional(),
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

// Derive the calling user id from the optional bearer token. Returns null
// for anonymous callers — never trusts a client-supplied user_id.
async function deriveUserIdFromAuth(): Promise<string | null> {
  let authHeader: string | null | undefined;
  try {
    authHeader = getRequestHeader("authorization");
  } catch {
    return null;
  }
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return null;
  try {
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

// Shared rate limit: `limit` calls/hour/ip per action key.
async function checkRateLimit(action: string, limit: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let ip = "unknown";
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    // no request context
  }
  const key = `${action}:${ip}`;
  const now = new Date();
  const { data: rl } = await supabaseAdmin
    .from("support_rate_limit")
    .select("*")
    .eq("ip", key)
    .maybeSingle();
  if (rl) {
    const windowAge = (now.getTime() - new Date(rl.window_start).getTime()) / 1000;
    if (windowAge < 3600 && rl.count >= limit) {
      throw new Error("Too many requests. Try again in an hour.");
    }
    if (windowAge >= 3600) {
      await supabaseAdmin
        .from("support_rate_limit")
        .update({ count: 1, window_start: now.toISOString() })
        .eq("ip", key);
    } else {
      await supabaseAdmin
        .from("support_rate_limit")
        .update({ count: rl.count + 1 })
        .eq("ip", key);
    }
  } else {
    await supabaseAdmin.from("support_rate_limit").insert({ ip: key, count: 1 });
  }
}

export const submitSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((i: any) => SubmitSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await checkRateLimit("submit", 5);

    // Derive user_id server-side from the bearer token; never trust the client.
    const derivedUserId = await deriveUserIdFromAuth();

    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        name: data.name,
        email: data.email,
        message: data.message,
        page_url: data.page_url ?? null,
        user_id: derivedUserId,
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
    // Prevent storage cost abuse on unauth endpoint: 20 signed URLs / hour / IP.
    await checkRateLimit("upload", 20);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("support-attachments")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { signedUrl: signed.signedUrl, token: signed.token, path };
  });
