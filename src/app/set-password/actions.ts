"use server";

import { redirect } from "next/navigation";

import { activateProfile } from "@/lib/auth-flows";
import { fmt } from "@/lib/i18n/format";
import { getDict } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export interface SetPasswordState {
  ok: boolean;
  message: string | null;
}

const MIN_LEN = 8;

/**
 * Set (or reset) the signed-in user's password. Reached from the one-time
 * invite/recovery link: the /auth/callback established a session from the link's
 * token_hash, so updateUser() acts on the authenticated user. No public signup
 * path is opened — this only works for a user who already holds a valid
 * link-issued session.
 */
export async function setPassword(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const dict = await getDict();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_LEN) {
    return {
      ok: false,
      message: fmt(dict.actions.passwordTooShort, { min: MIN_LEN }),
    };
  }
  if (password.length > 200) {
    return { ok: false, message: dict.actions.passwordTooLong };
  }
  if (password !== confirm) {
    return { ok: false, message: dict.actions.passwordsMismatch };
  }

  const supabase = await createClient();

  // Must have an active (link-issued) session to set a password.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: dict.actions.sessionExpired };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, message: dict.actions.passwordSetFailed };
  }

  // Activate the profile: setting a password from the one-time invite/recovery
  // link is the moment an invited user proves ownership. Standing login uses
  // signInWithPassword, which never hits /auth/callback (where activation also
  // lives), so without this an invited member would stay 'invited' forever even
  // after logging in. Non-fatal: never block the password set on this.
  try {
    await activateProfile(user.id);
  } catch {
    /* non-fatal — the label is cosmetic; access is unaffected */
  }

  // Sign out so they log in fresh with the new password (clean state), then
  // surface a success notice on the login screen.
  await supabase.auth.signOut();
  redirect("/login?error=passwortgesetzt");
}
