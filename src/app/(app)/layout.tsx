import { CaptureLauncher } from "@/app/(app)/aufnahme/capture-launcher";
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
 * Mobile-first chrome: a frosted sticky top bar (logo + org name + account),
 * and a phone-only bottom tab bar (4 tabs per role) + a staff capture FAB. The
 * horizontal pill nav (AppNav) is desktop-only (≥sm). Role is resolved here on
 * the server; the bottom nav + FAB visibility derive from it — no client role
 * logic.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const isAdmin = session.role === "admin" || session.role === "superadmin";
  const isSuperadmin = session.role === "superadmin";

  const supabase = await createClient();
  // Org name + (for admins) the pending-draft count for the Prüfen tab badge.
  // RLS scopes the posts read to the caller's own org.
  const [{ data: org }, draftCountResult] = await Promise.all([
    supabase.from("orgs").select("name").eq("id", session.orgId).maybeSingle(),
    isAdmin
      ? supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("status", "draft")
      : Promise.resolve({ count: 0 }),
  ]);
  const draftCount = draftCountResult.count ?? 0;

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

  // Phone bottom bar: exactly FOUR thumb-sized tabs per role; secondary
  // destinations live in "Mehr". Admins get a raised capture FAB (CaptureLauncher)
  // and a draft-count badge on Prüfen.
  //   Eltern: Feed · Essen · Kalender · Mehr
  //   Team:   Feed · Prüfen · Mitglieder · Mehr   (+ capture FAB)
  const bottomNav: BottomNavItem[] = isAdmin
    ? [
        { href: "/feed", label: "Feed", icon: "feed" },
        { href: "/review", label: "Prüfen", icon: "review", badge: draftCount },
        { href: "/admin/mitglieder", label: "Mitglieder", icon: "members" },
        { href: "/mehr", label: "Mehr", icon: "more" },
      ]
    : [
        { href: "/feed", label: "Feed", icon: "feed" },
        { href: "/essensplan", label: "Essen", icon: "meal" },
        { href: "/kalender", label: "Kalender", icon: "calendar" },
        { href: "/mehr", label: "Mehr", icon: "more" },
      ];

  return (
    <div className="relative z-[1] flex min-h-full flex-col">
      <header className="pt-safe sticky top-0 z-10 border-b border-border bg-paper/85 backdrop-blur-xl">
        <div className="px-content mx-auto w-full max-w-3xl">
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <SunLogo className="h-9 w-9 shrink-0" />
              <span className="font-display min-w-0 truncate text-[17px] font-bold leading-tight text-ink">
                {org?.name ?? brand.name}
              </span>
            </div>
            <AccountMenu role={session.role} />
          </div>
          {/* Desktop primary nav only — phone uses the bottom bar. */}
          <div className="hidden pb-2 sm:block">
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

      <BottomNav items={bottomNav} />
      {isAdmin && <CaptureLauncher />}
    </div>
  );
}
