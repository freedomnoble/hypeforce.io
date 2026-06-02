import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * BYOK ("Bring Your Own Key") connections are PERSONAL to the signed-in user,
 * NOT shared at the workspace level. Each row in `user_ai_connections` is
 * keyed by (user_id, provider) and the encrypted key is only ever decrypted
 * server-side. A workspace admin can choose to route an agent through the
 * `byok:<provider>` channel, but at request time the router uses the calling
 * user's own key — never another user's.
 */

export const SUPPORTED_PROVIDERS = ["openai", "anthropic", "google", "manus"] as const;
export type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

const ProviderEnum = z.enum(SUPPORTED_PROVIDERS);

/**
 * The only routes we accept for an agent. Anything else is rejected before
 * it can be persisted, so the agent router never sees free-form strings.
 */
const RouteSchema = z.union([
  z.literal("lovable"),
  z.string().regex(/^byok:(openai|anthropic|google|manus)$/),
]);

const ConnectSchema = z.object({
  provider: ProviderEnum,
  api_key: z.string().min(8).max(500),
});

const DisconnectSchema = z.object({
  provider: ProviderEnum,
});

const SetRouteSchema = z.object({
  agent_id: z.string().uuid(),
  route: RouteSchema,
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

/**
 * Update an agent's preferred route. Authorization rules:
 *  - the input route must match RouteSchema (no free-form strings),
 *  - the caller must be an admin/owner of the agent's workspace,
 *  - if route is `byok:<provider>`, the caller must have an ACTIVE
 *    personal connection for that provider.
 *
 * NOTE: BYOK keys are personal. Saving `byok:openai` here means "use
 * whichever user triggered the agent reply"'s OpenAI key. The router
 * gracefully errors if that user has no active key at call time.
 */
export const setAgentRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SetRouteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Look up the agent's workspace via the user-scoped client so RLS already
    // filters to workspaces the caller can see.
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("id,workspace_id")
      .eq("id", data.agent_id)
      .maybeSingle();
    if (agentErr) throw new Error(agentErr.message);
    if (!agent) throw new Error("Agent not found or not visible to you.");

    // Admin gate: only workspace owners/admins can change routing.
    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_workspace_admin", {
      _user_id: userId,
      _workspace_id: agent.workspace_id,
    });
    if (adminErr) throw new Error(adminErr.message);
    if (!isAdmin) {
      throw new Error("Only workspace admins can change agent routing.");
    }

    // BYOK precondition: caller must actually have an active key.
    let storedRoute: string | null = null;
    if (data.route !== "lovable") {
      const provider = data.route.slice("byok:".length) as ProviderId;
      const { data: conn, error: connErr } = await supabase
        .from("user_ai_connections")
        .select("status")
        .eq("user_id", userId)
        .eq("provider", provider)
        .maybeSingle();
      if (connErr) throw new Error(connErr.message);
      if (!conn || conn.status !== "active") {
        throw new Error(
          `Connect an active ${provider} key in Profile → AI Connections before routing agents through it.`,
        );
      }
      storedRoute = data.route;
    }

    const { error } = await supabase
      .from("agents")
      .update({ preferred_route: storedRoute })
      .eq("id", data.agent_id);
    if (error) throw new Error(error.message);
    return { ok: true, route: storedRoute ?? "lovable" };
  });
