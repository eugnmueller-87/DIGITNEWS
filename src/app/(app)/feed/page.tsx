import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import type { PublicPost } from "@/lib/database.types";

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

  const { data: posts } = await supabase
    .from("posts_public")
    .select("id, title, body, category, published_at")
    .order("published_at", { ascending: false })
    .limit(50);

  const list = (posts ?? []) as Pick<
    PublicPost,
    "id" | "title" | "body" | "category" | "published_at"
  >[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Aushänge</h1>

      {list.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Noch keine Aushänge.
            </p>
            {session.role === "admin" ? (
              <p className="mt-2 text-sm text-zinc-400">
                Sobald du einen Aushang fotografierst und freigibst, erscheint er
                hier. (Foto-Funktion folgt.)
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">
                Sobald deine Organisation etwas veröffentlicht, siehst du es hier.
              </p>
            )}
          </div>
        </Card>
      ) : (
        list.map((post) => (
          <Card key={post.id}>
            <h2 className="font-medium">{post.title}</h2>
            {post.body && (
              <p className="mt-1 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">
                {post.body}
              </p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
