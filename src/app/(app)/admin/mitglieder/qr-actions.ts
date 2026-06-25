"use server";

import { revalidatePath } from "next/cache";

import {
  createJoinCode,
  approveApplication,
  rejectApplication,
  resendApplicationVerification,
} from "@/lib/applications";
import { requireAdmin } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";

export interface QrActionState {
  ok: boolean;
  message: string | null;
}

/** Admin: create a join code (QR) for their org. */
export async function createJoinCodeAction(): Promise<QrActionState> {
  const session = await requireAdmin();
  const dict = await getDict();
  try {
    await createJoinCode(session.userId, session.orgId, null);
  } catch {
    return { ok: false, message: dict.actions.qrCreateFailed };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: dict.actions.qrCreated };
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
  const dict = await getDict();
  try {
    await approveApplication(session.userId, appId, session.orgId);
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("not verified")) {
      return { ok: false, message: dict.actions.requestNotVerified };
    }
    if (msg.includes("already belongs")) {
      return {
        ok: false,
        message: dict.actions.alreadyInOrg,
      };
    }
    return { ok: false, message: dict.actions.approveFailed };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: dict.actions.approved };
}

/**
 * Admin: re-send the verification email for a pending application (e.g. the
 * original landed in spam or expired). Mints a fresh 24h token; the RPC
 * re-checks org+role and that the application is still pending.
 */
export async function resendVerificationAction(
  appId: string,
): Promise<QrActionState> {
  const session = await requireAdmin();
  const dict = await getDict();
  try {
    await resendApplicationVerification(session.userId, appId);
  } catch {
    return { ok: false, message: dict.actions.resendFailed };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: dict.actions.resent };
}

/** Admin: reject an application (purges child data). */
export async function rejectApplicationAction(
  appId: string,
): Promise<QrActionState> {
  const session = await requireAdmin();
  const dict = await getDict();
  try {
    await rejectApplication(session.userId, appId);
  } catch {
    return { ok: false, message: dict.actions.rejectFailed };
  }
  revalidatePath("/admin/mitglieder");
  return { ok: true, message: dict.actions.rejected };
}
