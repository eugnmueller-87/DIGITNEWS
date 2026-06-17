"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { triggerTranslation } from "@/lib/capture";
import { CONTENT_TYPES } from "@/lib/content/types";
import type { ContentType } from "@/lib/content/types";
import { sendEmail } from "@/lib/email/client";
import { publishNotificationEmail } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { getDict } from "@/lib/i18n/server";
import { pushToOrg } from "@/lib/push";
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
  const dict = await getDict();
  const postId = String(formData.get("postId") ?? "");
  const contentType = String(formData.get("contentType") ?? "");
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 120);
  const body = String(formData.get("body") ?? "")
    .trim()
    .slice(0, 4000);
  // Per-post clear-photo release (default off). Only members who also opted into
  // clear photos will ever see the original; the visibility AND is server-side.
  const clearPhotoAllowed = formData.get("clearPhotoAllowed") === "1";
  // The admin can drop the generated decorative cover before publishing.
  const removeCover = formData.get("removeCover") === "1";

  if (!isContentType(contentType)) {
    return { ok: false, message: dict.review.pickArtError };
  }
  if (!title) {
    return { ok: false, message: dict.review.emptyTitleError };
  }

  const admin = createAdminClient();
  // Confirm the draft belongs to the admin's org before acting.
  const { data: post } = await admin
    .from("posts")
    .select("id, org_id, status, cover_image_path")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.org_id !== session.orgId) {
    return { ok: false, message: dict.review.notFound };
  }

  // publish_post returns the post's source_image_path (the raw original), so we
  // can delete it for reflections — see below.
  const { data: sourcePath, error } = await admin.rpc("publish_post", {
    p_actor_id: session.userId,
    p_post_id: postId,
    p_content_type: contentType,
    p_title: title,
    p_body: body,
    p_clear_photo_allowed: clearPhotoAllowed,
  });
  if (error) {
    // publish_post raises 'duplicate_title' when an already-published post in
    // this org shares this title (and, for events, the start date). Hard block:
    // tell the admin so they can discard or rename if it's genuinely different.
    if (error.message?.includes("duplicate_title")) {
      return {
        ok: false,
        message: dict.review.duplicateTitleBlock,
      };
    }
    return { ok: false, message: dict.review.publishFailed };
  }

  // Privacy policy: a reflection (Rückblick) is the type most likely to depict
  // identifiable children, so its raw original is NOT retained. Delete the
  // original bytes from raw-photos synchronously right after publish, then null
  // the column. publish_post has already forced clear_photo_allowed=false for
  // reflections, so the consent path can never reach a now-deleted original.
  // Surface a delete failure: the admin must know if the original wasn't purged.
  if (
    contentType === "reflection" &&
    typeof sourcePath === "string" &&
    sourcePath
  ) {
    const { error: rmErr } = await admin.storage
      .from("raw-photos")
      .remove([sourcePath]);
    if (rmErr) {
      return { ok: false, message: dict.review.originalDeleteFailed };
    }
    await admin
      .from("posts")
      .update({ source_image_path: null })
      .eq("id", postId);
  }

  // Admin dropped the generated cover: remove the bytes + null the column.
  // Best-effort — a leftover cover is a decoration, never block the publish.
  if (
    removeCover &&
    typeof post.cover_image_path === "string" &&
    post.cover_image_path
  ) {
    await admin.storage.from("cover-photos").remove([post.cover_image_path]);
    await admin
      .from("posts")
      .update({ cover_image_path: null })
      .eq("id", postId);
  }

  // Fire notifications (best-effort; never block/fail the publish).
  await notifyOrgOnPublish(session.orgId, title).catch(() => {});

  // Fire publish-time translation into the non-German locales (best-effort; a
  // missing translation falls back to German). Sends only member-safe content: the
  // final title/body, the structured payload, and the just-created event titles.
  // We await so the trigger actually runs before the action returns (unawaited work
  // in a server action may be torn down), but triggerTranslation has a hard 5s
  // timeout, so a slow/unreachable worker bounds the publish wait instead of
  // hanging it. The post is already published in the DB at this point regardless.
  await triggerTranslationForPost({
    postId,
    orgId: session.orgId,
    title,
    body,
  }).catch(() => {});

  revalidatePath("/review");
  revalidatePath("/feed");
  return { ok: true, message: dict.review.published };
}

