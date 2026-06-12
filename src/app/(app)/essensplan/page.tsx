import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Essensplan" };

/**
 * Parent-facing meal-plan section ("Was die Kinder essen"). Lists published
 * posts of content_type='meal_plan' for the org, joined to their structured
 * post_details (days, dishes, estimated Nutri-Score). Empty in Phase 1 — the
 * meal_plan rows are produced by the Phase 2 capture→extract→publish pipeline.
 * The Nutri-Score, when shown, is ALWAYS labeled an estimate.
 */
export default async function EssensplanPage() {
  await requireSession();
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts_public")
    .select("id, title, published_at, nutri_score_hidden")
    .eq("content_type", "meal_plan")
    .order("published_at", { ascending: false })
    .limit(20);

  const list = posts ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Essensplan</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Was die Kinder essen.
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Noch kein Essensplan veröffentlicht.
          </div>
        </Card>
      ) : (
        list.map((p) => (
          <Card key={p.id}>
            <h2 className="font-medium">{p.title}</h2>
            {/* Phase 3 renders the day/dish grid + estimated Nutri-Score from
                post_details here, with a "Schätzung" label. */}
          </Card>
        ))
      )}
    </div>
  );
}
