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
} as const;

/** Is this email an allowlisted operator (case-insensitive)? */
export function isSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return serverEnv.superadminEmails.includes(email.trim().toLowerCase());
}
