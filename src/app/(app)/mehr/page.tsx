import type { Metadata } from "next";

import { Group, Row } from "@/components/grouped-list";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Mehr" };

/**
 * "Mehr" hub — the overflow destination that keeps the phone bottom nav at four
 * thumb-sized tabs. iOS grouped-table of links; everyone gets Rückblick,
 * Kalender-Abo, and Einstellungen, admins also get the capture + member-
 * management entries, and superadmins the Operator console. Rows are rendered
 * by role server-side; the desktop pill nav still lists everything. (Bereiche is
 * its own bottom-nav tab now, so it's no longer duplicated here.)
 */
export default async function MehrPage() {
  const session = await requireSession();
  const isAdmin = session.role === "admin" || session.role === "superadmin";
  const isSuperadmin = session.role === "superadmin";

  return (
    <div>
      <h1 className="font-display mb-5 text-[26px] font-bold leading-tight text-ink">
        Mehr
      </h1>

      <Group title="Für dich">
        <Row
          first
          href="/rueckblick"
          glyph="sun"
          title="Rückblick"
          subtitle="Wochenrückblicke"
        />
        <Row
          href="/kalender"
          glyph="calendarPlus"
          title="Kalender abonnieren"
          subtitle="Termine automatisch in deinem Kalender"
        />
        <Row
          href="/einstellungen"
          glyph="settings"
          title="Einstellungen"
          subtitle="Benachrichtigungen, Konto"
        />
      </Group>

      {isAdmin && (
        <Group title="Verwaltung">
          <Row
            first
            href="/aufnahme"
            glyph="capture"
            title="Aufnahme"
            subtitle="Aushang fotografieren"
          />
          <Row
            href="/admin/mitglieder"
            glyph="members"
            title="Mitglieder"
            subtitle="Eltern & Team verwalten"
          />
          {isSuperadmin && (
            <Row
              href="/operator"
              glyph="operator"
              title="Operator"
              subtitle="Organisationen verwalten"
            />
          )}
        </Group>
      )}
    </div>
  );
}
