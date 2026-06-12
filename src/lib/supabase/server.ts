import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";

/**
 * Server Supabase client bound to the current request's auth cookies. Uses the
 * ANON key and acts AS THE LOGGED-IN USER — every query is governed by RLS.
 * This is the default client for server components, server actions, and route
 * handlers. It can NEVER see another org's data; the database enforces that.
 *
 * For the few privileged operations that must bypass RLS (the security-definer
 * onboarding flows), use createAdminClient() from ./admin instead — and only
 * after your own server-side auth + role checks.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` is called from a Server Component where cookies are
          // read-only. This is safe to ignore when a middleware refresh is in
          // place (it refreshes the session cookie on every request).
        }
      },
    },
  });
}
