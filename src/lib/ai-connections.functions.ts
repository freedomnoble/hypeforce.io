import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProviderEnum = z.enum(["openai", "anthropic", "google", "manus"]);

const ConnectSchema = z.object({
  provider: ProviderEnum,
  api_key: z.string().min(8).max(500),
});

const DisconnectSchema = z.object({
  provider: ProviderEnum,
});

const SetRouteSchema = z.object({
  agent_id: z.string().uuid(),
  // "lovable" or "byok:openai" / "byok:anthropic" / ...
  route: z.string().min(1).max(64),
});

export const listMyConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_ai_connections")
      .select("provider,key_last4,status,connected_at,last_validated_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const connectProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ConnectSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { validateProviderKey } = await import("./ai-providers.server");
    const { encryptApiKey, maskKey } = await import("./ai-crypto.server");

    await validateProviderKey(data.provider, data.api_key);
    const encrypted = await encryptApiKey(data.api_key);
    const last4 = maskKey(data.api_key);

    const { error } = await supabase
      .from("user_ai_connections")
      .upsert(
        {
          user_id: userId,
          provider: data.provider,
          encrypted_key: encrypted,
          key_last4: last4,
          status: "active",
          connected_at: new Date().toISOString(),
          last_validated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, provider: data.provider, key_last4: last4 };
  });

export const disconnectProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DisconnectSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_ai_connections")
      .delete()
      .eq("user_id", userId)
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAgentRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SetRouteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const route = data.route === "lovable" ? null : data.route;
    const { error } = await supabase
      .from("agents")
      .update({ preferred_route: route })
      .eq("id", data.agent_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
