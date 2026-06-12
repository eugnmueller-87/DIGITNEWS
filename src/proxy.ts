import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { isPublicPath, isAdminPath, isSuperadminPath } from "@/lib/routes";

/**
 * DENY-BY-DEFAULT middleware (Brief §2, §5, §11).
 *
 * Flow for every request the matcher lets through:
 *   1. Refresh the Supabase session (rotates cookies onto the response).
 *   2. Resolve the user via getUser() — this VALIDATES the JWT with the auth
 *      server, so a tampered cookie cannot fake a session.
 *   3. If the path is public (allowlist) -> allow.
 *   4. If there is no authenticated user -> redirect to /login (preserving the
 *      intended destination as ?next=).
 *   5. If the path is admin-only, role is checked SERVER-SIDE in the route/layout
 *      (middleware can't cheaply read the DB role here without an extra query;
 *      we keep middleware coarse and enforce role at the data boundary). The
 *      admin route group's layout performs the authoritative is_admin() check.
 *
 * NOTE: middleware is a coarse gate, NOT the authorization boundary. Every route
 * handler / server action still performs its own session + role + org check, and
 * RLS is the final backstop. This is intentional defense-in-depth.
 */
export async function proxy(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  // Always attempt a session refresh so downstream server components get fresh
  // cookies. Do this even for public paths to keep the session warm. If the auth
  // server is unreachable, treat the request as UNAUTHENTICATED (fail closed) —
  // never fall through to a protected route on error.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] =
    null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null; // fail closed: no user => protected paths redirect to /login
  }

  const { pathname } = request.nextUrl;

  // Public allowlist — always reachable.
  if (isPublicPath(pathname)) {
    // If an already-authenticated user hits /login, send them home.
    if (user && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/feed";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Everything else requires authentication.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve where they were headed (path only — never echo arbitrary host).
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Authenticated. Role enforcement for admin/superadmin paths is delegated to
  // the route-group layouts (authoritative DB checks). Mark the request coarsely
  // for observability, but do NOT trust these headers for authz.
  if (isSuperadminPath(pathname)) {
    response.headers.set("x-aushang-superadmin-route", "1");
  } else if (isAdminPath(pathname)) {
    response.headers.set("x-aushang-admin-route", "1");
  }

  return response;
}

/**
 * Matcher: run middleware on everything EXCEPT static assets and image
 * optimization. We DO run it on /api/* (those handlers also self-check). We do
 * NOT exclude routes here for auth purposes — exclusion happens via the
 * allowlist in code, so a forgotten route fails closed (gets gated) rather than
 * open.
 */
export const config = {
  matcher: [
    // Match all request paths except the static internals and common asset
    // files. Note: this is a PERFORMANCE exclusion, not an AUTH exclusion.
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|sw.js|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
