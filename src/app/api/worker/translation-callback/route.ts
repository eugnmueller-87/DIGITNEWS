import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Worker translation callback. The VPS worker POSTs here when a publish-time
 * translation job finishes:
 *   - `translations`: JSON object keyed by locale → {title, body, payload?}
 *   - `event_titles`: JSON object keyed by locale → {<event_id>: title}
 *
 * Written via the service role through write_post_translations (security-definer,
 * org-pinned from the post). Authenticated by the shared secret in X-Worker-Secret
 * (constant-time compare). No session — server-to-server. Best-effort: a job that
 * produced nothing simply doesn't call back, and a missing translation row makes
 * read sites fall back to the German original.
 */
export async function POST(request: NextRequest) {
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

  const translations = parseJson(form.get("translations")) ?? {};
  const eventTitles = parseJson(form.get("event_titles")) ?? {};

  const admin = createAdminClient();
  const { error } = await admin.rpc("write_post_translations", {
    p_post_id: postId,
    p_translations: translations,
    p_event_titles: eventTitles,
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

function parseJson(v: FormDataEntryValue | null): Record<string, unknown> | null {
  try {
    const parsed = v ? JSON.parse(String(v)) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
