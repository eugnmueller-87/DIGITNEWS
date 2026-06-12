import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";
import { publicEnv } from "@/lib/env";
import { safeNextPath, parseInviteCode } from "@/lib/validation";

/**
 * Magic-link landing + onboarding finalizer (hardened after security review).
 *
 * KEY SECURITY PROPERTY: the onboarding intent is NEVER read from URL query
 * params (those are user-editable and were a privilege-escalation / waitlist-
 * bypass vector). Instead we:
 *   1. Establish the session — either by verifying a `token_hash` (verifyOtp,
 *      the correct flow for server-issued admin magic links) or by accepting an
 *      already-established Supabase session if present.
 *   2. Identify the user authoritatively via getUser() (validated JWT).
 *   3. Look up the pending onboarding intent SERVER-SIDE, keyed by the
 *      AUTHENTICATED email, via consume_pending_onboarding() — and dispatch on
 *      THAT, ignoring any URL-supplied intent entirely.
 *
 * On any failure we sign the half-authenticated user out and route to /login
 * with a generic error — never leaking which step failed.
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

  // (1) Establish the session.
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return to("/login", true);
  } else {
    // No token_hash: maybe a PKCE `code` (in-browser initiated) — try it.
    const code = searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return to("/login", true);
    }
    // Otherwise fall through: an already-established session may exist.
  }

  // (2) Authoritative identity.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return to("/login", true);
  }

  // Already onboarded? Skip straight to the app (honor a safe `next` for login).
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) {
    return to(next);
  }

  // (3) Finalize onboarding from the SERVER-SIDE pending intent, keyed by the
  // authenticated email. URL params are NOT consulted for the intent.
  const admin = createAdminClient();

  try {
    const { data: pendingRows, error: pendingErr } = await admin.rpc(
      "consume_pending_onboarding",
      { p_email: user.email },
    );
    if (pendingErr) throw pendingErr;

    const pending = Array.isArray(pendingRows) ? pendingRows[0] : pendingRows;

    if (pending?.intent === "org") {
      // Re-check the waitlist gate HERE too (not only in the form action), so a
      // stale/forged path cannot create an org while signup is closed.
      if (!serverEnv.allowOrgSignup) {
        await supabase.auth.signOut();
        return to("/login", true);
      }
      if (!pending.org_name || !pending.org_type) {
        await supabase.auth.signOut();
        return to("/login", true);
      }
      const { error } = await admin.rpc("create_org_and_admin", {
        p_user_id: user.id,
        p_org_name: String(pending.org_name).slice(0, 120),
        p_org_type: pending.org_type,
        p_display_name: null,
      });
      if (error) throw error;
      return to("/feed");
    }

    if (pending?.intent === "invite") {
      const inviteCode = parseInviteCode(String(pending.invite_code ?? ""));
      const { error } = await admin.rpc("redeem_invite", {
        p_user_id: user.id,
        p_code: inviteCode,
        p_display_name: null,
      });
      if (error) throw error;
      return to("/feed");
    }

    // No pending intent. This may be an APPROVED join (email-bound): try it.
    const { error: approvedErr } = await admin.rpc("redeem_approved_join", {
      p_user_id: user.id,
      p_email: user.email,
      p_display_name: null,
    });
    if (!approvedErr) {
      return to("/feed");
    }

    // Authenticated but no profile and no onboarding path: a stale link. Send to
    // /start so they can create an org (gated by the waitlist there).
    return to("/start");
  } catch {
    // Onboarding failed (invalid/exhausted invite, race, etc.). Don't leave the
    // user lingering profile-less: sign out, route to login with generic error.
    await supabase.auth.signOut();
    return to("/login", true);
  }
}
