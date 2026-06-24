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
/** Raised when the same image bytes were already captured for this org. */
export class DuplicateImageError extends Error {
  constructor() {
    super("duplicate_image");
    this.name = "DuplicateImageError";
  }
}

export async function startProcessing(params: {
  actorId: string;
  orgId: string;
  orgType: string;
  sourcePath: string;
  sourceHash?: string | null;
  // Set when the admin confirmed "upload anyway" on a detected duplicate: the
  // RPC then skips the exact-photo dedup and stores a NULL hash.
  allowDuplicate?: boolean;
}): Promise<{ postId: string; triggered: boolean }> {
  const admin = createAdminClient();

  const { data: postId, error } = await admin.rpc("create_processing_post", {
    p_actor_id: params.actorId,
    p_org_id: params.orgId,
    p_source_path: params.sourcePath,
    p_source_hash: params.sourceHash ?? null,
    p_allow_duplicate: params.allowDuplicate ?? false,
  });
  if (error || !postId) {
    // The RPC raises 'duplicate_image' (and the partial unique index is the
    // race backstop, surfacing as a unique-violation 23505) when this exact
    // image was already captured for the org. Map both to a typed error so the
    // action can show a friendly "already posted" message instead of a generic
    // failure.
    if (
      error?.message?.includes("duplicate_image") ||
      error?.code === "23505"
    ) {
      throw new DuplicateImageError();
    }
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

/**
 * Trigger publish-time translation of a post's member-visible content. Fire-and-
 * forget: the worker translates into en+ru (Mistral/EU, on the already-redacted,
 * member-safe text we send) and calls back to /api/worker/translation-callback,
 * which writes the rows. Best-effort — a missing translation makes read sites fall
 * back to the German original, so this never blocks or fails the publish.
 *
 * Only member-safe content is sent: the final published title/body, the structured
 * `payload` (the same data members read), and the just-created event titles. Never
 * raw OCR, never the source image.
 */
export async function triggerTranslation(params: {
  postId: string;
  orgId: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  events: { id: string; title: string }[];
  locales?: string[];
}): Promise<boolean> {
  if (!serverEnv.workerUrl || !serverEnv.workerSharedSecret) return false;

  // Hard timeout so a slow/unreachable worker can NEVER hang the caller. The
  // worker returns a fast 200 ack and translates in the background, so a few
  // seconds is plenty; if it doesn't ack in time we give up (best-effort — the
  // post is already published; read sites fall back to German).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `${serverEnv.workerUrl.replace(/\/$/, "")}/translate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Secret": serverEnv.workerSharedSecret,
        },
        body: JSON.stringify({
          post_id: params.postId,
          org_id: params.orgId,
          title: params.title,
          body: params.body,
          payload: params.payload,
          events: params.events,
          locales: params.locales ?? ["en", "ru"],
        }),
        signal: controller.signal,
      },
    );
    return res.ok;
  } catch {
    // Includes the AbortError on timeout — treated as a best-effort miss.
    return false;
  } finally {
    clearTimeout(timer);
  }
}
