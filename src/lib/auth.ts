import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "member";

export interface SessionProfile {
  userId: string;
  email: string | null;
  orgId: string;
  role: Role;
  displayName: string | null;
}

/**
 * Resolve the current authenticated user AND their profile (org + role).
 *
 * Uses getUser() (JWT validated against the auth server) — never getSession()
 * for authz. Reads the profile through the RLS-governed server client, so it
 * can only ever return the caller's own profile. Returns null when there is no
 * authenticated user OR no profile yet (e.g. authenticated but mid-onboarding,
 * before a profile exists).
 *
 * This is the authoritative authorization primitive. Middleware is a coarse
 * gate; THIS is the boundary every protected route must pass through.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("org_id, role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    orgId: profile.org_id,
    role: profile.role as Role,
    displayName: profile.display_name,
  };
}

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
 * Require an authenticated ADMIN. Redirects unauthenticated users to /login and
 * non-admins to /feed. This is the authoritative role check (DB-backed),
 * independent of any middleware header.
 */
export async function requireAdmin(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/feed");
  return session;
}

/**
 * For an authenticated user who does NOT yet have a profile (mid-onboarding):
 * returns the bare auth user id/email, or null if not authenticated at all.
 * Used by the onboarding callback to bind a new profile to the auth user.
 */
export async function getAuthUserWithoutProfile(): Promise<{
  userId: string;
  email: string | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id, email: user.email ?? null };
}
