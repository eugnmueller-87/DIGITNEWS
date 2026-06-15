import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import type { Role, MembershipStatus } from "@/lib/database.types";
import { type Locale, isLocale, DEFAULT_LOCALE } from "@/lib/i18n/types";
import { createClient } from "@/lib/supabase/server";

export type { Role } from "@/lib/database.types";

export interface SessionProfile {
  userId: string;
  email: string | null;
  orgId: string;
  role: Role;
  membershipStatus: MembershipStatus;
  displayName: string | null;
  language: Locale;
}

/**
 * Resolve the current authenticated user AND their profile (org + role).
 *
 * Uses getUser() (JWT validated against the auth server) — never getSession()
 * for authz. Reads the profile through the RLS-governed server client, so it can
 * only ever return the caller's own profile. Returns null when there is no
 * authenticated user OR no profile yet (an authenticated user without a profile
 * has not been provisioned by an operator/admin).
 *
 * This is the authoritative authorization primitive. Middleware is a coarse
 * gate; THIS is the boundary every protected route must pass through.
 *
 * Wrapped in React `cache()` so that the layout, the page, and any child server
 * components that each call requireSession()/requireAdmin() within ONE request
 * share a single getUser() + profiles lookup instead of repeating both 2–3×.
 * cache() scopes per request render, so this never leaks across users/requests.
 */
export const getSessionProfile = cache(
  async function getSessionProfile(): Promise<SessionProfile | null> {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("org_id, role, membership_status, display_name, language")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) return null;

    return {
      userId: user.id,
      email: user.email ?? null,
      orgId: profile.org_id,
      role: profile.role as Role,
      membershipStatus: profile.membership_status as MembershipStatus,
      displayName: profile.display_name,
      language: isLocale(profile.language) ? profile.language : DEFAULT_LOCALE,
    };
  },
);

/**
 * Require an authenticated user WITH a profile. Redirects to /login if absent.
 * Use at the top of every protected server component / route handler.
 */
export async function requireSession(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  return session;
}

/**
 * Require an authenticated ADMIN-OR-ABOVE (admin or superadmin). Redirects
 * unauthenticated users to /login and members to /feed. Authoritative DB-backed
 * check, independent of any middleware header.
 */
export async function requireAdmin(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "superadmin") {
    redirect("/feed");
  }
  return session;
}

/**
 * Require an authenticated SUPERADMIN (the operator). Redirects unauthenticated
 * users to /login and everyone else to /feed.
 */
export async function requireSuperadmin(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.role !== "superadmin") redirect("/feed");
  return session;
}

export function isAdminOrAbove(role: Role): boolean {
  return role === "admin" || role === "superadmin";
}
