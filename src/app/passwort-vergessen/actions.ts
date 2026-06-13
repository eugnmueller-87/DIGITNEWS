"use server";

import { sendPasswordSetupLink } from "@/lib/auth-flows";
import { parseEmail } from "@/lib/validation";

export interface ForgotState {
  ok: boolean;
  message: string | null;
}

/**
 * Request a password-reset link. Enumeration-resistant: always returns the same
 * neutral success message regardless of whether the account exists. The link is
 * sent via Resend (our domain) and lands on /set-password.
 */
export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  let email: string;
  try {
    email = parseEmail(formData.get("email"));
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  await sendPasswordSetupLink(email);

  return {
    ok: true,
    message:
      "Wenn ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Festlegen eines neuen Passworts geschickt.",
  };
}
