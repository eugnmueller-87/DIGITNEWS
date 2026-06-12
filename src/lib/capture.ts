import "server-only";

import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Capture server flows. The admin uploads a raw photo; we create a processing
 * post, then trigger the VPS worker with a short-TTL signed URL of the raw image.
 * The worker OCRs, redacts, and calls back to write the draft.
 */

/**
 * Create a signed UPLOAD URL so the browser can put the raw image straight into
 * the private raw-photos bucket at <org>/<random>.jpg. Returns the path + token.
 */
export async function createRawUploadTarget(
  orgId: string,
): Promise<{ path: string; token: string }> {
  const admin = createAdminClient();
  // Random object name; the post id isn't known until after upload, so use a
  // random key and store it as source_image_path on the post.
  const key = `${orgId}/${crypto.randomUUID()}.jpg`;
  const { data, error } = await admin.storage
    .from("raw-photos")
    .createSignedUploadUrl(key);
  if (error || !data) throw new Error("Konnte Upload nicht vorbereiten.");
  return { path: key, token: data.token };
}

/**
 * After the browser uploaded the raw image, create the processing post and
 * trigger the worker. Returns the post id. If the worker isn't configured, the
 * post stays 'processing' (no-op trigger) — surfaced to the admin.
 */
export async function startProcessing(params: {
  actorId: string;
  orgId: string;
  orgType: string;
  sourcePath: string;
}): Promise<{ postId: string; triggered: boolean }> {
  const admin = createAdminClient();

  const { data: postId, error } = await admin.rpc("create_processing_post", {
    p_actor_id: params.actorId,
    p_org_id: params.orgId,
    p_source_path: params.sourcePath,
  });
  if (error || !postId) {
    throw new Error(error?.message || "Konnte Aufnahme nicht anlegen.");
  }

  const triggered = await triggerWorker(String(postId), params);
  return { postId: String(postId), triggered };
}

/** Trigger the worker with a short-TTL signed read URL of the raw image. */
async function triggerWorker(
  postId: string,
  params: { orgId: string; orgType: string; sourcePath: string },
): Promise<boolean> {
  if (!serverEnv.workerUrl || !serverEnv.workerSharedSecret) {
    // No worker configured — leave the post in 'processing'. The admin can retry
    // once the worker is deployed.
    return false;
  }

  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from("raw-photos")
    .createSignedUrl(params.sourcePath, 600); // 10 min
  if (!signed?.signedUrl) return false;

  const captureDate = new Date().toISOString().slice(0, 10);

  try {
    const res = await fetch(
      `${serverEnv.workerUrl.replace(/\/$/, "")}/process`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Secret": serverEnv.workerSharedSecret,
        },
        body: JSON.stringify({
          post_id: postId,
          org_id: params.orgId,
          image_url: signed.signedUrl,
          org_type: params.orgType,
          capture_date: captureDate,
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
