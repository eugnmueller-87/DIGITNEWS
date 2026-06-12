import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * SERVICE-ROLE Supabase client. BYPASSES RLS. This is the master key.
 *
 * USE ONLY to invoke the security-definer RPC flows (create_org_and_admin,
 * redeem_invite, request_join, approve_join_request, redeem_approved_join,
 * delete_user_account) — and only AFTER you have done your own server-side auth
 * and role checks. Do NOT use it for general data access; use the RLS-governed
 * server client instead.
 *
 * `server-only` + the service-role env (also `server-only`) guarantee this can
 * never be bundled into client code.
 */
export function createAdminClient() {
  return createSupabaseClient(
    publicEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
