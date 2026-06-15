/**
 * i18n primitives — dependency-free so any module (incl. auth.ts) can import the
 * Locale type without pulling in the dictionaries or server-only helpers.
 */

export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** Cookie that mirrors the user's choice so public/pre-session renders match. */
export const LOCALE_COOKIE = "locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
