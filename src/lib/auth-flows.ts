import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side provisioning + auth helpers for the operator-provisioned model.
 *
 * Model:
 *   - No public signup. Accounts are created here, server-side, only by an
 *     authorized actor (superadmin or admin), via the admin API + the
 *     security-definer flows. This is the single controlled creation path.
 *   - Magic links are admin-generated and verified by the callback via
 *     verifyOtp({ token_hash, type }). The email template must deliver token_hash
 *     (see supabase/config.toml + README).
 *   - There is NO onboarding intent in the URL; a provisioned user simply logs
 *     in and lands on their feed (or operator/admin surface by role).
 */

/**
 * Create-or-find the auth user for `email` AND have Supabase email them a magic
 * link, in a SINGLE admin.generateLink call. generateLink creates the user if it
 * doesn't exist (admin API is not bound by enable_signup), returns the user in
 * `data.user`, and — with SMTP configured — triggers the email. This avoids the
 * unpaginated listUsers() lookup entirely and never mints a throwaway probe user
 * separately from sending the link.
 *
 * Returns { userId, link } — `link` is the action_link (useful if we later send
 * the email ourselves via Resend instead of relying on Supabase SMTP).
 */
async function generateLoginLink(
  email: string,
): Promise<{ userId: string; link: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.user) {
    throw new Error("Login-Link konnte nicht erstellt werden.");
  }
  return {
    userId: data.user.id,
    link: data.properties?.action_link ?? "",
  };
}

/**
 * Plain login for an existing user. Does not reveal whether the account exists
 * (enumeration resistance): for an unknown email generateLink still creates a
 * user, but since no profile is attached, the callback bounces them to
 * /login?error=notprovisioned — they learn nothing about other accounts. We
 * swallow all errors to keep the response uniform.
 */
export async function sendLoginLink(email: string): Promise<void> {
  try {
    await generateLoginLink(email);
  } catch {
    /* uniform response regardless of outcome */
  }
}

export type ProvisionOutcome =
  | "added" // newly added to this org; link sent
  | "already_elsewhere"; // the email already belongs to some org — no-op

/**
 * Provision a person into an org with a role, performed by `actorId`.
 *
 * Flow: generateLink creates-or-finds the auth user (and queues the email), then
 * add_person writes the profile with the actor's authorization re-checked in the
 * DB. If the email already belongs to ANY org, add_person rejects it and we
 * return "already_elsewhere" — the CALLER must render the SAME neutral message
 * for both outcomes so this is not a cross-tenant existence oracle.
 *
 * Authorization is enforced in TWO places: the caller checks the actor's role,
 * and add_person re-checks it (defense in depth).
 */
export async function provisionPerson(params: {
  actorId: string;
  orgId: string;
  email: string;
  role: "admin" | "member";
  displayName?: string | null;
}): Promise<ProvisionOutcome> {
  const admin = createAdminClient();

  // Create-or-find the user and queue the magic-link email in one call.
  const { userId } = await generateLoginLink(params.email);

  const { error } = await admin.rpc("add_person", {
    p_actor_id: params.actorId,
    p_target_user_id: userId,
    p_target_org_id: params.orgId,
    p_role: params.role,
    p_display_name: params.displayName ?? null,
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("already belongs")) {
      // Email is provisioned somewhere already. Treat as a benign no-op; the
      // caller shows the neutral "done" message either way (no enumeration).
      return "already_elsewhere";
    }
    // Authorization / other failures are real errors the caller maps.
    throw new Error(error.message || "Konnte Person nicht hinzufügen.");
  }

  return "added";
}

/**
 * Remove a person from their org, performed by `actorId`. Delegates the
 * authorization + last-admin guard to remove_person in the DB.
 */
export async function removePerson(
  actorId: string,
  targetUserId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("remove_person", {
    p_actor_id: actorId,
    p_target_user_id: targetUserId,
  });
  if (error) throw new Error(error.message || "Konnte Person nicht entfernen.");
}

/**
 * Superadmin: create an org. Returns the new org id. The first admin is added
 * separately via provisionPerson(role:'admin').
 */
export async function createOrg(
  actorId: string,
  orgName: string,
  orgType: string,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_org", {
    p_actor_id: actorId,
    p_org_name: orgName,
    p_org_type: orgType,
  });
  if (error) throw new Error(error.message || "Konnte Organisation nicht anlegen.");
  return data as string;
}

/**
 * Superadmin: delete an org and erase its accounts/data (GDPR erasure, or
 * rolling back a half-provisioned org). Refuses the operator's own anchor org.
 */
export async function deleteOrg(actorId: string, orgId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_org", {
    p_actor_id: actorId,
    p_org_id: orgId,
  });
  if (error) throw new Error(error.message || "Konnte Organisation nicht löschen.");
}

/** Superadmin: grant or revoke admin rights for a target user. */
export async function setAdmin(
  actorId: string,
  targetUserId: string,
  makeAdmin: boolean,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_admin", {
    p_actor_id: actorId,
    p_target_user_id: targetUserId,
    p_make_admin: makeAdmin,
  });
  if (error) throw new Error(error.message || "Konnte Rolle nicht ändern.");
}

/**
 * Bootstrap: ensure the given user is a superadmin (used at login when the email
 * is in the SUPERADMIN_EMAILS allowlist). Creates an operator org + profile if
 * the user has none, or elevates an existing profile. Idempotent.
 */
export async function ensureSuperadmin(
  userId: string,
  email: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("ensure_superadmin", {
    p_user_id: userId,
    p_email: email,
  });
  if (error) throw new Error("Operator-Bootstrap fehlgeschlagen.");
}

/** Flip a freshly-provisioned profile from 'invited' to 'active' on first login. */
export async function activateProfile(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("activate_profile", { p_user_id: userId });
}
