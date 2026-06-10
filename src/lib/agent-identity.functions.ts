import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const trimOrNull = (s: unknown) => {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length === 0 ? null : t.slice(0, 4000);
};

const UpdateAgentInput = z.object({
  agent_id: z.string().uuid(),
  display_name: z.string().nullish(),
  role: z.string().nullish(),
  personality: z.string().nullish(),
});

export const updateAgentIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateAgentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch = {
      display_name: trimOrNull(data.display_name),
      role: trimOrNull(data.role),
      personality: trimOrNull(data.personality),
    };
    const { error } = await supabase
      .from("agents")
      .update(patch as any)
      .eq("id", data.agent_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UpsertOverrideInput = z.object({
  channel_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  display_name: z.string().nullish(),
  role: z.string().nullish(),
  personality: z.string().nullish(),
});

export const upsertChannelAgentOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpsertOverrideInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ch, error: chErr } = await supabase
      .from("channels")
      .select("workspace_id")
      .eq("id", data.channel_id)
      .maybeSingle();
    if (chErr || !ch) throw new Error("Channel not found");

    const row = {
      channel_id: data.channel_id,
      agent_id: data.agent_id,
      workspace_id: (ch as any).workspace_id,
      display_name: trimOrNull(data.display_name),
      role: trimOrNull(data.role),
      personality: trimOrNull(data.personality),
    };
    const { error } = await supabase
      .from("channel_agent_overrides")
      .upsert(row as any, { onConflict: "channel_id,agent_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ClearOverrideInput = z.object({
  channel_id: z.string().uuid(),
  agent_id: z.string().uuid(),
});

export const clearChannelAgentOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ClearOverrideInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("channel_agent_overrides")
      .delete()
      .eq("channel_id", data.channel_id)
      .eq("agent_id", data.agent_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ListInput = z.object({ channel_id: z.string().uuid() });

export const listChannelAgentOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("channel_agent_overrides")
      .select("agent_id,display_name,role,personality")
      .eq("channel_id", data.channel_id);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      agent_id: string;
      display_name: string | null;
      role: string | null;
      personality: string | null;
    }>;
  });
