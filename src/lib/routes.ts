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
    "/set-password", // invite/recovery landing — needs a link-issued session, not a profile
    "/passwort-vergessen", // request a password-reset link
    "/datenschutz", // Datenschutzerklärung — the one intentionally public legal page
    "/offline", // PWA offline fallback shell
  ],
  prefixes: [
    "/auth/", // /auth/callback — magic-link landing
    "/api/ics/", // calendar subscription (token-guarded, not session-guarded)
    "/apply/", // QR self-apply: /apply/[code] + /apply/verify (token-guarded)
    "/api/worker/", // worker callback (shared-secret-guarded, server-to-server)
  ],
} as const;

/**
 * Admin-or-above path prefixes (member access denied even when logged in). The
 * authoritative role check lives in the route-group layouts (requireAdmin /
 * requireSuperadmin); middleware only flags these coarsely.
 */
export const ADMIN_ROUTES = {
  prefixes: ["/admin", "/review"],
} as const;

/** Superadmin-only path prefixes (the operator surface). */
export const SUPERADMIN_ROUTES = {
  prefixes: ["/operator"],
} as const;

/**
 * Stable public legal paths, for store-listing forms and footers. These are a
 * subset of PUBLIC_ROUTES.exact (reachable without auth). The absolute URL is
 * `${publicEnv.siteUrl}${LEGAL_PATHS.privacy}` — the store console wants a fully
 * qualified https URL. Keep the PATH here (single source); compose the origin at
 * the call site so it follows the deployment env.
 */
export const LEGAL_PATHS = {
  /** Datenschutzerklärung — the privacy policy URL stores require. */
  privacy: "/datenschutz",
} as const;

export function isPublicPath(pathname: string): boolean {
  if (
    PUBLIC_ROUTES.exact.includes(
      pathname as (typeof PUBLIC_ROUTES.exact)[number],
    )
  ) {
    return true;
  }
  return PUBLIC_ROUTES.prefixes.some((p) => pathname.startsWith(p));
}

export function isAdminPath(pathname: string): boolean {
  return ADMIN_ROUTES.prefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function isSuperadminPath(pathname: string): boolean {
  return SUPERADMIN_ROUTES.prefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
