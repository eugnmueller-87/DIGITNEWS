import "server-only";

import type { Locale } from "@/lib/i18n/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Locale-aware overlay of AI-translated post content (migration 0025).
 *
 * German is the source of truth on posts/post_details/events; translations live in
 * post_translations / event_translations as ADDITIVE rows (en, ru). When a member
 * reads the app in a non-German locale, we overlay the translated title/body/payload
 * onto the German rows — falling back to German per-field whenever a translation row
 * (or a specific field) is missing. Translation is best-effort, so fallback is the
 * normal case for brand-new or untranslated posts.
 *
 * These read post_translations via the RLS client (members are granted SELECT;
 * RLS restricts to their org's published posts), so this is safe to call from any
 * member-facing server component.
 */

export interface PostTranslation {
  title: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
}

/**
 * A row carrying at least an id and the translatable German fields. Used as a
 * generic CONSTRAINT only — callers pass their own concrete row type `T`, which is
 * preserved through localizePost/localizePosts (no widening of other fields).
 */
export interface TranslatablePost {
  id: string;
  title?: string | null;
  body?: string | null;
  extraction?: { payload?: unknown } | null;
}

/**
 * Fetch translations for the given post ids in the active locale. Returns an empty
 * map for German (the source) or when nothing is translated yet. One query.
 */
export async function fetchPostTranslations(
  postIds: string[],
  locale: Locale,
): Promise<Map<string, PostTranslation>> {
  const out = new Map<string, PostTranslation>();
  if (locale === "de" || postIds.length === 0) return out;

  const supabase = await createClient();
  const { data } = await supabase
    .from("post_translations")
    .select("post_id, title, body, payload")
    .eq("locale", locale)
    .in("post_id", postIds);

  for (const row of (data ?? []) as {
    post_id: string;
    title: string | null;
    body: string | null;
    payload: Record<string, unknown> | null;
  }[]) {
    out.set(row.post_id, {
      title: row.title,
      body: row.body,
      payload: row.payload,
    });
  }
  return out;
}

/**
 * Overlay a translation onto one post row: swap title/body and the
 * extraction.payload with the translated values where present, German otherwise.
 * Returns a NEW object (never mutates the input). Pass the map from
 * fetchPostTranslations; a row with no entry is returned unchanged (German).
 */
export function localizePost<T extends TranslatablePost>(
  post: T,
  translations: Map<string, PostTranslation>,
): T {
  const tr = translations.get(post.id);
  if (!tr) return post;

  const next: T = { ...post };
  if (tr.title) next.title = tr.title;
  if (tr.body) next.body = tr.body;
  if (tr.payload) {
    // Mirror the German shape: translated strings live under extraction.payload.
    const ext = (post.extraction ?? {}) as { payload?: unknown };
    next.extraction = { ...ext, payload: tr.payload };
  }
  return next;
}

/**
 * Convenience: fetch translations for a list of posts and return a localized copy
 * of the list in one call. Order is preserved.
 */
export async function localizePosts<T extends TranslatablePost>(
  posts: T[],
  locale: Locale,
): Promise<T[]> {
  if (locale === "de" || posts.length === 0) return posts;
  const translations = await fetchPostTranslations(
    posts.map((p) => p.id),
    locale,
  );
  return posts.map((p) => localizePost(p, translations));
}

/**
 * Fetch event-title translations for the active locale, keyed by event id. Empty
 * for German or when none are translated. One query.
 */
export async function fetchEventTitleTranslations(
  eventIds: string[],
  locale: Locale,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (locale === "de" || eventIds.length === 0) return out;

  const supabase = await createClient();
  const { data } = await supabase
    .from("event_translations")
    .select("event_id, title")
    .eq("locale", locale)
    .in("event_id", eventIds);

  for (const row of (data ?? []) as { event_id: string; title: string }[]) {
    if (row.title) out.set(row.event_id, row.title);
  }
  return out;
}
