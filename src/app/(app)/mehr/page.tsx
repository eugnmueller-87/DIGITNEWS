import type { Metadata } from "next";

import { Group, Row } from "@/components/grouped-list";
import { requireSession } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";

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
  const t = await getDict();
  const isAdmin = session.role === "admin" || session.role === "superadmin";
  const isSuperadmin = session.role === "superadmin";

  return (
    <div>
      <h1 className="font-display mb-5 text-[26px] font-bold leading-tight text-ink">
        {t.mehr.title}
      </h1>

      <Group title={t.mehr.forYou}>
        <Row
          first
          href="/rueckblick"
          glyph="sun"
          title={t.bereiche.rueckblickTitle}
          subtitle={t.mehr.rueckblickSubtitle}
        />
        <Row
          href="/kalender"
          glyph="calendarPlus"
          title={t.mehr.calendarSubTitle}
          subtitle={t.mehr.calendarSubSubtitle}
        />
        <Row
          href="/einstellungen"
          glyph="settings"
          title={t.mehr.settingsTitle}
          subtitle={t.mehr.settingsSubtitle}
        />
      </Group>

      {isAdmin && (
        <Group title={t.mehr.admin}>
          <Row
            first
            href="/aufnahme"
            glyph="capture"
            title={t.mehr.aufnahmeTitle}
            subtitle={t.mehr.aufnahmeSubtitle}
          />
          <Row
            href="/admin/mitglieder"
            glyph="members"
            title={t.mehr.mitgliederTitle}
            subtitle={t.mehr.mitgliederSubtitle}
          />
          {isSuperadmin && (
            <Row
              href="/operator"
              glyph="operator"
              title={t.mehr.operatorTitle}
              subtitle={t.mehr.operatorSubtitle}
            />
          )}
        </Group>
      )}
    </div>
  );
}
