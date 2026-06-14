import type { Metadata } from "next";

import { CategoryChip } from "@/components/category-chip";
import { Alert, Button, EmptyState, SectionHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { clsx } from "@/lib/clsx";
import { maskPlaceholders } from "@/lib/content/mask";
import { buildFeedView, type FeedAlert, type FeedPost } from "@/lib/feed";
import { createAdminClient } from "@/lib/supabase/admin";
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
export default async function FeedPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [alertResult, postResult] = await Promise.all([
    supabase
      .from("posts_public")
      .select("id, title, body, health_severity, published_at")
      .eq("content_type", "health_notice")
      .order("published_at", { ascending: false })
      .limit(50),
    supabase
      .from("posts_public")
      .select(
        "id, title, body, category, content_type, extraction, redacted_image_path, published_at",
      )
      .or("content_type.is.null,content_type.in.(info,event_notice)")
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  const {
    alerts: alertList,
    posts: list,
    loadFailed,
  } = buildFeedView(
    { data: alertResult.data as FeedAlert[] | null, error: alertResult.error },
    { data: postResult.data as FeedPost[] | null, error: postResult.error },
  );

  // Mint short-TTL signed URLs for the (masked) photos — the redacted-photos
  // bucket is private, so a member can't read it directly; the server signs
  // per-post URLs with the admin client (same pattern as /review). We only sign
  // paths returned by the org-scoped posts_public query above, so this stays
  // org-isolated; the raw-photos bucket is never touched.
  const imageUrls = new Map<string, string>();
  const withImg = (
    postResult.data as
      | ({ id: string; redacted_image_path: string | null } & FeedPost)[]
      | null
  )?.filter((p) => p.redacted_image_path);
  if (withImg && withImg.length > 0) {
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

  const isAdmin = session.role === "admin" || session.role === "superadmin";

  return (
    <div>
      <h1 className="font-display mb-4 text-[26px] font-bold leading-tight text-ink">
        Pinnwand
      </h1>

      {loadFailed && (
        <div className="mb-4">
          <Alert variant="error">
            Die Pinnwand konnte gerade nicht geladen werden. Bitte lade die
            Seite neu.
          </Alert>
        </div>
      )}

      {/* Pinned health alerts — the only cards that break the monochrome calm. */}
      {alertList.length > 0 && (
        <section className="mb-5 space-y-3">
          <SectionHeader>Wichtig</SectionHeader>
          {alertList.map((a) => {
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
                <CategoryChip
                  category={urgent ? "health_urgent" : "health_advisory"}
                />
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

      {list.length === 0 ? (
        loadFailed ? null : (
          <EmptyState
            title="Noch keine Aushänge."
            hint={
              isAdmin
                ? "Tippe auf die Kamera, um einen Aushang aufzunehmen — nach dem Prüfen erscheint er hier."
                : "Sobald deine Einrichtung etwas veröffentlicht, siehst du es hier."
            }
            action={
              isAdmin ? (
                // Quiet hint; the FAB is the real entry point.
                <a href="/aufnahme">
                  <Button>Aushang aufnehmen</Button>
                </a>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="grid gap-3">
          {list.map((post) => (
            <FeedCard
              key={post.id}
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
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
