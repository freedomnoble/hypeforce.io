// Server-only helpers for the /pretentious admin console.
// Never import this from client code.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertSuperAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super-admin access required.");
}
