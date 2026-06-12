import type { Metadata } from "next";

import { PageShell } from "@/components/ui";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Datenschutz" };

/**
 * Datenschutzerklärung — the one intentionally PUBLIC page (allowlisted in
 * routes.ts). Phase 1 placeholder; the full GDPR copy lands in Phase 5 (Brief
 * §12). Kept here now so the allowlist entry resolves to a real page.
 */
export default function DatenschutzPage() {
  return (
    <PageShell title="Datenschutz">
      <div className="prose prose-zinc max-w-none text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        <p>
          {brand.name} verarbeitet ausschließlich Informationen, die deine
          Organisation bereits öffentlich an ihrem Aushang veröffentlicht hat.
        </p>
        <p>
          Personenbezogene Daten werden <strong>lokal maskiert</strong>, bevor
          irgendeine KI-Verarbeitung stattfindet. Die KI sieht nur den
          maskierten Text. Die gesamte Infrastruktur wird in der EU betrieben.
        </p>
        <p className="text-zinc-400">
          Die vollständige Datenschutzerklärung wird vor dem öffentlichen Start
          ergänzt.
        </p>
        <p className="text-zinc-400">
          Kontakt:{" "}
          <a className="underline" href={`mailto:${brand.supportEmail}`}>
            {brand.supportEmail}
          </a>
        </p>
      </div>
    </PageShell>
  );
}
