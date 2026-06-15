import type { Metadata } from "next";

import { MarkSeen } from "@/app/(app)/bereiche/mark-seen";
import { CategoryChip } from "@/components/category-chip";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
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
  const t = await getDict();
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
      <MarkSeen category="meal_plan" />
      <PageHeader title={t.essensplan.title} subtitle={t.essensplan.subtitle} />

      {list.length === 0 ? (
        <EmptyState title={t.essensplan.empty} />
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <Card key={p.id}>
              <CategoryChip category="meal_plan" label={t.chip.meal_plan} />
              <h2 className="mt-2 text-[17px] font-bold text-ink">{p.title}</h2>
              {/* Phase 3 renders the day/dish grid + estimated Nutri-Score from
                  post_details here, with a "Schätzung" label. */}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
