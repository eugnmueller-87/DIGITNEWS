"use server";

import { submitApplication } from "@/lib/applications";
import { getDict } from "@/lib/i18n/server";
import { parseEmail, parseNonEmpty, parseJoinCode } from "@/lib/validation";

export interface ActionState {
  ok: boolean;
  message: string | null;
}

/**
 * Public application submit. Validates inputs, then records the request (hashed
 * verify token) and emails the verification link. The response is NEUTRAL —
 * always the same success message whether or not this email already applied, so
 * the public form is not an enumeration oracle.
 *
 * PRIVACY: child_name + group are stored only on the pending application and are
 * purged once the admin decides (see migration 0009). They are not collected
 * for any purpose beyond that decision.
 */
export async function submitApply(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const dict = await getDict();
  let code: string;
  let email: string;
  let parentName: string;
  let group: string;
  let childName: string;
  try {
    code = parseJoinCode(String(formData.get("code") ?? ""));
    parentName = parseNonEmpty(formData.get("parentName"), "Name", 120);
    group = parseNonEmpty(formData.get("group"), "Gruppe", 80);
    childName = parseNonEmpty(
      formData.get("childName"),
      "Name des Kindes",
      120,
    );
    email = parseEmail(formData.get("email"));
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  try {
    await submitApplication({ code, email, parentName, group, childName });
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("rate limited")) {
      return {
        ok: false,
        message:
          "Gerade sind zu viele Anfragen eingegangen. Bitte versuche es in einer Stunde erneut.",
      };
    }
    if (msg.includes("invalid")) {
      return {
        ok: false,
        message: dict.actions.applyCodeInvalid,
      };
    }
    return {
      ok: false,
      message: dict.actions.applyError,
    };
  }

  return {
    ok: true,
    message:
      "Fast geschafft! Wir haben dir einen Bestätigungs-Link per E-Mail geschickt. Klicke ihn an, um deine Anfrage abzuschließen.",
  };
}
