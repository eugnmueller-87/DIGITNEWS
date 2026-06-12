"use server";

import { requireAdmin } from "@/lib/auth";
import { createRawUploadTarget, startProcessing } from "@/lib/capture";
import { createClient } from "@/lib/supabase/server";

/** Get a signed upload target so the browser can upload the raw image directly. */
export async function getUploadTarget(): Promise<{
  ok: boolean;
  path?: string;
  token?: string;
  message?: string;
}> {
  const session = await requireAdmin();
  try {
    const { path, token } = await createRawUploadTarget(session.orgId);
    return { ok: true, path, token };
  } catch {
    return { ok: false, message: "Upload konnte nicht vorbereitet werden." };
  }
}

/** After the browser uploaded the raw image, create the post + trigger the worker. */
export async function finalizeCapture(sourcePath: string): Promise<{
  ok: boolean;
  triggered?: boolean;
  message?: string;
}> {
  const session = await requireAdmin();

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
    });
    return { ok: true, triggered };
  } catch {
    return {
      ok: false,
      message: "Verarbeitung konnte nicht gestartet werden.",
    };
  }
}
