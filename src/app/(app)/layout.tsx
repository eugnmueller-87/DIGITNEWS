import { AccountMenu } from "@/components/account-menu";
import { AppNav, type NavItem } from "@/components/app-nav";
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

  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto w-full max-w-2xl px-5">
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-900">
                {(org?.name ?? brand.name).charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-base font-semibold">
                {org?.name ?? brand.name}
              </span>
            </div>
            <AccountMenu role={session.role} />
          </div>
          <div className="pb-2">
            <AppNav items={memberNav} adminItems={adminNav} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        {children}
      </main>

      <footer className="border-t border-zinc-200 px-5 py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">
        {brand.name} — {brand.footerPitch}
      </footer>
    </div>
  );
}
