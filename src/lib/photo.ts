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

  // Decide which bucket + path each post needs, then sign in BATCHES (one
  // createSignedUrls call per bucket — at most 2 round-trips total) instead of
  // one createSignedUrl per post (N+1). Map each path back to its post id(s).
  const rawPaths: string[] = [];
  const redactedPaths: string[] = [];
  const rawByPath = new Map<string, string[]>(); // path -> post ids
  const redactedByPath = new Map<string, string[]>();

  for (const p of posts) {
    const gate = gates.get(p.id);
    const useClear =
      viewerConsent && !!gate?.clear_photo_allowed && !!gate?.source_image_path;

    if (useClear) {
      const path = gate.source_image_path as string;
      if (!rawByPath.has(path)) rawPaths.push(path);
      (rawByPath.get(path) ?? rawByPath.set(path, []).get(path)!).push(p.id);
    } else if (p.redacted_image_path) {
      const path = p.redacted_image_path;
      if (!redactedByPath.has(path)) redactedPaths.push(path);
      (
        redactedByPath.get(path) ?? redactedByPath.set(path, []).get(path)!
      ).push(p.id);
    }
  }

  const signBatch = async (
    bucket: string,
    paths: string[],
    byPath: Map<string, string[]>,
  ) => {
    if (paths.length === 0) return;
    const { data } = await admin.storage
      .from(bucket)
      .createSignedUrls(paths, SIGN_TTL_SECONDS);
    for (const row of data ?? []) {
      if (!row.signedUrl || !row.path) continue;
      for (const id of byPath.get(row.path) ?? []) urls.set(id, row.signedUrl);
    }
  };

  // Two independent batches (raw + redacted) run concurrently.
  await Promise.all([
    signBatch(RAW_BUCKET, rawPaths, rawByPath),
    signBatch(REDACTED_BUCKET, redactedPaths, redactedByPath),
  ]);

  // Fallback: if signing a post's RAW original failed, fall back to its redacted
  // image (preserves the prior behavior). Sign these stragglers in one more batch.
  const fallbackPaths: string[] = [];
  const fallbackByPath = new Map<string, string[]>();
  for (const p of posts) {
    if (
      !urls.has(p.id) &&
      p.redacted_image_path &&
      !redactedByPath.has(p.redacted_image_path)
    ) {
      const path = p.redacted_image_path;
      if (!fallbackByPath.has(path)) fallbackPaths.push(path);
      (
        fallbackByPath.get(path) ?? fallbackByPath.set(path, []).get(path)!
      ).push(p.id);
    }
  }
  await signBatch(REDACTED_BUCKET, fallbackPaths, fallbackByPath);

  return urls;
}
