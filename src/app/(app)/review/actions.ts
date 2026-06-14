"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { CONTENT_TYPES } from "@/lib/content/types";
import type { ContentType } from "@/lib/content/types";
import { sendEmail } from "@/lib/email/client";
import { publishNotificationEmail } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
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
    p_clear_photo_allowed: clearPhotoAllowed,
  });
  if (error) {
    // publish_post raises 'duplicate_title' when an already-published post in
    // this org shares this title (and, for events, the start date). Hard block:
    // tell the admin so they can discard or rename if it's genuinely different.
    if (error.message?.includes("duplicate_title")) {
      return {
        ok: false,
        message:
          "Ein Aushang mit diesem Titel wurde bereits veröffentlicht. " +
          "Verwirf diesen Entwurf oder ändere den Titel, wenn es ein anderer ist.",
      };
    }
    return { ok: false, message: "Veröffentlichen fehlgeschlagen." };
  }

  // Fire notifications (best-effort; never block/fail the publish).
  await notifyOrgOnPublish(session.orgId, title).catch(() => {});

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

/**
 * Take down (depublish) an already-PUBLISHED post — removes it from the feed +
 * its sections, and cancels its calendar events (so they leave /kalender and
 * are actively removed from subscribed ICS calendars). takedown_post re-checks
 * org + admin + that the post is published; the post is scoped to the session
 * org here too. Used by the admin control in the feed detail sheet.
 */
export async function takedownPost(postId: string): Promise<ReviewActionState> {
  const session = await requireAdmin();
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("org_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.org_id !== session.orgId) {
    return { ok: false, message: "Aushang nicht gefunden." };
  }
  const { error } = await admin.rpc("takedown_post", {
    p_actor_id: session.userId,
    p_post_id: postId,
  });
  if (error) return { ok: false, message: "Entfernen fehlgeschlagen." };
  revalidatePath("/feed");
  revalidatePath("/kalender");
  revalidatePath("/essensplan");
  revalidatePath("/rueckblick");
  revalidatePath("/info");
  revalidatePath("/gesundheit");
  return { ok: true, message: "Aushang entfernt." };
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
