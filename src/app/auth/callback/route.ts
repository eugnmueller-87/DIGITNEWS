import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { isSuperadminEmail } from "@/lib/env.server";
import { ensureSuperadmin, activateProfile } from "@/lib/auth-flows";
import { safeNextPath } from "@/lib/validation";

/**
 * Magic-link landing (operator-provisioned model).
 *
 * Flow:
 *   1. Establish the session — verifyOtp({ token_hash, type }) for server-issued
 *      links (or exchangeCodeForSession for a true in-browser PKCE code).
 *   2. Identify the user via getUser() (validated JWT).
 *   3. If the email is an allowlisted operator, bootstrap/elevate to superadmin.
 *   4. Activate a freshly-provisioned profile ('invited' -> 'active').
 *   5. Route by presence of a profile: no profile => the user was not provisioned
 *      (dead-end at /login with a clear message); otherwise => /feed (role-based
 *      surfaces are reachable from there).
 *
 * There is NO onboarding intent in the URL anymore. Provisioning happens when an
 * operator/admin adds a person; the link only logs them in.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "magiclink") as EmailOtpType;
  const next = safeNextPath(searchParams.get("next"));

  const to = (path: string, errored = false) => {
    const url = new URL(path, publicEnv.siteUrl);
    if (errored) url.searchParams.set("error", "auth");
    return NextResponse.redirect(url);
  };

  const supabase = await createClient();

  // (1) Establish session.
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return to("/login", true);
  } else {
    const code = searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return to("/login", true);
    }
  }

  // (2) Authoritative identity.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return to("/login", true);

  // (3) Operator bootstrap (env allowlist). Creates/elevates a superadmin.
  if (isSuperadminEmail(user.email)) {
    try {
      await ensureSuperadmin(user.id, user.email);
    } catch {
      // Bootstrap failure shouldn't hard-fail a valid login; fall through and
      // let the profile check below decide. (A retry on next login will fix it.)
    }
  }

  // (4) Does the user have a profile? (Provisioned by operator/admin, or just
  // bootstrapped above.)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Authenticated but never provisioned into any org. Sign out and send to
    // login with a generic notice — they must be added by an admin/operator.
    await supabase.auth.signOut();
    const url = new URL("/login", publicEnv.siteUrl);
    url.searchParams.set("error", "notprovisioned");
    return NextResponse.redirect(url);
  }

  // (5) Activate an invited profile on first login.
  try {
    await activateProfile(user.id);
  } catch {
    /* non-fatal */
  }

  return to(next);
}
