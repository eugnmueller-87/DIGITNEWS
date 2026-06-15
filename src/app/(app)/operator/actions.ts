"use server";

import { revalidatePath } from "next/cache";

import { requireSuperadmin } from "@/lib/auth";
import {
  createOrg,
  provisionPerson,
  setAdmin,
  deleteOrg,
} from "@/lib/auth-flows";
import { getDict } from "@/lib/i18n/server";
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
  const dict = await getDict();

  let orgName: string, adminEmail: string;
  let adminName: string | null;
  let role: "admin" | "member";
  try {
    orgName = parseNonEmpty(
      formData.get("orgName"),
      "Name der Organisation",
      120,
    );
    adminEmail = parseEmail(formData.get("adminEmail"));
    const rawName = String(formData.get("adminName") ?? "").trim();
    adminName = rawName.length > 0 ? parseNonEmpty(rawName, "Name", 80) : null;
    // Superadmin creating an org may set the first person as admin or member.
    role = parseAssignableRole(formData.get("role"), true);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  let orgId: string;
  try {
    // Every org is a Kita in v1 — org_type hardcoded.
    orgId = await createOrg(session.userId, orgName, "kita");
  } catch {
    return { ok: false, message: dict.actions.orgCreateFailed };
  }

  // Provision the first person. If the email already belongs to another org (or
  // provisioning fails), roll back the just-created org so we never leave an
  // orphan org. If the chosen role is 'member', the org has no admin yet — the
  // superadmin can promote someone later, so we allow it.
  try {
    const { outcome } = await provisionPerson({
      actorId: session.userId,
      orgId,
      email: adminEmail,
      role,
      displayName: adminName,
    });
    if (outcome === "already_elsewhere") {
      await deleteOrg(session.userId, orgId).catch(() => {});
      return {
        ok: false,
        message: dict.actions.orgEmailInUse,
      };
    }
  } catch {
    await deleteOrg(session.userId, orgId).catch(() => {});
    return {
      ok: false,
      message: dict.actions.orgPersonFailed,
    };
  }

  revalidatePath("/operator");
  return {
    ok: true,
    message: dict.actions.orgCreated,
  };
}

/** Superadmin: grant or revoke admin rights for a target user. */
export async function setAdminAction(
  targetUserId: string,
  makeAdmin: boolean,
): Promise<ActionState> {
  const session = await requireSuperadmin();
  const dict = await getDict();
  try {
    await setAdmin(session.userId, targetUserId, makeAdmin);
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("last admin")) {
      return {
        ok: false,
        message: dict.actions.lastAdminDemote,
      };
    }
    return { ok: false, message: dict.actions.roleChangeFailedOrg };
  }
  revalidatePath("/operator");
  return {
    ok: true,
    message: makeAdmin ? "Admin-Rechte erteilt." : "Admin-Rechte entzogen.",
  };
}
