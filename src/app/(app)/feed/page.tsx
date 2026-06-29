import type { Metadata } from "next";

import { MarkSeen } from "@/app/(app)/bereiche/mark-seen";
import { CategoryChip } from "@/components/category-chip";
import { Alert, Button, EmptyState, SectionHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { clsx } from "@/lib/clsx";
import { localizePost, fetchPostTranslations } from "@/lib/content/localize";
import { maskPlaceholders } from "@/lib/content/mask";
import { buildFeedView, type FeedAlert, type FeedPost } from "@/lib/feed";
import { formatDate } from "@/lib/i18n/format";
import { getDict, getLocale } from "@/lib/i18n/server";
import { signPostImages } from "@/lib/photo";
import { createClient } from "@/lib/supabase/server";

import { FeedCard } from "./feed-card";

export const metadata: Metadata = { title: "Pinnwand" };

/**
 * Member feed ("Pinnwand"). Health alerts are pinned at the top, most-severe
 * first (ordered in buildFeedView, NOT SQL — health_severity is text+CHECK so a
 * DB ORDER BY would sort alphabetically). Everything else is a single vertical
 * stream of shared-anatomy cards: category glyph-disc + chip + timestamp +
 * 2-line body. Reads go through the member-safe posts_public view (no PII) under
 * RLS, so they can only ever return this org's published posts.
 */
export default async function FeedPage({
  searchParams,
}: {
  // Deep-link from the publish notification: /feed?post=<id> auto-opens that
  // post's detail sheet. (Next 16 makes searchParams a Promise.)
  searchParams: Promise<{ post?: string }>;
}) {
  const session = await requireSession();
  const t = await getDict();
  const locale = await getLocale();
  const supabase = await createClient();
  const openPostId = (await searchParams).post ?? null;

  const [alertResult, postResult, profileResult, viewResult] =
    await Promise.all([
      supabase
        .from("posts_public")
        .select("id, title, body, health_severity, published_at")
        .eq("content_type", "health_notice")
        .order("published_at", { ascending: false })
        .limit(50),
      // The Pinnwand is the central stream of EVERYTHING published — every
      // content_type plus unconfirmed (null) posts. We only exclude health_notice
      // because those are already pinned at the top as alerts (avoid showing them
      // twice). The dedicated libraries (Bereiche → Rückblick/Essensplan/…) are
      // just filtered views of the same posts, not the only place they appear.
      supabase
        .from("posts_public")
        .select(
          "id, title, body, category, content_type, extraction, redacted_image_path, cover_image_path, published_at",
        )
        .or("content_type.is.null,content_type.neq.health_notice")
        .order("published_at", { ascending: false })
        .limit(50),
      supabase
        .from("profiles")
        .select("photo_consent")
        .eq("id", session.userId)
        .maybeSingle(),
      // The member's last visit to the feed (for the "new since last seen"
      // highlight). RLS scopes category_views to the current user. MarkSeen
      // (rendered below) bumps last_seen_at AFTER render, so new posts highlight
      // on this visit and clear on the next.
      supabase
        .from("category_views")
        .select("last_seen_at")
        .eq("category", "feed")
        .maybeSingle(),
    ]);
  const photoConsent = profileResult.data?.photo_consent ?? false;
  const lastSeen = (viewResult.data as { last_seen_at?: string } | null)
    ?.last_seen_at;
  const lastSeenMs = lastSeen ? Date.parse(lastSeen) : 0;
  const isNew = (publishedAt: string | null) =>
    !!publishedAt && Date.parse(publishedAt) > lastSeenMs;

  const {
    alerts: alertList,
    posts: list,
    loadFailed,
  } = buildFeedView(
    { data: alertResult.data as FeedAlert[] | null, error: alertResult.error },
    { data: postResult.data as FeedPost[] | null, error: postResult.error },
  );

  // The translation overlay needs the post ids (so it can't join the first
  // Promise.all), and image signing needs only the already-fetched rows. They are
  // mutually independent, so run them CONCURRENTLY — one round-trip, not two.
  // (For German, fetchPostTranslations short-circuits to an empty map with no
  // query, so this costs nothing on the common path.)
  const imagePosts = (
    postResult.data as
      | ({ id: string; redacted_image_path: string | null } & FeedPost)[]
      | null
  )?.filter((p) => p.redacted_image_path);
  const [translations, imageUrls] = await Promise.all([
    fetchPostTranslations(
      [...alertList.map((a) => a.id), ...list.map((p) => p.id)],
      locale,
    ),
    imagePosts && imagePosts.length > 0
      ? signPostImages(imagePosts, session.orgId, photoConsent)
      : Promise.resolve(new Map<string, string>()),
  ]);
  const localizedAlerts = alertList.map((a) => localizePost(a, translations));
  const localizedList = list.map((p) => localizePost(p, translations));

  const isAdmin = session.role === "admin" || session.role === "superadmin";
  const isSuperadmin = session.role === "superadmin";

  return (
    <div>
      <MarkSeen category="feed" />
      <h1 className="font-display mb-4 text-[26px] font-bold leading-tight text-ink">
        {t.feed.title}
      </h1>

      {loadFailed && (
        <div className="mb-4">
          <Alert variant="error">{t.feed.loadError}</Alert>
        </div>
      )}

      {/* Pinned health alerts — the only cards that break the monochrome calm. */}
      {localizedAlerts.length > 0 && (
        <section className="mb-5 space-y-3">
          <SectionHeader>{t.feed.important}</SectionHeader>
          {localizedAlerts.map((a) => {
            const urgent = a.health_severity === "urgent";
            return (
              <div
                key={a.id}
                className={clsx(
                  "rounded-[16px] border p-4",
                  urgent
                    ? "border-tomato bg-tomato-soft"
                    : "border-border bg-paper",
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <CategoryChip
                    category={urgent ? "health_urgent" : "health_advisory"}
                    label={
                      urgent ? t.chip.health_urgent : t.chip.health_advisory
                    }
                  />
                  {a.published_at && (
                    <span className="ml-auto shrink-0 text-[13px] font-semibold tabular-nums text-ink-faint">
                      {formatDate(a.published_at, locale, t, { noYear: true })}
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-[17px] font-bold text-ink">
                  {a.title}
                </h3>
                {a.body && (
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
                    {maskPlaceholders(a.body)}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {localizedList.length === 0 ? (
        loadFailed ? null : (
          <EmptyState
            title={t.feed.emptyTitle}
            hint={isAdmin ? t.feed.emptyHintAdmin : t.feed.emptyHintMember}
            action={
              isAdmin ? (
                // Quiet hint; the FAB is the real entry point.
                <a href="/aufnahme">
                  <Button>{t.feed.captureCta}</Button>
                </a>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="grid gap-3">
          {localizedList.map((post) => (
            <FeedCard
              key={post.id}
              isAdmin={isAdmin}
              isSuperadmin={isSuperadmin}
              autoOpen={post.id === openPostId}
              post={{
                id: post.id,
                title: post.title,
                body: post.body,
                content_type: post.content_type ?? null,
                published_at: post.published_at,
                payload:
                  (post as { extraction?: { payload?: unknown } }).extraction
                    ?.payload ?? null,
                imageUrl: imageUrls.get(post.id) ?? null,
                hasImage: !!(
                  (post as { redacted_image_path?: string | null })
                    .redacted_image_path ||
                  (post as { cover_image_path?: string | null })
                    .cover_image_path
                ),
                isNew: isNew(post.published_at),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
