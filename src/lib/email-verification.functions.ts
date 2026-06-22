import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Custom email verification, separate from Supabase's built-in confirmation.
 *
 * We auto-confirm Supabase emails so signup returns a session immediately
 * and users can finish onboarding + subscribe without delay. This module
 * tracks a separate `email_verified_at` on the profile, set when the user
 * clicks a link from a verification email.
 *
 * Gated actions (2nd channel, 2nd workspace, invites) call assertEmailVerified.
 */

export const EMAIL_VERIFICATION_REQUIRED = "EMAIL_VERIFICATION_REQUIRED";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function makeToken(): Promise<string> {
  // Cloudflare Workers expose crypto.randomUUID via globalThis.crypto.
  return crypto.randomUUID();
}

export const getEmailVerificationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("email, email_verified_at, verification_token_sent_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      email: data?.email ?? null,
      verified: !!data?.email_verified_at,
      lastSentAt: data?.verification_token_sent_at ?? null,
    };
  });

export const sendVerificationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, email, email_verified_at, verification_token_sent_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Profile not found");
    if (profile.email_verified_at) return { ok: true, alreadyVerified: true };

    // Rate-limit: at most one send per 60s.
    if (profile.verification_token_sent_at) {
      const last = new Date(profile.verification_token_sent_at).getTime();
      if (Date.now() - last < 60_000) {
        return { ok: true, throttled: true };
      }
    }

    const token = await makeToken();
    const { error: upErr } = await admin
      .from("profiles")
      .update({
        verification_token: token,
        verification_token_sent_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (upErr) throw new Error(upErr.message);

    const link = `/verify-email?token=${token}`;
    // Best-effort send via Lovable email infra. Logs the link if infra is
    // not yet configured — the user can still verify via the resend flow
    // on /verify-email once email is set up.
    try {
      const origin = process.env.SITE_URL || "";
      const fullLink = `${origin}${link}`;
      // Email delivery wiring lives in src/lib/email/send.ts once email
      // infrastructure is scaffolded. For now log so dev can copy the link.
      console.log(
        "[email-verification] send to",
        profile.email,
        "link:",
        fullLink,
      );
    } catch (e) {
      console.error("[email-verification] send failed", e);
    }

    return { ok: true };
  });

export const confirmEmailVerification = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string }) =>
    z.object({ token: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, email_verified_at")
      .eq("verification_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) return { ok: false, reason: "invalid_or_expired" as const };
    if (profile.email_verified_at) return { ok: true, alreadyVerified: true };

    const { error: upErr } = await admin
      .from("profiles")
      .update({
        email_verified_at: new Date().toISOString(),
        verification_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

/**
 * Throws EMAIL_VERIFICATION_REQUIRED when caller has not verified.
 * Use from other server fns that should be gated.
 */
export async function assertEmailVerified(userId: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("email_verified_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.email_verified_at) {
    const e = new Error(
      "Verify your email to unlock this. Check your inbox or resend from /verify-email.",
    );
    (e as any).code = EMAIL_VERIFICATION_REQUIRED;
    throw e;
  }
}
