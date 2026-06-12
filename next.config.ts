import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * Brief §11 hardening: noindex/nofollow globally (this is a private tool — the
 * only intentionally-public pages are /login, /join, /start, /api/ics, and the
 * Datenschutzerklärung, none of which we want indexed in v1). Plus the standard
 * hardening header set. A strict CSP is intentionally deferred to a later pass
 * once the full asset/script inventory (Supabase, fonts) is known — shipping a
 * broken-strict CSP now would be worse than a documented TODO.
 */
// Content-Security-Policy, shipped in REPORT-ONLY mode first (Brief §11 defense
// in depth). Report-only does not block, so it cannot break the app while we
// confirm the asset/script inventory (Supabase, Google Fonts). Promote to the
// enforcing `Content-Security-Policy` header — and tighten script-src with a
// nonce — once verified. connect-src allows Supabase; style-src allows inline
// (Tailwind/Next inject some inline styles); img-src allows data: for icons.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
].join("; ");

const securityHeaders = [
  // Keep the entire app out of search indexes (defense-in-depth with robots.txt).
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  // CSP in report-only mode (see note above).
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
  // Disallow embedding in iframes (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Don't sniff MIME types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send only the origin on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop access to powerful browser features we never use (camera is requested
  // via <input capture> which does not need Permissions-Policy grant).
  {
    key: "Permissions-Policy",
    value: "geolocation=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  // Force HTTPS for two years incl. subdomains (only meaningful over TLS).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Fail the production build on type errors (no silent ignores). In Next 16
  // ESLint is no longer run by `next build`; lint is a separate CI step
  // (`npm run lint`), so there is no `eslint` config block here anymore.
  typescript: { ignoreBuildErrors: false },

  // No telemetry / third-party analytics in v1 (Brief §11, §14). Next.js
  // telemetry is disabled via NEXT_TELEMETRY_DISABLED in CI; documented in README.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
