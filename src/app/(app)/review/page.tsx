import type { Metadata } from "next";

import { Card, EmptyState, SectionHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import type { ContentType } from "@/lib/content/types";
import { fmt, formatDateTime } from "@/lib/i18n/format";
import { getDict, getLocale } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { ReviewCard } from "./review-card";

export const metadata: Metadata = { title: "Prüfen" };

interface DraftRow {
  id: string;
  status: "processing" | "draft" | "failed";
  title: string | null;
  body: string | null;
  content_type_suggested: ContentType | null;
  redacted_image_path: string | null;
  cover_image_path: string | null;
  clear_photo_allowed: boolean;
  created_at: string;
}

/**
 * Review gate. Lists posts awaiting the admin: drafts (ready to confirm +
 * publish), still-processing captures, and failed ones. Each draft gets an
 * inline review card with the redacted photo, editable fields, content-type
 * confirmation, and Publish/Discard. requireAdmin gates the page; reads use the
 * admin client scoped to the session org.
 */
export default async function ReviewPage() {
  const session = await requireAdmin();
  const admin = createAdminClient();
  const t = await getDict();
  const locale = await getLocale();

  const { data } = await admin
    .from("posts")
    .select(
      "id, status, title, body, content_type_suggested, redacted_image_path, cover_image_path, clear_photo_allowed, created_at",
    )
    .eq("org_id", session.orgId)
    .in("status", ["draft", "processing", "failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as DraftRow[];
  const drafts = rows.filter((r) => r.status === "draft");
  const processing = rows.filter((r) => r.status === "processing");
  const failed = rows.filter((r) => r.status === "failed");

  // Mint short-TTL signed URLs for the redacted images + generated covers of drafts.
  const signed = new Map<string, string>();
  const coverSigned = new Map<string, string>();
  for (const d of drafts) {
    if (d.redacted_image_path) {
      const { data: s } = await admin.storage
        .from("redacted-photos")
        .createSignedUrl(d.redacted_image_path, 600);
      if (s?.signedUrl) signed.set(d.id, s.signedUrl);
    }
    if (d.cover_image_path) {
      const { data: c } = await admin.storage
        .from("cover-photos")
        .createSignedUrl(d.cover_image_path, 600);
      if (c?.signedUrl) coverSigned.set(d.id, c.signedUrl);
    }
  }

  const nothing =
    drafts.length === 0 && processing.length === 0 && failed.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-[26px] font-bold leading-tight text-ink">
        {t.review.title}
      </h1>

      {nothing && (
        <EmptyState title={t.review.empty} hint={t.review.emptyHint} />
      )}

      {drafts.length > 0 && (
        <section className="space-y-3">
          <SectionHeader>
            {fmt(t.review.toCheck, { count: drafts.length })}
          </SectionHeader>
          {drafts.map((d) => (
            <ReviewCard
              key={d.id}
              id={d.id}
              title={d.title}
              body={d.body}
              suggested={d.content_type_suggested}
              imageUrl={signed.get(d.id) ?? null}
              coverUrl={coverSigned.get(d.id) ?? null}
              clearPhotoAllowed={d.clear_photo_allowed}
            />
          ))}
        </section>
      )}

      {processing.length > 0 && (
        <section className="space-y-2">
          <SectionHeader>
            {fmt(t.review.processing, { count: processing.length })}
          </SectionHeader>
          {processing.map((p) => (
            <Card key={p.id}>
              <p className="text-sm text-ink-soft">
                {fmt(t.review.processingCard, {
                  date: formatDateTime(p.created_at, locale),
                })}
              </p>
            </Card>
          ))}
        </section>
      )}

      {failed.length > 0 && (
        <section className="space-y-3">
          <SectionHeader>
            {fmt(t.review.failedSection, { count: failed.length })}
          </SectionHeader>
          {failed.map((f) => (
            <ReviewCard
              key={f.id}
              id={f.id}
              title={f.title}
              body={f.body}
              suggested={f.content_type_suggested}
              imageUrl={null}
              failed
            />
          ))}
        </section>
      )}
    </div>
  );
}