/**
 * Build the translation bundle for a just-published post and hand it to the worker.
 * Reads the post's structured payload (extraction.payload — what members see) and
 * the events created at publish, then fires the fire-and-forget translate trigger.
 */
async function triggerTranslationForPost(params: {
  postId: string;
  orgId: string;
  title: string;
  body: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: post } = await admin
    .from("posts")
    .select("extraction")
    .eq("id", params.postId)
    .maybeSingle();

  const extraction = post?.extraction as { payload?: unknown } | null;
  const payload =
    extraction?.payload && typeof extraction.payload === "object"
      ? (extraction.payload as Record<string, unknown>)
      : null;

  const { data: events } = await admin
    .from("events")
    .select("id, title")
    .eq("post_id", params.postId);

  await triggerTranslation({
    postId: params.postId,
    orgId: params.orgId,
    title: params.title,
    body: params.body,
    payload,
    events: (events ?? []).map((e) => ({ id: e.id, title: e.title })),
  });
}

/** Discard a draft (archived, not published). */
export async function discardDraft(postId: string): Promise<ReviewActionState> {
  const session = await requireAdmin();
  const dict = await getDict();
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("org_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.org_id !== session.orgId) {
    return { ok: false, message: dict.review.notFound };
  }
  const { error } = await admin.rpc("discard_post", {
    p_actor_id: session.userId,
    p_post_id: postId,
  });
  if (error) return { ok: false, message: dict.review.discardFailed };
  revalidatePath("/review");
  return { ok: true, message: dict.review.discarded };
}

/**
 * Take down (depublish) an already-PUBLISHED post — removes it from the feed +
 * its sections, and cancels its calendar events (so they leave /kalender and
 * are actively removed from subscribed ICS calendars). takedown_post re-checks
 * org + admin + that the post is published; the post is scoped to the session
 * org here too. Used by the admin control in the feed detail sheet.
 */
export async function takedownPost(postId: string): Promise<ReviewActionState> {
  const session = await requireAdmin();
  const dict = await getDict();
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("org_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.org_id !== session.orgId) {
    return { ok: false, message: dict.review.takedownNotFound };
  }
  const { error } = await admin.rpc("takedown_post", {
    p_actor_id: session.userId,
    p_post_id: postId,
  });
  if (error) return { ok: false, message: dict.review.takedownFailed };
  revalidatePath("/feed");
  revalidatePath("/kalender");
  revalidatePath("/essensplan");
  revalidatePath("/rueckblick");
  revalidatePath("/info");
  revalidatePath("/gesundheit");
  return { ok: true, message: dict.review.takenDown };
}

/**
 * Notify an org's members when a post is published: web push to all subscribers,
 * and an email to members who opted into the digest. Best-effort; never throws.
 */
async function notifyOrgOnPublish(orgId: string, title: string): Promise<void> {
  const admin = createAdminClient();

  // Web push (fan-out; dead subs pruned inside pushToOrg).
  await pushToOrg(orgId, {
    title: "Neuer Aushang",
    body: title,
    url: `${publicEnv.siteUrl}/feed`,
  });

  // Email to opted-in members.
  const { data: members } = await admin
    .from("profiles")
    .select("id, email_digest_opt_in")
    .eq("org_id", orgId)
    .eq("email_digest_opt_in", true);

  const ids = (members ?? []).map((m) => m.id);
  if (ids.length === 0) return;

  // Resolve emails via the auth admin API (profiles don't store email).
  const { data: list } = await admin.auth.admin.listUsers();
  const emails = (list?.users ?? [])
    .filter((u) => ids.includes(u.id) && u.email)
    .map((u) => u.email as string);

  const { subject, html, text } = publishNotificationEmail(
    title,
    `${publicEnv.siteUrl}/feed`,
  );
  await Promise.all(
    emails.map((to) => sendEmail({ to, subject, html, text }).catch(() => {})),
  );
}
