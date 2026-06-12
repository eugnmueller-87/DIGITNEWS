import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { brand } from "@/config/brand";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Authenticated app shell. requireSession() guarantees a logged-in user WITH a
 * profile reaches any (app) page; otherwise redirect to /login. We also fetch
 * the org name for the header (RLS lets a member read only their own org).
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3">
          <div className="min-w-0">
            <Link href="/feed" className="block truncate font-semibold">
              {org?.name ?? brand.name}
            </Link>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link
              href="/feed"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Feed
            </Link>
            <Link
              href="/essensplan"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Essensplan
            </Link>
            <Link
              href="/rueckblick"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Rückblick
            </Link>
            {isAdmin && (
              <Link
                href="/aufnahme"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Aufnahme
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/review"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Prüfen
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin/mitglieder"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Mitglieder
              </Link>
            )}
            {isSuperadmin && (
              <Link
                href="/operator"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Operator
              </Link>
            )}
            <SignOutButton />
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        {children}
      </div>
      <footer className="border-t border-zinc-200 px-5 py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">
        {brand.name} — {brand.footerPitch}
      </footer>
    </div>
  );
}
