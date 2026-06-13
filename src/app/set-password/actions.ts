"use server";

import { redirect } from "next/navigation";

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
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_LEN) {
    return {
      ok: false,
      message: `Das Passwort muss mindestens ${MIN_LEN} Zeichen lang sein.`,
    };
  }
  if (password.length > 200) {
    return { ok: false, message: "Das Passwort ist zu lang." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Die Passwörter stimmen nicht überein." };
  }

  const supabase = await createClient();

  // Must have an active (link-issued) session to set a password.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      message:
        "Deine Sitzung ist abgelaufen. Bitte öffne den Einladungs-Link erneut.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, message: "Passwort konnte nicht gesetzt werden." };
  }

  // Sign out so they log in fresh with the new password (clean state), then
  // surface a success notice on the login screen.
  await supabase.auth.signOut();
  redirect("/login?error=passwortgesetzt");
}
