"use server";

import { sendLoginLink } from "@/lib/auth-flows";
import { parseEmail } from "@/lib/validation";

export interface ActionState {
  ok: boolean;
  message: string | null;
}

/**
 * Request a magic login link for an EXISTING account. Always reports the same
 * neutral success message regardless of whether the account exists, to avoid
 * account enumeration (Brief §5/§11).
 */
export async function requestLoginLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let email: string;
  try {
    email = parseEmail(formData.get("email"));
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  try {
    await sendLoginLink(email);
  } catch {
    // Generic — never reveal infrastructure or account state.
    return {
      ok: false,
      message: "Etwas ist schiefgelaufen. Bitte versuche es später erneut.",
    };
  }

  return {
    ok: true,
    message:
      "Wenn ein Konto mit dieser E-Mail existiert, haben wir dir einen Login-Link geschickt. Schau in dein Postfach.",
  };
}
