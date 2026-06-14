import type { Metadata } from "next";

import { Group, Row } from "@/components/grouped-list";
import { NewBadge } from "@/components/new-badge";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bereiche" };

/**
 * Category hub. Each content category is its own browsable "library" so the
 * single feed stream doesn't become unmanageable. Each row shows a "new since
 * your last visit" badge (category_new_counts, migration 0021) so members can
 * see at a glance where fresh content landed; opening a category clears its
 * badge (the page calls mark_category_seen).
 */
export default async function BereichePage() {
  await requireSession();
  const supabase = await createClient();

  // Per-category "new since last visit" counts for the calling member.
  const { data } = await supabase.rpc("category_new_counts");
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { category: string; new_count: number }[]) {
    counts.set(r.category, Number(r.new_count) || 0);
  }
  const badge = (key: string) => <NewBadge count={counts.get(key) ?? 0} />;

  return (
    <div>
      <h1 className="font-display mb-5 text-[26px] font-bold leading-tight text-ink">
        Bereiche
      </h1>

      <Group title="Kategorien">
        <Row
          first
          href="/feed"
          glyph="feed"
          title="Pinnwand"
          subtitle="Alle neuesten Aushänge"
          trailing={badge("feed")}
        />
        <Row
          href="/essensplan"
          glyph="meal"
          title="Essensplan"
          subtitle="Was die Kinder essen"
          trailing={badge("meal_plan")}
        />
        <Row
          href="/kalender"
          glyph="calendar"
          title="Termine"
          subtitle="Feste, Schließtage, Fristen"
          trailing={badge("event_notice")}
        />
        <Row
          href="/rueckblick"
          glyph="sun"
          title="Rückblick"
          subtitle="Was die Kinder gemacht haben"
          trailing={badge("reflection")}
        />
        <Row
          href="/info"
          glyph="info"
          title="Infos"
          subtitle="Allgemeine Mitteilungen"
          trailing={badge("info")}
        />
        <Row
          href="/gesundheit"
          glyph="warning"
          title="Gesundheit"
          subtitle="Krankheits- & Gesundheitshinweise"
          trailing={badge("health_notice")}
        />
      </Group>
    </div>
  );
}
