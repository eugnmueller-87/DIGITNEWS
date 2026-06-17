import type { Metadata } from "next";

import { MarkSeen } from "@/app/(app)/bereiche/mark-seen";
import { CategoryChip } from "@/components/category-chip";
import { PostDetail } from "@/components/post-detail";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { localizePosts } from "@/lib/content/localize";
import { formatDate } from "@/lib/i18n/format";
import { getDict, getLocale } from "@/lib/i18n/server";
import { signPostImages } from "@/lib/photo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rückblick" };

interface ReflectionRow {
  id: string;
  title: string | null;
  body: string | null;
  published_at: string | null;
  extraction: { payload?: unknown } | null;
  redacted_image_path: string | null;
}

/**
 * Parent-facing reflection section ("Was die Kinder gemacht haben"). Lists
 * published reflection posts with their full structured detail (day summaries +
 * activities) AND the masked photo. The redacted-photos bucket is private, so
 * the server mints a short-TTL signed URL per post with the admin client (same
 * pattern as /review + /feed); only org-scoped paths from posts_public are
 * signed, and raw-photos is never touched.
 */
export default async function RueckblickPage() {
  const session = await requireSession();
  const t = await getDict();
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data }, profileResult] = await Promise.all([
    supabase
      .from("posts_public")
      .select("id, title, body, published_at, extraction, redacted_image_path")
      .eq("content_type", "reflection")
      .order("published_at", { ascending: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("photo_consent")
      .eq("id", session.userId)
      .maybeSingle(),
  ]);

  const rows = (data ?? []) as ReflectionRow[];
  const photoConsent = profileResult.data?.photo_consent ?? false;

  // Translation overlay and image signing are independent — run concurrently.
  // signPostImages reads only id + redacted_image_path (unchanged by localizing),
  // so derive the image set from the raw rows. For German the translation fetch
  // short-circuits with no query.
  const withImg = rows.filter((p) => p.redacted_image_path);
  const [list, imageUrls] = await Promise.all([
    localizePosts(rows, locale),
    withImg.length > 0
      ? signPostImages(withImg, session.orgId, photoConsent)
      : Promise.resolve(new Map<string, string>()),
  ]);

  return (
    <div className="space-y-4">
      <MarkSeen category="reflection" />
      <PageHeader title={t.rueckblick.title} subtitle={t.rueckblick.subtitle} />

      {list.length === 0 ? (
        <EmptyState title={t.rueckblick.empty} />
      ) : (
        <div className="space-y-4">
          {list.map((p) => {
            const imageUrl = imageUrls.get(p.id) ?? null;
            return (
              <Card key={p.id}>
                <div className="flex items-center justify-between gap-2">
                  <CategoryChip
                    category="reflection"
                    label={t.chip.reflection}
                  />
                  {p.published_at && (
                    <time className="shrink-0 text-[13px] font-semibold tabular-nums text-ink-faint">
                      {formatDate(p.published_at, locale, t, { noYear: true })}
                    </time>
                  )}
                </div>
                <h2 className="mt-2 text-[18px] font-bold text-ink">
                  {p.title}
                </h2>
                {imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset */
                  <img
                    src={imageUrl}
                    alt={p.title ?? t.rueckblick.fallbackAlt}
                    loading="lazy"
                    className="mt-3 w-full rounded-[12px] border border-border bg-surface-2 object-contain"
                  />
                )}
                <div className="mt-3">
                  <PostDetail
                    contentType="reflection"
                    body={p.body}
                    payload={p.extraction?.payload}
                    dict={t}
                    locale={locale}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
