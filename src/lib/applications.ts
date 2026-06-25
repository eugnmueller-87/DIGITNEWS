import "server-only";

import { randomBytes, createHash } from "node:crypto";

import QRCode from "qrcode";

import { provisionPerson } from "@/lib/auth-flows";
import { sendEmail } from "@/lib/email/client";
import { applicationVerificationEmail } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * QR self-apply server flows. The public submit/verify paths run through
 * security-definer RPCs (service role); the tables have no public RLS. The
 * verification token is random (256-bit) and stored only as a sha256 HASH — the
 * plaintext exists only in the emailed link.
 */

/** A join code embedded in a QR. Random, unguessable, URL-safe, org-scoped. */
function newJoinCode(): string {
  // 18 bytes -> 24 url-safe chars; prefixed for readability. ~144 bits entropy.
  return "jc-" + randomBytes(18).toString("base64url");
}

/** A verification token (plaintext for the email) + its at-rest hash. */
function newVerifyToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url"); // 256-bit
  const hash = sha256(token);
  return { token, hash };
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Admin: create a join code for an org. Returns the code. */
export async function createJoinCode(
  actorId: string,
  orgId: string,
  label: string | null,
): Promise<string> {
  const admin = createAdminClient();
  const code = newJoinCode();
  const { error } = await admin.rpc("create_join_code", {
    p_actor_id: actorId,
    p_org_id: orgId,
    p_code: code,
    p_label: label,
  });
  if (error) throw new Error(error.message || "Konnte Code nicht anlegen.");
  return code;
}

/** Build the public apply URL for a join code. */
export function applyUrl(code: string): string {
  return `${publicEnv.siteUrl}/apply/${encodeURIComponent(code)}`;
}

/**
 * PUBLIC preview of a join code (service role; the table has no anon RLS).
 * Returns the org name when the code is live, else null. Reveals only the org
 * name (which a parent holding the physical QR is meant to see), nothing else.
 */
export async function previewJoinCode(code: string): Promise<{
  valid: boolean;
  orgName: string | null;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("join_codes")
    .select("revoked, orgs(name)")
    .eq("code", code)
    .maybeSingle();

  if (error || !data || data.revoked) {
    return { valid: false, orgName: null };
  }
  const org = Array.isArray(data.orgs) ? data.orgs[0] : data.orgs;
  return { valid: true, orgName: org?.name ?? null };
}

/** Render a join code's apply URL as an SVG QR code (string). */
export async function joinCodeQrSvg(code: string): Promise<string> {
  return QRCode.toString(applyUrl(code), {
    type: "svg",
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });
}

/**
 * PUBLIC submit. Validates the code server-side, stores the application with the
 * hashed verify token, and emails the plaintext verification link. Returns
 * nothing meaningful to the caller (neutral response — no enumeration).
 */
export async function submitApplication(input: {
  code: string;
  email: string;
  parentName: string;
  group: string;
  childName: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { token, hash } = newVerifyToken();

  const { data: appId, error } = await admin.rpc("submit_application", {
    p_code: input.code,
    p_email: input.email,
    p_parent_name: input.parentName,
    p_group: input.group,
    p_child_name: input.childName,
    p_token_hash: hash,
    p_ttl_minutes: 1440, // 24h
  });
  // On an invalid code we throw a generic error the caller maps; on success we
  // email the link. We do not reveal whether this email already applied.
  if (error) throw new Error(error.message || "invalid");
  if (!appId) throw new Error("invalid");

  await sendVerificationEmail(input.email, String(appId), token);
}

/**
 * Email the verification link via Resend. The link carries the single-use token
 * (/apply/verify?id=<appId>&token=<plaintext>). If Resend is not configured, the
 * email layer no-ops (logs a warning) — the application row still exists, but the
 * parent won't receive the link until RESEND_API_KEY is set. Never logs the URL.
 */
async function sendVerificationEmail(
  email: string,
  appId: string,
  token: string,
): Promise<void> {
  const url = new URL("/apply/verify", publicEnv.siteUrl);
  url.searchParams.set("id", appId);
  url.searchParams.set("token", token);

  const { subject, html, text } = applicationVerificationEmail(url.toString());
  await sendEmail({ to: email, subject, html, text });
}

/**
 * Admin: re-send the verification email for a PENDING application. Mints a fresh
 * token (new 24h expiry) via the security-definer RPC, then emails the new link
 * to the applicant. Used when the original mail was missed / landed in spam, or
 * the link expired. Authz: requireAdmin upstream + the RPC re-checks org+role.
 */
export async function resendApplicationVerification(
  actorId: string,
  appId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { token, hash } = newVerifyToken();

  const { data: email, error } = await admin.rpc(
    "resend_application_verification",
    {
      p_actor_id: actorId,
      p_app_id: appId,
      p_token_hash: hash,
      p_ttl_minutes: 1440, // 24h
    },
  );
  if (error || !email) {
    throw new Error(error?.message || "Konnte Link nicht erneut senden.");
  }

  await sendVerificationEmail(String(email), appId, token);
}

/** PUBLIC verify. Returns true if the token matches an un-expired pending app. */
export async function verifyApplication(
  appId: string,
  token: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_application", {
    p_app_id: appId,
    p_token_hash: sha256(token),
  });
  if (error) return false;
  return data === true;
}

/**
 * Admin approve: marks approved + purges child data (in the RPC), returns the
 * applicant email, then provisions the member (account + magic login link).
 */
export async function approveApplication(
  actorId: string,
  appId: string,
  orgId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: email, error } = await admin.rpc("approve_application", {
    p_actor_id: actorId,
    p_app_id: appId,
  });
  if (error || !email) {
    throw new Error(error?.message || "Freigabe fehlgeschlagen.");
  }
  // Provision as a member of the org (creates account if needed + sends link).
  await provisionPerson({
    actorId,
    orgId,
    email: String(email),
    role: "member",
    displayName: null,
  });
}

/** Admin reject: marks rejected + purges child data. */
export async function rejectApplication(
  actorId: string,
  appId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("reject_application", {
    p_actor_id: actorId,
    p_app_id: appId,
  });
  if (error) throw new Error(error.message || "Ablehnen fehlgeschlagen.");
}
