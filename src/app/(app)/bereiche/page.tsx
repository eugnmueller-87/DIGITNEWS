import type { Metadata } from "next";

import { Group, Row } from "@/components/grouped-list";

export const metadata: Metadata = { title: "Bereiche" };

/**
 * Category hub. Each content category is its own browsable "library" so the
 * single feed stream doesn't become unmanageable. Links to the dedicated pages
 * (some pre-existing: Essensplan/Rückblick/Kalender; some new: Infos/Gesundheit).
 */
export default function BereichePage() {
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
        />
        <Row
          href="/essensplan"
          glyph="meal"
          title="Essensplan"
          subtitle="Was die Kinder essen"
        />
        <Row
          href="/kalender"
          glyph="calendar"
          title="Termine"
          subtitle="Feste, Schließtage, Fristen"
        />
        <Row
          href="/rueckblick"
          glyph="sun"
          title="Rückblick"
          subtitle="Was die Kinder gemacht haben"
        />
        <Row
          href="/info"
          glyph="info"
          title="Infos"
          subtitle="Allgemeine Mitteilungen"
        />
        <Row
          href="/gesundheit"
          glyph="warning"
          title="Gesundheit"
          subtitle="Krankheits- & Gesundheitshinweise"
        />
      </Group>
    </div>
  );
}
