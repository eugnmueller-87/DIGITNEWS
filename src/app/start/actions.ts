"use server";

import { serverEnv } from "@/lib/env.server";
import {
  parseEmail,
  parseNonEmpty,
  parseOrgType,
} from "@/lib/validation";
import { startOrgCreation } from "@/lib/auth-flows";

export interface ActionState {
  ok: boolean;
  message: string | null;
}

/**
 * Begin org creation. Validates inputs, checks the signup waitlist gate, and
 * sends a magic link whose callback will actually create the org (via the
 * security-definer create_org_and_admin flow) once the user authenticates.
 *
 * The org is NOT created here — only after the user proves control of the email
 * by clicking the link. This prevents drive-by org creation with a stranger's
 * address.
 */
export async function requestOrgCreation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!serverEnv.allowOrgSignup) {
    return {
      ok: false,
      message:
        "Die Registrierung ist gerade auf der Warteliste. Schreib uns, wir schalten dich frei.",
    };
  }

  let email: string, orgName: string, orgType: string;
  try {
    orgName = parseNonEmpty(formData.get("orgName"), "Name der Organisation", 120);
    orgType = parseOrgType(formData.get("orgType"));
    email = parseEmail(formData.get("email"));
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  try {
    await startOrgCreation(email, orgName, orgType);
  } catch {
    return {
      ok: false,
      message: "Etwas ist schiefgelaufen. Bitte versuche es später erneut.",
    };
  }

  return {
    ok: true,
    message:
      "Fast geschafft! Wir haben dir einen Bestätigungs-Link geschickt. Klick ihn an, um deine Organisation anzulegen.",
  };
}
