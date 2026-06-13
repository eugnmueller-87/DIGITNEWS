import type { Metadata } from "next";

import { EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { clsx } from "@/lib/clsx";
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
        <section className="mb-2 space-y-3">
          {alertList.map((a) => (
            <div
              key={a.id}
              className="rounded-wobble-b relative border-[3px] border-ink bg-paper p-5 shadow-felt"
            >
              {/* Pin dot */}
              <span
                aria-hidden
                className={clsx(
                  "absolute -top-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-ink",
                  a.health_severity === "urgent" ? "bg-tomato" : "bg-sunshine",
                )}
              />
              <span
                className={clsx(
                  "rounded-full border-2 border-ink px-3 py-0.5 text-xs font-bold",
                  a.health_severity === "urgent"
                    ? "bg-tomato text-white"
                    : "bg-sunshine text-ink",
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
        <EmptyState
          title="Noch keine Aushänge."
          hint={
            session.role === "admin" || session.role === "superadmin"
              ? "Fotografiere einen Aushang unter „Aufnahme“ und gib ihn unter „Prüfen“ frei — dann erscheint er hier."
              : "Sobald deine Einrichtung etwas veröffentlicht, siehst du es hier."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((post, i) => (
            <article
              key={post.id}
              className={clsx(
                "relative border-[3px] border-ink bg-paper p-5 shadow-felt",
                i % 2 === 0 ? "rounded-wobble-a" : "rounded-wobble-b",
              )}
            >
              <span
                aria-hidden
                className="absolute -top-2.5 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-ink bg-berry"
              />
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
