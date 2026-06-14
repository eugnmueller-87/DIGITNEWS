import "server-only";

import type { PostImageGate } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGN_TTL_SECONDS = 600; // 10 min, same as everywhere else
const REDACTED_BUCKET = "redacted-photos";
const RAW_BUCKET = "raw-photos";

/** Minimal shape every member-facing post list already has from posts_public. */
export interface SignablePost {
  id: string;
  redacted_image_path: string | null;
}

/**
 * Decide, per post, which image a member sees and mint a short-TTL signed URL
 * for it — returning a Map<postId, url>. This is the SINGLE place the
 * raw-vs-redacted choice lives, so the three member pages (feed, category-feed,
 * rückblick) can't drift.
 *
 * Rule: a member sees the CLEAR original ONLY when BOTH flags are true —
 *   (a) the member opted in       (viewerConsent)
 *   (b) the admin released the post (posts.clear_photo_allowed)
 * Otherwise they get the blurred redacted image, exactly as before.
 *
 * Security (see migration 0020 / 0004):
 *  - source_image_path is REVOKE'd from `authenticated`; the ONLY way a member
 *    reaches the original is this server-minted signed URL, gated on the
 *    server-side AND of the two flags. The client never chooses.
 *  - clear_photo_allowed + source_image_path are NOT in posts_public, so we read
 *    them here via the SERVICE ROLE — which bypasses RLS, hence the MANDATORY
 *    `.eq("org_id", orgId)` scope so org B can never reach org A's originals.
 *  - When the viewer hasn't consented we skip the extra read entirely (the fast
 *    path is byte-for-byte today's behavior: redacted only).
 */
export async function signPostImages(
  posts: readonly SignablePost[],
  orgId: string,
  viewerConsent: boolean,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const admin = createAdminClient();

  // Which posts are eligible for the clear original? Only when the viewer
  // consented — otherwise nobody is, and we never touch raw-photos.
  const gates = new Map<string, PostImageGate>();
  if (viewerConsent) {
    const ids = posts.map((p) => p.id);
    if (ids.length > 0) {
      const { data } = await admin
        .from("posts")
        .select("id, source_image_path, clear_photo_allowed")
        .eq("org_id", orgId) // service role bypasses RLS — org-scope is mandatory
        .in("id", ids);
      for (const g of (data ?? []) as PostImageGate[]) gates.set(g.id, g);
    }
  }

  await Promise.all(
    posts.map(async (p) => {
      const gate = gates.get(p.id);
      const useClear =
        viewerConsent &&
        !!gate?.clear_photo_allowed &&
        !!gate?.source_image_path;

      if (useClear) {
        const { data } = await admin.storage
          .from(RAW_BUCKET)
          .createSignedUrl(gate.source_image_path as string, SIGN_TTL_SECONDS);
        if (data?.signedUrl) {
          urls.set(p.id, data.signedUrl);
          return;
        }
        // Fall through to the redacted image if signing the original failed.
      }

      if (p.redacted_image_path) {
        const { data } = await admin.storage
          .from(REDACTED_BUCKET)
          .createSignedUrl(p.redacted_image_path, SIGN_TTL_SECONDS);
        if (data?.signedUrl) urls.set(p.id, data.signedUrl);
      }
    }),
  );

  return urls;
}
