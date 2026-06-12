"use server";

import { parseEmail, parseInviteCode } from "@/lib/validation";
import { previewInvite } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { startInviteRedemption } from "@/lib/auth-flows";

export interface ActionState {
  ok: boolean;
  message: string | null;
  /** True when we created a pending join request awaiting admin approval. */
  pendingApproval?: boolean;
}

/**
 * Member join. Two branches based on the invite:
 *   - requires_approval = false: send a magic link that redeems the invite and
 *     creates the member profile on click.
 *   - requires_approval = true: record a pending join_request (via the security-
 *     definer request_join flow); the admin approves later, which triggers a
 *     link to the member.
 *
 * We re-validate the invite here server-side; the page's preview is advisory.
 */
export async function submitJoin(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let code: string, email: string;
  try {
    code = parseInviteCode(String(formData.get("code") ?? ""));
    email = parseEmail(formData.get("email"));
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const preview = await previewInvite(code);
  if (!preview.valid) {
    // One neutral message for every invalid state (no enumeration oracle).
    return {
      ok: false,
      message:
        "Dieser Einladungslink ist ungültig oder nicht mehr aktiv. Bitte frag deine Organisation nach einem aktuellen Link.",
    };
  }

  try {
    if (preview.requiresApproval) {
      // Record the pending request via the security-definer flow.
      const admin = createAdminClient();
      const { error } = await admin.rpc("request_join", {
        p_code: code,
        p_email: email,
      });
      if (error) throw error;
      return {
        ok: true,
        pendingApproval: true,
        message:
          "Danke! Deine Anfrage wartet auf Freigabe durch die Organisation. Du bekommst eine E-Mail, sobald du freigeschaltet bist.",
      };
    }

    // No approval needed: send the redemption link directly.
    await startInviteRedemption(email, code);
    return {
      ok: true,
      message:
        "Wir haben dir einen Login-Link geschickt. Klick ihn an, um beizutreten.",
    };
  } catch {
    return {
      ok: false,
      message: "Etwas ist schiefgelaufen. Bitte versuche es später erneut.",
    };
  }
}
