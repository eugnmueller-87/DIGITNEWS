"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import type { ContentType } from "@/lib/content/types";
import { CONTENT_TYPES } from "@/lib/content/types";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ReviewActionState {
  ok: boolean;
  message: string | null;
}

const isContentType = (v: string): v is ContentType =>
  (CONTENT_TYPES as readonly string[]).includes(v);

/**
 * Publish a draft. The admin confirms the content_type (defaulting to the LLM
 * suggestion), edits title/body, and publishes. publish_post sets the CONFIRMED
 * content_type, flips status to published, and confirms pending events. Authz:
 * requireAdmin here + publish_post re-checks org+role; the draft is fetched via
 * the admin client but scoped to the session org below.
 */
export async function publishDraft(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const session = await requireAdmin();
  const postId = String(formData.get("postId") ?? "");
  const contentType = String(formData.get("contentType") ?? "");
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 120);
  const body = String(formData.get("body") ?? "")
    .trim()
    .slice(0, 4000);

  if (!isContentType(contentType)) {
    return { ok: false, message: "Bitte wähle eine Art." };
  }
  if (!title) {
    return { ok: false, message: "Titel darf nicht leer sein." };
  }

  const admin = createAdminClient();
  // Confirm the draft belongs to the admin's org before acting.
  const { data: post } = await admin
    .from("posts")
    .select("id, org_id, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.org_id !== session.orgId) {
    return { ok: false, message: "Entwurf nicht gefunden." };
  }

  const { error } = await admin.rpc("publish_post", {
    p_actor_id: session.userId,
    p_post_id: postId,
    p_content_type: contentType,
    p_title: title,
    p_body: body,
  });
  if (error) {
    return { ok: false, message: "Veröffentlichen fehlgeschlagen." };
  }

  revalidatePath("/review");
  revalidatePath("/feed");
  return { ok: true, message: "Veröffentlicht." };
}

/** Discard a draft (archived, not published). */
export async function discardDraft(postId: string): Promise<ReviewActionState> {
  const session = await requireAdmin();
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("org_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.org_id !== session.orgId) {
    return { ok: false, message: "Entwurf nicht gefunden." };
  }
  const { error } = await admin.rpc("discard_post", {
    p_actor_id: session.userId,
    p_post_id: postId,
  });
  if (error) return { ok: false, message: "Verwerfen fehlgeschlagen." };
  revalidatePath("/review");
  return { ok: true, message: "Verworfen." };
}
