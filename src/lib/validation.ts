/**
 * Lightweight input validation. Hand-rolled to keep the dependency surface
 * minimal (Brief §11). Returns normalized values or throws a user-safe Error.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? "").trim().toLowerCase();
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
 * Invite codes are <slug>-<hex>. Restrict to a safe charset and length so a
 * crafted code can't be used for injection in URLs/logs. Validation only — the
 * authoritative check is the DB lookup.
 */
export function parseInviteCode(raw: string): string {
  const value = String(raw ?? "").trim().toLowerCase();
  // Upper bound 96 comfortably exceeds the max minted code (slug capped at 40 in
  // create_org_and_admin + '-' + 12 hex), so valid codes are never rejected.
  if (!/^[a-z0-9-]{4,96}$/.test(value)) {
    throw new Error("Ungültiger Einladungscode.");
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
