"use server";

import { requireAdmin } from "@/lib/auth";
import {
  createRawUploadTarget,
  startProcessing,
  DuplicateImageError,
} from "@/lib/capture";
import { getDict } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/** Get a signed upload target so the browser can upload the raw image directly. */
export async function getUploadTarget(): Promise<{
  ok: boolean;
  path?: string;
  token?: string;
  message?: string;
}> {
  const session = await requireAdmin();
  const dict = await getDict();
  try {
    const { path, token } = await createRawUploadTarget(session.orgId);
    return { ok: true, path, token };
  } catch {
    return { ok: false, message: dict.actions.uploadPrepFailed };
  }
}

/**
 * After the browser uploaded the raw image, create the post + trigger the
 * worker. `sourceHash` is the SHA-256 of the uploaded bytes (hex); the server
 * uses it to reject an exact-duplicate capture for the org. `duplicate` is set
 * when this image was already captured, so the UI can say so specifically.
 */
export async function finalizeCapture(
  sourcePath: string,
  sourceHash?: string,
): Promise<{
  ok: boolean;
  triggered?: boolean;
  duplicate?: boolean;
  message?: string;
}> {
  const session = await requireAdmin();
  const dict = await getDict();

  // Resolve the org_type for the worker prompt hint.
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("org_type")
    .eq("id", session.orgId)
    .maybeSingle();

  try {
    const { triggered } = await startProcessing({
      actorId: session.userId,
      orgId: session.orgId,
      orgType: org?.org_type ?? "sonstiges",
      sourcePath,
      sourceHash,
    });
    return { ok: true, triggered };
  } catch (e) {
    if (e instanceof DuplicateImageError) {
      return {
        ok: false,
        duplicate: true,
        message: dict.actions.duplicatePhoto,
      };
    }
    return {
      ok: false,
      message: dict.actions.processingStartFailed,
    };
  }
}
