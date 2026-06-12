"use server";

import { revalidatePath } from "next/cache";

import {
  createJoinCode,
  approveApplication,
  rejectApplication,
} from "@/lib/applications";
import { requireAdmin } from "@/lib/auth";

export interface QrActionState {
  ok: boolean;
  message: string | null;
}

/** Admin: create a join code (QR) for their org. */
export async function createJoinCodeAction(): Promise<QrActionState> {
  const session = await requireAdmin();
  try {
    await createJoinCode(session.userId, session.orgId, null);
  } catch {
    return { ok: false, message: "Konnte QR-Code nicht erstellen." };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: "QR-Code erstellt." };
}

/**
 * Admin: approve a verified application. The DB purges child data and returns
 * the email; we then provision the parent as a member (+ login link). Three
 * layers of authz: requireAdmin here, approve_application re-checks org+role,
 * and the queue we read is RLS-scoped to the admin's org.
 */
export async function approveApplicationAction(
  appId: string,
): Promise<QrActionState> {
  const session = await requireAdmin();
  try {
    await approveApplication(session.userId, appId, session.orgId);
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("not verified")) {
      return { ok: false, message: "Anfrage ist noch nicht bestätigt." };
    }
    if (msg.includes("already belongs")) {
      return {
        ok: false,
        message: "Diese Person gehört bereits zu einer Organisation.",
      };
    }
    return { ok: false, message: "Freigabe fehlgeschlagen." };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: "Freigegeben. Login-Link verschickt." };
}

/** Admin: reject an application (purges child data). */
export async function rejectApplicationAction(
  appId: string,
): Promise<QrActionState> {
  const session = await requireAdmin();
  try {
    await rejectApplication(session.userId, appId);
  } catch {
    return { ok: false, message: "Ablehnen fehlgeschlagen." };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: "Anfrage abgelehnt." };
}
