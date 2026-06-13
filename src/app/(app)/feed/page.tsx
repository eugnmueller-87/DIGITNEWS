import type { Metadata } from "next";

import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import type { PublicPost } from "@/lib/database.types";
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

  // Health alerts surface at the TOP, ordered by severity. Meal plans and
  // reflections live in their own sections (not the feed), so we exclude them
  // here; the feed shows general info, calls to action, and event announcements.
  const [{ data: alerts }, { data: posts }] = await Promise.all([
    supabase
      .from("posts_public")
      .select("id, title, body, health_severity, published_at")
      .eq("content_type", "health_notice")
      .order("published_at", { ascending: false })
      .limit(10),
    supabase
      .from("posts_public")
      .select("id, title, body, category, content_type, published_at")
      .or("content_type.is.null,content_type.in.(info,event_notice)")
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  const alertList = (alerts ?? []) as Pick<
    PublicPost,
    "id" | "title" | "body" | "health_severity" | "published_at"
  >[];
  const list = (posts ?? []) as Pick<
    PublicPost,
    "id" | "title" | "body" | "category" | "published_at"
  >[];

  // Sort alerts urgent → advisory → info.
  const sev = { urgent: 0, advisory: 1, info: 2 } as const;
  alertList.sort(
    (a, b) =>
      (sev[a.health_severity ?? "info"] ?? 3) -
      (sev[b.health_severity ?? "info"] ?? 3),
  );

  return (
    <div className="space-y-4">
      {alertList.length > 0 && (
        <section className="space-y-2">
          {alertList.map((a) => (
            <div
              key={a.id}
              className={
                a.health_severity === "urgent"
                  ? "rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40"
                  : "rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40"
              }
            >
              <div className="text-sm font-medium">{a.title}</div>
              {a.body && (
                <div className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                  {a.body}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <PageHeader title="Aushänge" subtitle="Neuigkeiten deiner Einrichtung." />

      {list.length === 0 ? (
        <EmptyState
          title="Noch keine Aushänge."
          hint={
            session.role === "admin" || session.role === "superadmin"
              ? "Fotografiere einen Aushang unter „Aufnahme“ und gib ihn unter „Prüfen“ frei — dann erscheint er hier."
              : "Sobald deine Einrichtung etwas veröffentlicht, siehst du es hier."
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((post) => (
            <Card key={post.id}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-medium">{post.title}</h2>
                {post.published_at && (
                  <time className="shrink-0 text-xs text-zinc-400">
                    {new Date(post.published_at).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </time>
                )}
              </div>
              {post.body && (
                <p className="mt-1 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">
                  {post.body}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
