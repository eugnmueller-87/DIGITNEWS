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
   * RPC flows (create_org_and_admin, redeem_invite, approve_join_request, ...).
   * Never construct a service-role client outside src/lib/supabase/admin.ts.
   */
  supabaseServiceRoleKey: requiredServer(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ),

  /** Waitlist gate for self-service org creation. Defaults to closed. */
  allowOrgSignup: process.env.ALLOW_ORG_SIGNUP === "true",
} as const;
