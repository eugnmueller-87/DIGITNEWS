import type { Metadata } from "next";

import { MarkSeen } from "@/app/(app)/bereiche/mark-seen";
import { CategoryChip } from "@/components/category-chip";
import { PostDetail } from "@/components/post-detail";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
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

  const list = (data ?? []) as ReflectionRow[];
  const photoConsent = profileResult.data?.photo_consent ?? false;

  // Clear original only when the member opted in AND the admin released the post;
  // else the blurred image. Org-scoped raw read lives in the helper.
  const withImg = list.filter((p) => p.redacted_image_path);
  const imageUrls =
    withImg.length > 0
      ? await signPostImages(withImg, session.orgId, photoConsent)
      : new Map<string, string>();

  return (
    <div className="space-y-4">
      <MarkSeen category="reflection" />
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
