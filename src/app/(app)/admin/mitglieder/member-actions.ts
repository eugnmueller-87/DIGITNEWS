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
      return { ok: false, message: "Diese Gruppe gibt es schon." };
    }
    return { ok: false, message: "Konnte Gruppe nicht anlegen." };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: "Gruppe angelegt." };
}

/** Admin: rename a group. */
export async function renameGroupAction(
  groupId: string,
  name: string,
): Promise<MemberActionState> {
  const session = await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name darf nicht leer sein." };
  try {
    await renameGroup(session.userId, groupId, trimmed.slice(0, 80));
  } catch {
    return { ok: false, message: "Konnte Gruppe nicht umbenennen." };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: "Umbenannt." };
}

/** Admin: delete a group (members in it are simply un-grouped). */
export async function deleteGroupAction(
  groupId: string,
): Promise<MemberActionState> {
  const session = await requireAdmin();
  try {
    await deleteGroup(session.userId, groupId);
  } catch {
    return { ok: false, message: "Konnte Gruppe nicht löschen." };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: "Gelöscht." };
}

/** Admin: assign a person to a group (or clear with empty string). */
export async function assignGroupAction(
  targetUserId: string,
  groupId: string,
): Promise<MemberActionState> {
  const session = await requireAdmin();
  try {
    await assignGroup(session.userId, targetUserId, groupId || null);
  } catch {
    return { ok: false, message: "Konnte Gruppe nicht zuweisen." };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: "Gruppe zugewiesen." };
}

/** Admin: promote/demote a member in their own org. */
export async function setMemberRoleAction(
  targetUserId: string,
  makeAdmin: boolean,
): Promise<MemberActionState> {
  const session = await requireAdmin();
  try {
    await setMemberRole(session.userId, targetUserId, makeAdmin);
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("last admin")) {
      return {
        ok: false,
        message: "Die letzte Administrator:in kann nicht herabgestuft werden.",
      };
    }
    if (msg.includes("own role")) {
      return {
        ok: false,
        message: "Du kannst deine eigene Rolle nicht ändern.",
      };
    }
    return { ok: false, message: "Konnte Rolle nicht ändern." };
  }
  revalidatePath("/admin/mitglieder");
  return {
    ok: true,
    message: makeAdmin ? "Zur Admin gemacht." : "Zu Mitglied gemacht.",
  };
}
