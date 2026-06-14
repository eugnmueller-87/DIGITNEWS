import type { Metadata } from "next";

import { Alert, EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { clsx } from "@/lib/clsx";
import { buildFeedView, type FeedAlert, type FeedPost } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Feed" };

/**
 * Member feed. In Phase 1 there are no published posts yet, so this renders an
 * empty state. The query goes through the member-safe posts_public view (no PII
 * columns) and is governed by RLS, so it can only ever return this org's
 * published posts. Proving this returns ONLY own-org rows is the Phase 1
 * acceptance test.
 */
export default async function FeedPage() {
  const session = await requireSession();
  const supabase = await createClient();

  // Health alerts surface at the TOP, most severe first. health_severity is a
  // text+CHECK column (not a real enum), so a DB ORDER BY on it would sort
  // ALPHABETICALLY — wrong, and worse, the row cap could drop a still-relevant
  // urgent alert in favour of newer-but-milder ones. So we fetch newest-first
  // with a generous cap and impose the correct order in buildFeedView (unit-
  // tested). Meal plans/reflections live in their own sections (excluded here).
  const [alertResult, postResult] = await Promise.all([
    supabase
      .from("posts_public")
      .select("id, title, body, health_severity, published_at")
      .eq("content_type", "health_notice")
      .order("published_at", { ascending: false })
      .limit(50),
    supabase
      .from("posts_public")
      .select("id, title, body, category, content_type, published_at")
      .or("content_type.is.null,content_type.in.(info,event_notice)")
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  // A query error must NOT silently render as an empty feed (that would hide an
  // outage behind "nothing posted yet"). buildFeedView surfaces it explicitly.
  const {
    alerts: alertList,
    posts: list,
    loadFailed,
  } = buildFeedView(
    { data: alertResult.data as FeedAlert[] | null, error: alertResult.error },
    { data: postResult.data as FeedPost[] | null, error: postResult.error },
  );

  return (
    <div className="space-y-4">
      {loadFailed && (
        <Alert variant="error">
          Die Pinnwand konnte gerade nicht geladen werden. Bitte lade die Seite
          neu.
        </Alert>
      )}
      {alertList.length > 0 && (
        <section className="mb-2 space-y-3">
          {alertList.map((a) => (
            <div
              key={a.id}
              className={clsx(
                "rounded-[18px] border bg-paper p-5 shadow-felt",
                a.health_severity === "urgent"
                  ? "border-tomato"
                  : "border-border",
              )}
            >
              <span
                className={clsx(
                  "rounded-full px-3 py-0.5 text-xs font-bold",
                  a.health_severity === "urgent"
                    ? "bg-tomato text-white"
                    : "bg-sun-soft text-ink",
                )}
              >
                {a.health_severity === "urgent" ? "⚠️ Wichtig" : "ℹ️ Hinweis"}
              </span>
              <h3 className="font-display mt-2 text-xl font-semibold text-ink">
                {a.title}
              </h3>
              {a.body && (
                <p className="mt-1 font-semibold text-ink-soft">{a.body}</p>
              )}
            </div>
          ))}
        </section>
      )}

      <PageHeader title="Pinnwand" subtitle="Neuigkeiten deiner Einrichtung." />

      {list.length === 0 ? (
        // Suppress "nothing posted yet" during a load failure — the error Alert
        // above already explains the empty screen; claiming nothing was posted
        // would be misleading.
        loadFailed ? null : (
          <EmptyState
            title="Noch keine Aushänge."
            hint={
              session.role === "admin" || session.role === "superadmin"
                ? "Fotografiere einen Aushang unter „Aufnahme“ und gib ihn unter „Prüfen“ frei — dann erscheint er hier."
                : "Sobald deine Einrichtung etwas veröffentlicht, siehst du es hier."
            }
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((post) => (
            <article
              key={post.id}
              className="rounded-[18px] border border-border bg-paper p-5 shadow-felt"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-ink">
                  {post.title}
                </h2>
                {post.published_at && (
                  <time className="shrink-0 text-xs font-bold text-ink-soft">
                    {new Date(post.published_at).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </time>
                )}
              </div>
              {post.body && (
                <p className="mt-1 whitespace-pre-line font-semibold text-ink-soft">
                  {post.body}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
