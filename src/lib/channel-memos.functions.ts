import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateInput = z.object({
  channelId: z.string().uuid(),
  title: z.string().max(160).optional(),
  body: z.string().min(1).max(8000),
  tags: z.array(z.string().min(1).max(40)).max(8).default([]),
});

export const createChannelMemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ch, error: chErr } = await supabase
      .from("channels")
      .select("id, workspace_id")
      .eq("id", data.channelId)
      .maybeSingle();
    if (chErr) throw new Error(chErr.message);
    if (!ch) throw new Error("Channel not found.");

    const { data: row, error } = await supabase
      .from("channel_memos")
      .insert({
        workspace_id: ch.workspace_id,
        channel_id: ch.id,
        author_type: "user",
        author_user_id: userId,
        title: data.title?.trim() || null,
        body: data.body,
        tags: data.tags,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const DeleteInput = z.object({ memoId: z.string().uuid() });

export const deleteChannelMemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DeleteInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("channel_memos")
      .delete()
      .eq("id", data.memoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
