import { AccountMenu } from "@/components/account-menu";
import { AppNav, type NavItem } from "@/components/app-nav";
import { BottomNav, type BottomNavItem } from "@/components/bottom-nav";
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

  // Phone bottom bar: the daily destinations only (max 5 so they stay
  // thumb-sized). Admins swap two member tabs for their workflow tabs
  // (Aufnahme + Prüfen); the top pill nav remains the complete list.
  const bottomNav: BottomNavItem[] = isAdmin
    ? [
        { href: "/feed", label: "Feed", icon: "feed" },
        { href: "/kalender", label: "Kalender", icon: "calendar" },
        { href: "/aufnahme", label: "Aufnahme", icon: "capture" },
        { href: "/review", label: "Prüfen", icon: "review" },
      ]
    : [
        { href: "/feed", label: "Feed", icon: "feed" },
        { href: "/essensplan", label: "Essen", icon: "meal" },
        { href: "/rueckblick", label: "Rückblick", icon: "review" },
        { href: "/kalender", label: "Kalender", icon: "calendar" },
      ];

  return (
    <div className="relative z-[1] flex min-h-full flex-col">
      <header className="pt-safe sticky top-0 z-10 border-b-[3px] border-ink bg-paper/90 backdrop-blur">
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

      <footer className="pb-safe px-content relative mt-10 border-t-[3px] border-ink bg-gradient-to-b from-grass to-grass-deep py-6 text-white">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <span className="font-display text-lg font-bold">
            {brand.name} <span aria-hidden>🌼</span>
          </span>
          <span className="text-sm font-semibold opacity-90">
            {brand.footerPitch}
          </span>
        </div>
      </footer>

      {/* Reserve space on phones so the fixed bottom bar never covers the
          footer. ~64px bar + the home-indicator inset. Zero on >=sm. */}
      <div
        aria-hidden
        className="pb-safe h-16 sm:hidden"
        style={{ contain: "strict" }}
      />

      <BottomNav items={bottomNav} />
    </div>
  );
}
