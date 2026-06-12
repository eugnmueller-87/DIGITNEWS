"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/auth";
import { parseEmail, parseNonEmpty, parseOrgType } from "@/lib/validation";
import {
  createOrg,
  provisionPerson,
  setAdmin,
  deleteOrg,
} from "@/lib/auth-flows";

export interface ActionState {
  ok: boolean;
  message: string | null;
}

/**
 * Superadmin: create an org and its first admin in one step. The org is created
 * via create_org, then the admin is provisioned via provisionPerson(role:admin)
 * — which creates the account and emails a login link. Both DB flows re-check
 * that the actor is a superadmin.
 */
export async function createOrgWithAdmin(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSuperadmin();

  let orgName: string, orgType: string, adminEmail: string;
  let adminName: string | null;
  try {
    orgName = parseNonEmpty(formData.get("orgName"), "Name der Organisation", 120);
    orgType = parseOrgType(formData.get("orgType"));
    adminEmail = parseEmail(formData.get("adminEmail"));
    const rawName = String(formData.get("adminName") ?? "").trim();
    adminName = rawName.length > 0 ? parseNonEmpty(rawName, "Name", 80) : null;
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  let orgId: string;
  try {
    orgId = await createOrg(session.userId, orgName, orgType);
  } catch {
    return { ok: false, message: "Konnte die Organisation nicht anlegen." };
  }

  // Provision the first admin. If the email already belongs to another org (or
  // provisioning fails), roll back the just-created org so we never leave an
  // orphan org with no admin.
  try {
    const outcome = await provisionPerson({
      actorId: session.userId,
      orgId,
      email: adminEmail,
      role: "admin",
      displayName: adminName,
    });
    if (outcome === "already_elsewhere") {
      await deleteOrg(session.userId, orgId).catch(() => {});
      return {
        ok: false,
        message:
          "Diese Admin-E-Mail gehört bereits zu einer Organisation. Bitte eine andere wählen.",
      };
    }
  } catch {
    await deleteOrg(session.userId, orgId).catch(() => {});
    return {
      ok: false,
      message: "Konnte die Admin-Person nicht anlegen. Bitte erneut versuchen.",
    };
  }

  revalidatePath("/operator");
  return {
    ok: true,
    message: "Organisation angelegt. Die Admin-Person hat einen Login-Link erhalten.",
  };
}

/** Superadmin: grant or revoke admin rights for a target user. */
export async function setAdminAction(
  targetUserId: string,
  makeAdmin: boolean,
): Promise<ActionState> {
  const session = await requireSuperadmin();
  try {
    await setAdmin(session.userId, targetUserId, makeAdmin);
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("last admin")) {
      return {
        ok: false,
        message: "Die letzte Administrator:in kann nicht herabgestuft werden.",
      };
    }
    return { ok: false, message: "Konnte die Rolle nicht ändern." };
  }
  revalidatePath("/operator");
  return { ok: true, message: makeAdmin ? "Admin-Rechte erteilt." : "Admin-Rechte entzogen." };
}
