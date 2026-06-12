import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import type { ContentType } from "@/lib/content/types";
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

  const { data } = await admin
    .from("posts")
    .select(
      "id, status, title, body, content_type_suggested, redacted_image_path, created_at",
    )
    .eq("org_id", session.orgId)
    .in("status", ["draft", "processing", "failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as DraftRow[];
  const drafts = rows.filter((r) => r.status === "draft");
  const processing = rows.filter((r) => r.status === "processing");
  const failed = rows.filter((r) => r.status === "failed");

  // Mint short-TTL signed URLs for the redacted images of drafts.
  const signed = new Map<string, string>();
  for (const d of drafts) {
    if (d.redacted_image_path) {
      const { data: s } = await admin.storage
        .from("redacted-photos")
        .createSignedUrl(d.redacted_image_path, 600);
      if (s?.signedUrl) signed.set(d.id, s.signedUrl);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Prüfen</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Prüfe ausgelesene Aushänge und veröffentliche sie.
        </p>
      </div>

      {drafts.length === 0 &&
        processing.length === 0 &&
        failed.length === 0 && (
          <Card>
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Nichts zu prüfen. Fotografiere einen Aushang, um zu starten.
            </p>
          </Card>
        )}

      {drafts.map((d) => (
        <ReviewCard
          key={d.id}
          id={d.id}
          title={d.title}
          body={d.body}
          suggested={d.content_type_suggested}
          imageUrl={signed.get(d.id) ?? null}
        />
      ))}

      {processing.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Wird ausgelesen ({processing.length})
          </h2>
          {processing.map((p) => (
            <Card key={p.id}>
              <p className="text-sm text-zinc-400">
                Aufnahme vom {new Date(p.created_at).toLocaleString("de-DE")}{" "}
                wird verarbeitet …
              </p>
            </Card>
          ))}
        </section>
      )}

      {failed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Fehlgeschlagen ({failed.length})
          </h2>
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
