import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side onboarding/auth helpers.
 *
 * Security model (post-review hardening):
 *   - Public signup is DISABLED (config.toml). Accounts are created only here,
 *     server-side, via the security-definer RPCs — after our own validation.
 *   - The onboarding INTENT (create org / redeem invite) is NOT carried in the
 *     magic-link URL, because those params are user-editable and were a
 *     privilege-escalation / waitlist-bypass vector. Instead the intent is
 *     persisted server-side in `pending_onboarding`, keyed by the lowercased
 *     email, and the callback looks it up by the AUTHENTICATED email.
 *   - Links are admin-generated and verified with verifyOtp({token_hash,type}).
 *     We pass the token_hash to /auth/callback ourselves; this is the correct
 *     flow for server-issued magic links (exchangeCodeForSession/PKCE does not
 *     apply because sign-in is initiated server-side, not in the browser).
 *
 * generateLink returns { properties.hashed_token, properties.verification_type }.
 * Supabase ALSO emails the link automatically when SMTP is configured; that
 * emailed link points at Supabase's /verify endpoint which then redirects to our
 * redirectTo. Either way the callback verifies via token_hash.
 */

/**
 * Generate (and have Supabase email) a magic link for `email`. The admin API
 * creates the user if missing — it is not bound by enable_signup, so this is our
 * single controlled account-creation path. Does NOT reveal whether the user
 * already existed (enumeration resistance).
 *
 * Supabase delivers the email itself when SMTP is configured. The magic-link
 * email template MUST point at `/auth/callback?token_hash={{ .TokenHash }}&type=
 * magiclink` (see supabase/config.toml), so the callback can verify via
 * verifyOtp({ token_hash, type }). The onboarding INTENT is NOT in the link — it
 * lives server-side in `pending_onboarding`, keyed by email.
 */
async function generateMagicLink(email: string): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    // For login of a non-existent user we silently no-op (no enumeration). For a
    // genuinely broken config, surface a generic error.
    if (msg.includes("not found") || msg.includes("no user")) return;
    if (!msg.includes("already") && !msg.includes("registered")) {
      throw new Error("Login-Link konnte nicht gesendet werden.");
    }
  }
}

/**
 * Org creation: persist the pending intent server-side (keyed by email), then
 * send the magic link. The link contains NO org params — the callback reads the
 * intent from `pending_onboarding` by the authenticated email.
 */
export async function startOrgCreation(
  email: string,
  orgName: string,
  orgType: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_pending_org", {
    p_email: email,
    p_org_name: orgName,
    p_org_type: orgType,
  });
  if (error) throw new Error("Konnte Registrierung nicht vorbereiten.");
  await generateMagicLink(email);
}

/**
 * Invite redemption (no approval): persist the pending invite intent server-side
 * keyed by email, then send the magic link. The callback redeems the invite that
 * was bound to THIS email — an attacker cannot swap in another org's code.
 */
export async function startInviteRedemption(
  email: string,
  code: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_pending_invite", {
    p_email: email,
    p_code: code,
  });
  if (error) throw new Error("Konnte Beitritt nicht vorbereiten.");
  await generateMagicLink(email);
}

/**
 * Approved join: the approved requester gets a magic link. The callback finalizes
 * via redeem_approved_join keyed on the authenticated email (already email-bound;
 * no pending_onboarding row needed). No org params travel in the URL.
 */
export async function sendApprovedJoinLink(email: string): Promise<void> {
  await generateMagicLink(email);
}

/**
 * Plain login for existing users. No onboarding intent is set, so the callback
 * finds no pending row and routes the user to their feed. Does not reveal
 * whether the account exists. (The `next` redirect hint is a Phase 4 concern,
 * deliverable once we control the email body via Resend; Supabase's own template
 * delivery does not thread it through.)
 */
export async function sendLoginLink(email: string): Promise<void> {
  await generateMagicLink(email);
}
