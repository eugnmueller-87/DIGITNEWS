import { requireAdmin } from "@/lib/auth";

/**
 * Authoritative admin gate. Every page under /admin passes through here. This is
 * the DB-backed role check (is the caller an admin?), independent of any
 * middleware header. Non-admins are redirected to /feed; unauthenticated users
 * to /login. This is the real authorization boundary for admin routes.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
