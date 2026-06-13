"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { parseEmail, safeNextPath } from "@/lib/validation";

export interface ActionState {
  ok: boolean;
  message: string | null;
}

/**
 * Email + password sign-in for an EXISTING, provisioned account.
 *
 * There is still NO public signup: accounts are created only by the
 * operator/admin invite flow, and a user can only sign in once they've set a
 * password via the one-time invite link (see /set-password). A failed sign-in
 * returns a single neutral message — we never reveal whether the email exists
 * or whether it was the password that was wrong (enumeration resistance).
 *
 * On success, Supabase writes the session cookies via the server client and we
 * redirect to the (sanitized) next path, default /feed. Role-based surfaces are
 * reachable from there; the middleware + requireSession re-check authz.
 */
export async function signIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let email: string;
  try {
    email = parseEmail(formData.get("email"));
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const password = String(formData.get("password") ?? "");
  if (password.length === 0) {
    return { ok: false, message: "Bitte gib dein Passwort ein." };
  }

  const next = safeNextPath(String(formData.get("next") ?? "/feed"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Uniform message — do not distinguish "no such account" from "wrong
    // password" (no enumeration oracle).
    return {
      ok: false,
      message: "E-Mail oder Passwort ist nicht korrekt.",
    };
  }

  redirect(next);
}
