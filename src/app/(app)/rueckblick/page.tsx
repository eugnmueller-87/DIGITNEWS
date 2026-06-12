import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Rückblick" };

/**
 * Parent-facing reflection section ("Was die Kinder gemacht haben"). Lists
 * published posts of content_type='reflection', joined to post_details (the
 * Mon–Fri activity summary). Empty in Phase 1 — produced by the Phase 2 pipeline.
 */
export default async function RueckblickPage() {
  await requireSession();
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts_public")
    .select("id, title, published_at")
    .eq("content_type", "reflection")
    .order("published_at", { ascending: false })
    .limit(20);

  const list = posts ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Rückblick</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Was die Kinder unter der Woche gemacht haben.
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Noch kein Rückblick veröffentlicht.
          </div>
        </Card>
      ) : (
        list.map((p) => (
          <Card key={p.id}>
            <h2 className="font-medium">{p.title}</h2>
            {/* Phase 3 renders the Mon–Fri activity list from post_details. */}
          </Card>
        ))
      )}
    </div>
  );
}
