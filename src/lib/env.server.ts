import "server-only";

/**
 * SERVER-ONLY environment — secrets. The `server-only` import above makes the
 * build FAIL if this module is ever imported into a client component, which is
 * our compile-time guarantee that the service-role key can never reach the
 * browser bundle. (Brief §11: "service role key server-only".)
 */

function requiredServer(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required server env var: ${name}`);
  }
  return value;
}

export const serverEnv = {
  /**
   * Service-role key. BYPASSES RLS. Used ONLY to invoke the security-definer
   * provisioning flows (create_org, add_person, remove_person, set_admin,
   * ensure_superadmin, ...). Never construct a service-role client outside
   * src/lib/supabase/admin.ts.
   */
  supabaseServiceRoleKey: requiredServer(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ),

  /**
   * Allowlist of operator emails that are auto-elevated to `superadmin` at first
   * login (the bootstrap path — there is no one above the operator to add them).
   * Comma-separated, case-insensitive. Keep this tiny. A user whose email is
   * here becomes a cross-org operator; treat it like a privileged credential.
   * SQL fallback for break-glass is documented in the README.
   */
  superadminEmails: (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0),

  /**
   * Resend API key for app-owned emails (QR verification, later digests). When
   * unset, the email layer no-ops gracefully (logs a warning) rather than
   * throwing — so local dev / CI work without it. Magic LOGIN links are sent by
   * Supabase (configure Supabase SMTP to use Resend); this key is for the emails
   * WE send directly.
   */
  resendApiKey: process.env.RESEND_API_KEY || null,

  /**
   * The "from" address for app-owned emails, e.g. "Aushang <hallo@aushang.app>".
   * Must be on a domain verified in Resend. Falls back to a Resend test sender
   * if unset (only works for sending to the account owner's own address).
   */
  emailFrom: process.env.EMAIL_FROM || null,

  /**
   * Base URL of the VPS OCR/redaction worker (e.g. https://worker.aushang.app).
   * When unset, capture uploads succeed but the post stays 'processing' (no
   * worker to trigger) — documented in README.
   */
  workerUrl: process.env.WORKER_URL || null,

  /**
   * Shared secret authenticating both directions between app and worker. The app
   * sends it when triggering /process; the worker sends it back on /api/worker/
   * callback. Constant-time compared. Required for the callback to be trusted.
   */
  workerSharedSecret: process.env.WORKER_SHARED_SECRET || null,

  /** Web Push VAPID private key (server-only). Pairs with the public key below. */
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || null,

  /** Contact for VAPID (mailto:). Some push services require it. */
  vapidSubject: process.env.VAPID_SUBJECT || "mailto:hallo@aushang.app",
} as const;

/** Is this email an allowlisted operator (case-insensitive)? */
export function isSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return serverEnv.superadminEmails.includes(email.trim().toLowerCase());
}
