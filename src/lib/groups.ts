import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Org group management + person group/role assignment (admin-scoped flows). */

export async function createGroup(
  actorId: string,
  orgId: string,
  name: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("create_group", {
    p_actor_id: actorId,
    p_org_id: orgId,
    p_name: name,
  });
  if (error) throw new Error(error.message || "Konnte Gruppe nicht anlegen.");
}

export async function renameGroup(
  actorId: string,
  groupId: string,
  name: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("rename_group", {
    p_actor_id: actorId,
    p_group_id: groupId,
    p_name: name,
  });
  if (error)
    throw new Error(error.message || "Konnte Gruppe nicht umbenennen.");
}

export async function deleteGroup(
  actorId: string,
  groupId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_group", {
    p_actor_id: actorId,
    p_group_id: groupId,
  });
  if (error) throw new Error(error.message || "Konnte Gruppe nicht löschen.");
}

export async function assignGroup(
  actorId: string,
  targetUserId: string,
  groupId: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("assign_group", {
    p_actor_id: actorId,
    p_target_user_id: targetUserId,
    p_group_id: groupId,
  });
  if (error) throw new Error(error.message || "Konnte Gruppe nicht zuweisen.");
}

/** An org admin promotes/demotes a member in their own org (member <-> admin). */
export async function setMemberRole(
  actorId: string,
  targetUserId: string,
  makeAdmin: boolean,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_member_role", {
    p_actor_id: actorId,
    p_target_user_id: targetUserId,
    p_make_admin: makeAdmin,
  });
  if (error) throw new Error(error.message || "Konnte Rolle nicht ändern.");
}
