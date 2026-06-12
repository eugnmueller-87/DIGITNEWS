import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Worker callback. The VPS worker POSTs here when a job finishes:
 *   - success: multipart with the redacted image + draft fields → upload the
 *     image to the redacted-photos bucket and call worker_write_draft.
 *   - failure: form with failed=1 + reason → call worker_mark_failed.
 *
 * Authenticated by the shared secret in X-Worker-Secret (constant-time compare).
 * No session — this is a server-to-server call. Everything is written via the
 * service role through the security-definer flows.
 */
export async function POST(request: NextRequest) {
  // --- Auth: constant-time shared-secret check ---
  const provided = request.headers.get("x-worker-secret") ?? "";
  const expected = serverEnv.workerSharedSecret ?? "";
  if (!expected || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const postId = String(form.get("post_id") ?? "");
  if (!isUuid(postId)) {
    return NextResponse.json({ error: "bad post_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- Failure path ---
  if (form.get("failed") === "1") {
    const reason = String(form.get("reason") ?? "unknown").slice(0, 200);
    const { error } = await admin.rpc("worker_mark_failed", {
      p_post_id: postId,
      p_reason: reason,
    });
    if (error) {
      return NextResponse.json({ error: "rpc" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // --- Success path: upload redacted image, then write the draft ---
  const orgId = String(form.get("org_id") ?? "");
  const image = form.get("redacted_image");
  let redactedPath: string | null = null;

  if (image instanceof File && isUuid(orgId)) {
    const path = `${orgId}/${postId}.jpg`;
    const bytes = new Uint8Array(await image.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("redacted-photos")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (!upErr) redactedPath = path;
  }

  const { error } = await admin.rpc("worker_write_draft", {
    p_post_id: postId,
    p_redacted_path: redactedPath,
    p_ocr_raw: String(form.get("ocr_text_raw") ?? ""),
    p_ocr_redacted: String(form.get("ocr_text_redacted") ?? ""),
    p_redactions: parseJson(form.get("redactions")),
    p_extraction: parseJson(form.get("extraction")),
    p_title: String(form.get("title") ?? "").slice(0, 120),
    p_body: String(form.get("summary") ?? "").slice(0, 4000),
    p_content_type_suggested: String(form.get("content_type_suggested") ?? "info"),
    p_health_severity: null,
  });
  if (error) {
    return NextResponse.json({ error: "rpc" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function parseJson(v: FormDataEntryValue | null): unknown {
  try {
    return v ? JSON.parse(String(v)) : null;
  } catch {
    return null;
  }
}
