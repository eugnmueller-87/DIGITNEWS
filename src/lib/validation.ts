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
