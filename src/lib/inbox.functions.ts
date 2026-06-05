import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("admin_user_messages")
      .select("id, subject, body, read_at, created_at, sender_user_id")
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const senderIds = Array.from(
      new Set((data ?? []).map((m) => m.sender_user_id).filter(Boolean) as string[]),
    );
    let senders: Record<string, { display_name: string | null; email: string | null }> = {};
    if (senderIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", senderIds);
      for (const p of profs ?? []) {
        senders[p.id] = { display_name: p.display_name, email: p.email };
      }
    }

    return {
      messages: (data ?? []).map((m) => ({
        ...m,
        sender: m.sender_user_id ? senders[m.sender_user_id] ?? null : null,
      })),
    };
  });

export const getUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count, error } = await supabase
      .from("admin_user_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const markMessageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("admin_user_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("recipient_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("admin_user_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_user_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
