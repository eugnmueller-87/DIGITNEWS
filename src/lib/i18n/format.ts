import type { Dict } from "./dictionaries";
import type { Locale } from "./types";

/**
 * Fill {placeholders} in a dictionary string. Unknown keys are left as-is so a
 * missing var is visible, not silently dropped. e.g.
 *   fmt(t.review.toCheck, { count: 3 }) -> "Zu prüfen · 3"
 */
export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

/**
 * Format a "YYYY-MM-DD" date string for display. We string-split rather than
 * `new Date(iso)` so a date never shifts a day (a bare ISO date parses as UTC
 * midnight, which renders as the previous day west of UTC). `long` uses the
 * localized month name; otherwise a numeric short form (DE: dd.mm.yyyy, EN:
 * m/d/yyyy). Returns the input unchanged if it isn't a YYYY-MM-DD string.
 */
export function formatDate(
  iso: string | null | undefined,
  locale: Locale,
  dict: Dict,
  opts?: { long?: boolean; noYear?: boolean },
): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  const day = String(Number(dd));
  if (opts?.long) {
    const month = dict.calendar.months[Number(mm) - 1] ?? mm;
    return locale === "en" ? `${month} ${day}, ${y}` : `${day}. ${month} ${y}`;
  }
  if (opts?.noYear) {
    return locale === "en" ? `${Number(mm)}/${dd}` : `${dd}.${mm}.`;
  }
  return locale === "en" ? `${Number(mm)}/${dd}/${y}` : `${dd}.${mm}.${y}`;
}

/** A date+time stamp (for the review "captured at" line). Locale-aware. */
export function formatDateTime(
  iso: string | null | undefined,
  locale: Locale,
): string {
  if (!iso) return "";
  const d = new Date(iso); // a full timestamp (with time) is unambiguous
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "en" ? "en-US" : "de-DE");
}
