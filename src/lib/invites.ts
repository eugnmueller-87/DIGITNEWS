import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface InvitePreview {
  valid: boolean;
  orgName: string | null;
  requiresApproval: boolean;
  reason?: "not_found" | "expired" | "exhausted";
}

/**
 * Server-side invite preview for the /join/[code] page. Uses the service role
 * (the invites table has no public read policy by design — codes must not be
 * enumerable through the API). Returns only the minimum needed to render the
 * join form: org name and whether approval is required. Never leaks internal
 * ids or counts.
 */
export async function previewInvite(code: string): Promise<InvitePreview> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("invites")
    .select(
      "requires_approval, max_uses, use_count, expires_at, orgs(name)",
    )
    .eq("code", code)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, orgName: null, requiresApproval: true, reason: "not_found" };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, orgName: null, requiresApproval: true, reason: "expired" };
  }
  if (data.max_uses !== null && data.use_count >= data.max_uses) {
    return { valid: false, orgName: null, requiresApproval: true, reason: "exhausted" };
  }

  // Supabase returns the joined relation; shape it defensively.
  const org = Array.isArray(data.orgs) ? data.orgs[0] : data.orgs;

  return {
    valid: true,
    orgName: org?.name ?? null,
    requiresApproval: data.requires_approval,
  };
}
