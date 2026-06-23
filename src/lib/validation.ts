/**
 * Lightweight input validation. Hand-rolled to keep the dependency surface
 * minimal (Brief §11). Returns normalized values or throws a user-safe Error.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(value) || value.length > 254) {
    throw new Error("Bitte gib eine gültige E-Mail-Adresse ein.");
  }
  return value;
}

export function parseNonEmpty(
  raw: FormDataEntryValue | null,
  field: string,
  max = 200,
): string {
  const value = String(raw ?? "").trim();
  if (value.length === 0) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
  if (value.length > max) {
    throw new Error(`${field} ist zu lang (max. ${max} Zeichen).`);
  }
  return value;
}

export const ORG_TYPES = [
  { value: "kita", label: "Kita" },
  { value: "verein", label: "Verein" },
  { value: "kirche", label: "Kirchengemeinde" },
  { value: "betrieb", label: "Betrieb / Unternehmen" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

export function parseOrgType(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? "");
  if (!ORG_TYPES.some((t) => t.value === value)) {
    throw new Error("Bitte wähle eine gültige Organisationsart.");
  }
  return value;
}

/**
 * Join code embedded in a QR (e.g. "jc-<base64url>"). Restrict to a safe charset
 * and length so a crafted value can't be used for injection in URLs/logs. The
 * authoritative check is the server-side DB lookup.
 */
export function parseJoinCode(raw: string): string {
  const value = String(raw ?? "").trim();
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(value)) {
    throw new Error("Ungültiger Code.");
  }
  return value;
}

/**
 * Parse the role an admin/operator assigns when adding a person. The form may
 * offer 'member' (admins) or 'admin' (superadmins). 'superadmin' is never
 * settable here — it is granted only via ensure_superadmin / set_admin flows.
 */
export function parseAssignableRole(
  raw: FormDataEntryValue | null,
  allowAdmin: boolean,
): "admin" | "member" {
  const value = String(raw ?? "member");
  if (value === "admin") {
    if (!allowAdmin) {
      throw new Error("Nicht berechtigt, Admins hinzuzufügen.");
    }
    return "admin";
  }
  if (value === "member") return "member";
  throw new Error("Ungültige Rolle.");
}

export const EVENT_CATEGORIES = ["closure", "event", "deadline"] as const;
export type EventCategoryValue = (typeof EVENT_CATEGORIES)[number];

/** Parse a calendar-event category (events.category CHECK). */
export function parseEventCategory(
  raw: FormDataEntryValue | null,
): EventCategoryValue {
  const value = String(raw ?? "");
  if (!(EVENT_CATEGORIES as readonly string[]).includes(value)) {
    throw new Error("Bitte wähle eine gültige Kategorie.");
  }
  return value as EventCategoryValue;
}

/**
 * Parse a civil (zoneless) ISO date `YYYY-MM-DD`. The whole calendar stack works
 * on plain strings, never `new Date(iso)` (which parses as UTC midnight and
 * shifts a day for viewers west of UTC) — so we validate the STRING shape and
 * a real calendar date without constructing a zoned Date. `required=false`
 * returns null for an empty value (optional end date / times).
 */
export function parseIsoDate(
  raw: FormDataEntryValue | null,
  field: string,
  required = true,
): string | null {
  const value = String(raw ?? "").trim();
  if (value.length === 0) {
    if (required) throw new Error(`${field} darf nicht leer sein.`);
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error(`${field} ist kein gültiges Datum.`);
  const [, y, mo, d] = m;
  const month = Number(mo);
  const day = Number(d);
  // Real-date check without timezone-shifting Date parsing.
  const daysInMonth = [
    31,
    Number(y) % 4 === 0 && (Number(y) % 100 !== 0 || Number(y) % 400 === 0)
      ? 29
      : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throw new Error(`${field} ist kein gültiges Datum.`);
  }
  return value;
}

/** Parse a civil `HH:MM` time (24h). Empty → null. */
export function parseIsoTime(
  raw: FormDataEntryValue | null,
  field: string,
): string | null {
  const value = String(raw ?? "").trim();
  if (value.length === 0) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error(`${field} ist keine gültige Uhrzeit.`);
  }
  return value;
}

/**
 * Sanitize a post-login redirect target. Only allow same-origin absolute paths
 * (start with a single "/", not "//" which is protocol-relative). Prevents open
 * redirects. Falls back to /feed.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/feed";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/feed";
  // Disallow control chars / backslashes.
  if (/[\x00-\x1f\\]/.test(raw)) return "/feed";
  return raw;
}
