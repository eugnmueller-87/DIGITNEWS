import { AccountMenu } from "@/components/account-menu";
import { AppNav, type NavItem } from "@/components/app-nav";
import {
  BottomNav,
  type BottomNavItem,
  type BottomNavFab,
} from "@/components/bottom-nav";
import { SunLogo } from "@/components/sun-logo";
import { brand } from "@/config/brand";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Authenticated app shell. requireSession() guarantees a logged-in user WITH a
 * profile reaches any (app) page; otherwise redirect to /login.
 *
 * Layout: a sticky top bar with the org name + account menu, and a primary nav
 * row below (member sections, then admin/operator sections after a divider). The
 * nav scrolls horizontally on phones instead of wrapping.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("name")
    .eq("id", session.orgId)
    .maybeSingle();

  const isAdmin = session.role === "admin" || session.role === "superadmin";
  const isSuperadmin = session.role === "superadmin";

  const memberNav: NavItem[] = [
    { href: "/feed", label: "Feed" },
    { href: "/essensplan", label: "Essensplan" },
    { href: "/rueckblick", label: "Rückblick" },
    { href: "/kalender", label: "Kalender" },
  ];

  const adminNav: NavItem[] = [];
  if (isAdmin) {
    adminNav.push(
      { href: "/aufnahme", label: "Aufnahme" },
      { href: "/review", label: "Prüfen" },
      { href: "/admin/mitglieder", label: "Mitglieder" },
    );
  }
  if (isSuperadmin) {
    adminNav.push({ href: "/operator", label: "Operator" });
  }

  // Phone bottom bar: exactly FOUR thumb-sized tabs per role, with secondary
  // destinations collapsed into "Mehr" so the bar never crowds. Admins also get
  // a raised camera FAB — capture is their one primary action, kept distinct
  // from the four destination tabs (not buried as a tab). The top pill nav
  // remains the complete list on desktop.
  //   Eltern: Feed · Essen · Kalender · Mehr
  //   Team:   Feed · Prüfen · Mitglieder · Mehr   (+ camera FAB)
  const bottomNav: BottomNavItem[] = isAdmin
    ? [
        { href: "/feed", label: "Feed", icon: "feed" },
        { href: "/review", label: "Prüfen", icon: "review" },
        { href: "/admin/mitglieder", label: "Mitglieder", icon: "members" },
        { href: "/mehr", label: "Mehr", icon: "more" },
      ]
    : [
        { href: "/feed", label: "Feed", icon: "feed" },
        { href: "/essensplan", label: "Essen", icon: "meal" },
        { href: "/kalender", label: "Kalender", icon: "calendar" },
        { href: "/mehr", label: "Mehr", icon: "more" },
      ];

  // Staff capture FAB — the one raised primary action on a phone.
  const bottomFab: BottomNavFab | undefined = isAdmin
    ? { href: "/aufnahme", label: "Aushang aufnehmen", icon: "capture" }
    : undefined;

  return (
    <div className="relative z-[1] flex min-h-full flex-col">
      <header className="pt-safe sticky top-0 z-10 border-b border-border bg-paper/90 backdrop-blur">
        <div className="px-content mx-auto w-full max-w-3xl">
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <SunLogo className="h-11 w-11 shrink-0" />
              <span className="min-w-0">
                <span className="font-display block truncate text-lg font-bold leading-tight text-ink">
                  {org?.name ?? brand.name}
                </span>
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
                  Kita-Infos für Eltern
                </span>
              </span>
            </div>
            <AccountMenu role={session.role} />
          </div>
          <div className="pb-2">
            <AppNav items={memberNav} adminItems={adminNav} />
          </div>
        </div>
      </header>

      <main className="px-content mx-auto w-full max-w-3xl flex-1 py-6">
        {children}
      </main>

      <footer className="pb-safe px-content relative mt-10 border-t border-border bg-paper py-6 text-ink-soft">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <span className="font-display text-lg font-bold text-ink">
            {brand.name}
          </span>
          <span className="text-sm font-semibold">{brand.footerPitch}</span>
        </div>
      </footer>

      {/* Reserve space on phones so the fixed bottom bar never covers the
          footer. ~64px bar + the home-indicator inset. Zero on >=sm. */}
      <div
        aria-hidden
        className="pb-safe h-16 sm:hidden"
        style={{ contain: "strict" }}
      />

      <BottomNav items={bottomNav} fab={bottomFab} />
    </div>
  );
}
