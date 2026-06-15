import type { Metadata } from "next";

import { PageShell } from "@/components/ui";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Datenschutz" };

/**
 * Datenschutzerklärung — the one intentionally PUBLIC page (allowlisted). Honest
 * wording per the brief: only org-published info; PII masked locally before any
 * AI; EU infrastructure; per-member deletion. NOT a claim of automatic DSGVO
 * compliance — a "Privacy-Filter eingebaut" framing.
 */
export default function DatenschutzPage() {
  return (
    <PageShell title="Datenschutz">
      <div className="space-y-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        <section>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
            Was {brand.name} verarbeitet
          </h2>
          <p className="mt-1">
            {brand.name} verarbeitet ausschließlich Informationen, die deine
            Einrichtung bereits öffentlich an ihrem Aushang veröffentlicht hat.
            Es werden keine Kinderprofile angelegt und keine besonderen
            Kategorien personenbezogener Daten als Funktion verarbeitet.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
            Privacy-Filter
          </h2>
          <p className="mt-1">
            Personenbezogene Daten werden <strong>lokal maskiert</strong>, bevor
            irgendeine KI-Verarbeitung stattfindet. Die KI sieht ausschließlich
            den maskierten Text. Der Filter maskiert automatisch; die endgültige
            Freigabe trifft immer ein Mensch (die Administrator:in deiner
            Einrichtung). Wir versprechen keine „automatische DSGVO-Konformität“
            — sondern einen eingebauten Schutz, den du bestätigst.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
            Infrastruktur in der EU
          </h2>
          <p className="mt-1">
            Datenbank, Speicher und E-Mail-Versand werden in der EU betrieben.
            Roh-Fotos verlassen unsere Infrastruktur nicht. Die lokale
            Maskierung der personenbezogenen Daten findet ebenfalls auf unserer
            Infrastruktur statt.
          </p>
          <p className="mt-2">
            Für die Struktur-Erkennung wird der bereits{" "}
            <strong>maskierte Text</strong> an einen spezialisierten
            KI-Dienstleister übermittelt. Dieser erhält ausschließlich den
            maskierten Text – niemals Roh-Fotos oder unmaskierte
            personenbezogene Daten. Dieser Dienstleister verarbeitet derzeit
            außerhalb der EU; wir arbeiten daran, auch diesen Schritt in die EU
            zu verlagern.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
            Deine Rechte
          </h2>
          <p className="mt-1">
            Du kannst dein Konto und deine personenbezogenen Daten jederzeit in
            den Einstellungen löschen. Anfragen zur Auskunft, Berichtigung oder
            Löschung richtest du an die unten genannte Kontaktadresse. Ein
            Auftragsverarbeitungsvertrag (AVV) wird Einrichtungen
            bereitgestellt.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
            Kontakt
          </h2>
          <p className="mt-1">
            <a className="underline" href={`mailto:${brand.supportEmail}`}>
              {brand.supportEmail}
            </a>
          </p>
        </section>

        <p className="text-xs text-zinc-400">
          Diese Erklärung wird vor dem öffentlichen Start rechtlich finalisiert.
        </p>
      </div>
    </PageShell>
  );
}
