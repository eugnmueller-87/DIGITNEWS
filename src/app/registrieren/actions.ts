"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { parseEmail } from "@/lib/validation";

export interface RegisterState {
  ok: boolean;
  message: string | null;
}

/**
 * Verify a registration / reset CODE (typed, not a link — so email scanners
 * can't consume it). On success the session is established and we redirect to
 * /set-password. Neutral error messages (no enumeration). No public signup:
 * the code only exists for an account an operator/admin already provisioned (or
 * an existing account requesting a reset).
 */
export async function verifyCode(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  let email: string;
  try {
    email = parseEmail(formData.get("email"));
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const token = String(formData.get("code") ?? "")
    .replace(/\s/g, "")
    .trim();
  if (!/^[0-9A-Za-z]{6,10}$/.test(token)) {
    return { ok: false, message: "Bitte gib den Code aus der E-Mail ein." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });

  if (error) {
    return {
      ok: false,
      message: "Code ist ungültig oder abgelaufen. Fordere einen neuen an.",
    };
  }

  // Session established → go set the password.
  redirect("/set-password");
}
