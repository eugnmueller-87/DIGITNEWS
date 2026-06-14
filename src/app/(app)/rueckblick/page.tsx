import type { Metadata } from "next";

import { CategoryChip } from "@/components/category-chip";
import { PostDetail } from "@/components/post-detail";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
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
  await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("posts_public")
    .select("id, title, body, published_at, extraction, redacted_image_path")
    .eq("content_type", "reflection")
    .order("published_at", { ascending: false })
    .limit(20);

  const list = (data ?? []) as ReflectionRow[];

  const imageUrls = new Map<string, string>();
  const withImg = list.filter((p) => p.redacted_image_path);
  if (withImg.length > 0) {
    const admin = createAdminClient();
    const signed = await Promise.all(
      withImg.map((p) =>
        admin.storage
          .from("redacted-photos")
          .createSignedUrl(p.redacted_image_path as string, 600)
          .then((r) => ({ id: p.id, url: r.data?.signedUrl ?? null })),
      ),
    );
    for (const s of signed) if (s.url) imageUrls.set(s.id, s.url);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rückblick"
        subtitle="Was die Kinder unter der Woche gemacht haben."
      />

      {list.length === 0 ? (
        <EmptyState title="Noch kein Rückblick veröffentlicht." />
      ) : (
        <div className="space-y-4">
          {list.map((p) => {
            const imageUrl = imageUrls.get(p.id) ?? null;
            return (
              <Card key={p.id}>
                <div className="flex items-center justify-between gap-2">
                  <CategoryChip category="reflection" />
                  {p.published_at && (
                    <time className="shrink-0 text-[13px] font-semibold tabular-nums text-ink-faint">
                      {new Date(p.published_at).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
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
                    alt={p.title ?? "Rückblick"}
                    loading="lazy"
                    className="mt-3 w-full rounded-[12px] border border-border bg-surface-2 object-contain"
                  />
                )}
                <div className="mt-3">
                  <PostDetail
                    contentType="reflection"
                    body={p.body}
                    payload={p.extraction?.payload}
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
