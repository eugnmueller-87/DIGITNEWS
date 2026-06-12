/**
 * Route allowlist — the SINGLE source of truth for which paths are reachable
 * WITHOUT authentication. Everything not matched here is denied by default
 * (redirected to /login) by the middleware. (Brief §2 "deny by default", §11.)
 *
 * Keep this list as small as possible. Adding an entry here is a security
 * decision: it creates a public surface.
 */

/**
 * Exact public paths and public path PREFIXES. A request path is public iff it
 * exactly equals one of `exact` OR starts with one of `prefixes`.
 */
export const PUBLIC_ROUTES = {
  exact: [
    "/login",
    "/start", // org creation entry (further gated by ALLOW_ORG_SIGNUP server-side)
    "/datenschutz", // Datenschutzerklärung — the one intentionally public legal page
  ],
  prefixes: [
    "/join/", // /join/[code] — member onboarding
    "/auth/", // /auth/callback, /auth/confirm — magic-link landing
    "/api/ics/", // calendar subscription (token-guarded, not session-guarded)
  ],
} as const;

/** Admin-only path prefixes (member access here is denied even when logged in). */
export const ADMIN_ROUTES = {
  prefixes: ["/admin", "/review"],
} as const;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_ROUTES.exact.includes(pathname as (typeof PUBLIC_ROUTES.exact)[number])) {
    return true;
  }
  return PUBLIC_ROUTES.prefixes.some((p) => pathname.startsWith(p));
}

export function isAdminPath(pathname: string): boolean {
  return ADMIN_ROUTES.prefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
