import { requireSuperadmin } from "@/lib/auth";

/**
 * Authoritative operator gate. Every /operator page passes through here — the
 * DB-backed superadmin check, independent of any middleware header. Non-
 * superadmins are redirected to /feed, unauthenticated users to /login.
 */
export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperadmin();
  return <>{children}</>;
}
