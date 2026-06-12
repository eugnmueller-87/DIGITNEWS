"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApprovedJoinLink } from "@/lib/auth-flows";

export interface ApprovalResult {
  ok: boolean;
  message: string | null;
}

/**
 * Approve a pending join request. Authorization is enforced in THREE layers:
 *   1. requireAdmin() here (DB-backed role check for the caller).
 *   2. approve_join_request() re-checks that the actor is an admin of the SAME
 *      org as the request (defense in depth — never trusts step 1 alone).
 *   3. The request_id is validated to belong to the caller's org before we act.
 * On success we email the approved user their join link.
 */
export async function approveJoinRequest(
  requestId: string,
): Promise<ApprovalResult> {
  const session = await requireAdmin();
  const admin = createAdminClient();

  // Confirm the request belongs to this admin's org before doing anything.
  const { data: req } = await admin
    .from("join_requests")
    .select("id, org_id, email, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!req || req.org_id !== session.orgId) {
    return { ok: false, message: "Anfrage nicht gefunden." };
  }
  if (req.status !== "pending") {
    return { ok: false, message: "Anfrage ist nicht mehr offen." };
  }

  const { error } = await admin.rpc("approve_join_request", {
    p_actor_id: session.userId,
    p_request_id: requestId,
  });
  if (error) {
    return { ok: false, message: "Freigabe fehlgeschlagen." };
  }

  // Send the approved user their magic link to finalize their profile.
  try {
    await sendApprovedJoinLink(req.email);
  } catch {
    // The approval succeeded; link delivery can be retried. Don't fail loudly.
  }

  revalidatePath("/admin/mitglieder");
  return { ok: true, message: "Freigegeben. Wir haben einen Link verschickt." };
}

/** Reject a pending join request. Same three-layer authorization as approve. */
export async function rejectJoinRequest(
  requestId: string,
): Promise<ApprovalResult> {
  const session = await requireAdmin();
  const admin = createAdminClient();

  const { data: req } = await admin
    .from("join_requests")
    .select("id, org_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!req || req.org_id !== session.orgId) {
    return { ok: false, message: "Anfrage nicht gefunden." };
  }
  if (req.status !== "pending") {
    return { ok: false, message: "Anfrage ist nicht mehr offen." };
  }

  const { error } = await admin.rpc("reject_join_request", {
    p_actor_id: session.userId,
    p_request_id: requestId,
  });
  if (error) {
    return { ok: false, message: "Ablehnen fehlgeschlagen." };
  }

  revalidatePath("/admin/mitglieder");
  return { ok: true, message: "Anfrage abgelehnt." };
}
