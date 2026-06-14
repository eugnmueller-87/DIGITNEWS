import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, Card } from "@/components/ui";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Mehr" };

interface MoreLink {
  href: string;
  label: string;
  hint: string;
}

/**
 * "Mehr" hub — the overflow destination that keeps the phone bottom nav at four
 * thumb-sized tabs. Secondary destinations live here instead of crowding the
 * nav: everyone gets Rückblick + Einstellungen; admins also get the capture +
 * member-management entries that aren't on their four-tab bar, and superadmins
 * get the Operator console. The top pill nav still lists everything on desktop.
 */
export default async function MehrPage() {
  const session = await requireSession();
  const isAdmin = session.role === "admin" || session.role === "superadmin";
  const isSuperadmin = session.role === "superadmin";

  const sections: { title: string; links: MoreLink[] }[] = [
    {
      title: "Für dich",
      links: [
        { href: "/rueckblick", label: "Rückblick", hint: "Wochenrückblicke" },
        {
          href: "/einstellungen",
          label: "Einstellungen",
          hint: "Kalender-Abo, E-Mail, Konto",
        },
      ],
    },
  ];

  if (isAdmin) {
    const adminLinks: MoreLink[] = [
      { href: "/aufnahme", label: "Aufnahme", hint: "Aushang fotografieren" },
      {
        href: "/admin/mitglieder",
        label: "Mitglieder",
        hint: "Eltern & Team verwalten",
      },
    ];
    if (isSuperadmin) {
      adminLinks.push({
        href: "/operator",
        label: "Operator",
        hint: "Organisationen verwalten",
      });
    }
    sections.push({ title: "Verwaltung", links: adminLinks });
  }

  return (
    <div>
      <PageHeader title="Mehr" subtitle="Weitere Bereiche" />

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="font-display mb-2 px-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
              {section.title}
            </h2>
            <Card className="p-0">
              <ul>
                {section.links.map((link, i) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={
                        "flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-sun-soft" +
                        (i > 0 ? " border-t border-border" : "")
                      }
                    >
                      <span className="min-w-0">
                        <span className="font-display block font-semibold text-ink">
                          {link.label}
                        </span>
                        <span className="block text-sm font-semibold text-ink-soft">
                          {link.hint}
                        </span>
                      </span>
                      <span aria-hidden className="text-xl text-ink-soft">
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
