import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  channelId: z.string().uuid(),
  agentId: z.string().uuid(),
});

export const addAgentToChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ch, error: chErr } = await supabase
      .from("channels")
      .select("id, workspace_id")
      .eq("id", data.channelId)
      .maybeSingle();
    if (chErr) throw new Error(chErr.message);
    if (!ch) throw new Error("Channel not found.");

    const { data: ag, error: agErr } = await supabase
      .from("agents")
      .select("id, workspace_id")
      .eq("id", data.agentId)
      .maybeSingle();
    if (agErr) throw new Error(agErr.message);
    if (!ag || ag.workspace_id !== ch.workspace_id) {
      throw new Error("Agent does not belong to this workspace.");
    }

    // Idempotent: ignore duplicate-row errors.
    const { error } = await supabase
      .from("channel_members")
      .insert({ channel_id: data.channelId, member_type: "agent", agent_id: data.agentId });
    if (error && !/duplicate key|unique/i.test(error.message)) {
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeAgentFromChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("channel_members")
      .delete()
      .eq("channel_id", data.channelId)
      .eq("member_type", "agent")
      .eq("agent_id", data.agentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
