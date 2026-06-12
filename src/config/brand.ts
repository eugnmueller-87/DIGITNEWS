/**
 * Brand configuration — the SINGLE source of truth for all naming/branding.
 *
 * Final naming is TBD (working title: "Aushang"). Renaming the product must be a
 * one-file change: edit the values below and nothing else. Do NOT hardcode the
 * brand name anywhere else in the codebase — always import from here.
 *
 * @see Foundation Brief §1 (working title) and §10 (footer growth loop).
 */

export const brand = {
  /** Primary product name, shown in UI chrome, titles, emails. */
  name: "Aushang",

  /** One-line positioning statement (German). */
  tagline: "Digitalisierung ohne Prozessänderung.",

  /**
   * Short descriptor used in the email footer growth loop.
   * Rendered as: "Powered by {name} — {footerPitch}".
   * @see Brief §10.
   */
  footerPitch: "Aushang digital für deine Organisation",

  /** Sender display name for transactional/digest email (Resend). */
  emailFromName: "Aushang",

  /**
   * Production domain (no scheme). Used for redirect allowlisting, canonical
   * URLs, and ICS PRODID. Override per-environment via NEXT_PUBLIC_SITE_URL.
   */
  productionHost: "aushang.app",

  /** Support / contact address surfaced in legal pages and email footers. */
  supportEmail: "hallo@aushang.app",
} as const;

export type Brand = typeof brand;
