"use server";

import { sendRegistrationCode } from "@/lib/auth-flows";
import { parseEmail } from "@/lib/validation";

export interface ForgotState {
  ok: boolean;
  message: string | null;
}

/**
 * Request a registration / reset CODE. Enumeration-resistant: always returns the
 * same neutral success message regardless of whether the account exists. A
 * 6-digit code is sent via Resend (our domain); the user enters it on
 * /registrieren.
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

  await sendRegistrationCode(email);

  return {
    ok: true,
    message:
      "Wenn ein Konto mit dieser E-Mail existiert, haben wir dir einen Code geschickt. Gib ihn auf der Seite „Anmelden mit Code“ ein.",
  };
}
