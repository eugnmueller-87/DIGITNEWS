import type { Metadata } from "next";

import { Group, Row } from "@/components/grouped-list";
import { NewBadge } from "@/components/new-badge";
import { requireSession } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
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
  const t = await getDict();
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
        {t.bereiche.title}
      </h1>

      <Group title={t.bereiche.categories}>
        <Row
          first
          href="/essensplan"
          glyph="meal"
          title={t.bereiche.essensplanTitle}
          subtitle={t.bereiche.essensplanSubtitle}
          trailing={badge("meal_plan")}
        />
        <Row
          href="/kalender"
          glyph="calendar"
          title={t.bereiche.termineTitle}
          subtitle={t.bereiche.termineSubtitle}
          trailing={badge("event_notice")}
        />
        <Row
          href="/rueckblick"
          glyph="sun"
          title={t.bereiche.rueckblickTitle}
          subtitle={t.bereiche.rueckblickSubtitle}
          trailing={badge("reflection")}
        />
        <Row
          href="/info"
          glyph="info"
          title={t.bereiche.infosTitle}
          subtitle={t.bereiche.infosSubtitle}
          trailing={badge("info")}
        />
        <Row
          href="/gesundheit"
          glyph="warning"
          title={t.bereiche.gesundheitTitle}
          subtitle={t.bereiche.gesundheitSubtitle}
          trailing={badge("health_notice")}
        />
      </Group>
    </div>
  );
}
