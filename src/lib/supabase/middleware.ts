import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Creates a Supabase client wired to read/write the request+response cookies,
 * and refreshes the session. Returns both the (RLS-governed) client and the
 * response carrying any refreshed auth cookies. The middleware uses this to
 * (a) keep the session fresh and (b) discover whether the user is authenticated
 * for the deny-by-default gate.
 *
 * IMPORTANT: call supabase.auth.getUser() (not getSession()) for the
 * authorization decision — getUser() revalidates the JWT against the auth
 * server, so a forged/expired cookie can't fake a session.
 */
export function createMiddlewareClient(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  return { supabase, response };
}
