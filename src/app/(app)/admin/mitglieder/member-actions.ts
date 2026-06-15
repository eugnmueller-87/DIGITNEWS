"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import {
  createGroup,
  renameGroup,
  deleteGroup,
  assignGroup,
  setMemberRole,
} from "@/lib/groups";
import { getDict } from "@/lib/i18n/server";
import { parseNonEmpty } from "@/lib/validation";

export interface MemberActionState {
  ok: boolean;
  message: string | null;
}

/** Admin: create a group in their org. */
export async function createGroupAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const session = await requireAdmin();
  const dict = await getDict();
  let name: string;
  try {
    name = parseNonEmpty(formData.get("name"), "Gruppenname", 80);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  try {
    await createGroup(session.userId, session.orgId, name);
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, message: dict.actions.groupExists };
    }
    return { ok: false, message: dict.actions.groupCreateFailed };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: dict.actions.groupCreated };
}

/** Admin: rename a group. */
export async function renameGroupAction(
  groupId: string,
  name: string,
): Promise<MemberActionState> {
  const session = await requireAdmin();
  const dict = await getDict();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: dict.actions.nameEmpty };
  try {
    await renameGroup(session.userId, groupId, trimmed.slice(0, 80));
  } catch {
    return { ok: false, message: dict.actions.groupRenameFailed };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: dict.actions.groupRenamed };
}

/** Admin: delete a group (members in it are simply un-grouped). */
export async function deleteGroupAction(
  groupId: string,
): Promise<MemberActionState> {
  const session = await requireAdmin();
  const dict = await getDict();
  try {
    await deleteGroup(session.userId, groupId);
  } catch {
    return { ok: false, message: dict.actions.groupDeleteFailed };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: dict.actions.groupDeleted };
}

/** Admin: assign a person to a group (or clear with empty string). */
export async function assignGroupAction(
  targetUserId: string,
  groupId: string,
): Promise<MemberActionState> {
  const session = await requireAdmin();
  const dict = await getDict();
  try {
    await assignGroup(session.userId, targetUserId, groupId || null);
  } catch {
    return { ok: false, message: dict.actions.groupAssignFailed };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: dict.actions.groupAssigned };
}

/** Admin: promote/demote a member in their own org. */
export async function setMemberRoleAction(
  targetUserId: string,
  makeAdmin: boolean,
): Promise<MemberActionState> {
  const session = await requireAdmin();
  const dict = await getDict();
  try {
    await setMemberRole(session.userId, targetUserId, makeAdmin);
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("last admin")) {
      return {
        ok: false,
        message: dict.actions.lastAdminDemote,
      };
    }
    if (msg.includes("own role")) {
      return {
        ok: false,
        message: dict.actions.selfRoleChange,
      };
    }
    return { ok: false, message: dict.actions.roleChangeFailed };
  }
  revalidatePath("/admin/mitglieder");
  return {
    ok: true,
    message: makeAdmin ? "Zur Admin gemacht." : "Zu Mitglied gemacht.",
  };
}
