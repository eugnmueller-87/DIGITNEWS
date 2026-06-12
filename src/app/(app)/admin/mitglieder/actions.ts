"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { provisionPerson, removePerson } from "@/lib/auth-flows";
import {
  parseEmail,
  parseNonEmpty,
  parseAssignableRole,
} from "@/lib/validation";

export interface ActionState {
  ok: boolean;
  message: string | null;
}

/**
 * Add a person to the current admin's org. Admins may add MEMBERS only;
 * superadmins (who also pass requireAdmin) may add admins too. Authorization is
 * enforced here AND re-enforced in add_person in the DB (defense in depth).
 *
 * The person's account + profile are created immediately (status 'invited') and
 * a magic login link is emailed.
 */
export async function addPerson(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  let email: string;
  let displayName: string | null;
  let role: "admin" | "member";
  try {
    email = parseEmail(formData.get("email"));
    const rawName = String(formData.get("displayName") ?? "").trim();
    displayName =
      rawName.length > 0 ? parseNonEmpty(rawName, "Name", 80) : null;
    // Only superadmins may add admins.
    role = parseAssignableRole(
      formData.get("role"),
      session.role === "superadmin",
    );
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  try {
    await provisionPerson({
      actorId: session.userId,
      orgId: session.orgId,
      email,
      role,
      displayName,
    });
    // NOTE: we do NOT branch the message on the "already_elsewhere" outcome.
    // Returning a different message for an email that already belongs to another
    // org would be a cross-tenant existence oracle. Both outcomes report the
    // same neutral success.
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("not authorized")) {
      return { ok: false, message: "Dazu bist du nicht berechtigt." };
    }
    return {
      ok: false,
      message: "Konnte die Person nicht hinzufügen. Bitte erneut versuchen.",
    };
  }

  revalidatePath("/admin/mitglieder");
  return {
    ok: true,
    message:
      "Erledigt. Falls die E-Mail nutzbar ist, wurde ein Login-Link verschickt.",
  };
}

/**
 * Remove a person from the org. Admins may remove members only; the last admin
 * of an org cannot be removed. The DB (remove_person) re-checks all of this.
 */
export async function removePersonAction(
  targetUserId: string,
): Promise<ActionState> {
  const session = await requireAdmin();

  try {
    await removePerson(session.userId, targetUserId);
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("last admin")) {
      return {
        ok: false,
        message: "Die letzte Administrator:in kann nicht entfernt werden.",
      };
    }
    if (msg.includes("not authorized") || msg.includes("members only")) {
      return { ok: false, message: "Dazu bist du nicht berechtigt." };
    }
    if (msg.includes("yourself")) {
      return {
        ok: false,
        message: "Du kannst dich hier nicht selbst entfernen.",
      };
    }
    return { ok: false, message: "Konnte die Person nicht entfernen." };
  }

  revalidatePath("/admin/mitglieder");
  return { ok: true, message: "Entfernt." };
}
