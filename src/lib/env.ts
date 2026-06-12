/**
 * PUBLIC environment — safe to read from anywhere (client or server).
 *
 * Only NEXT_PUBLIC_* values live here. Importing this file into a client
 * component is fine and intended. Never add a secret here.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    // Fail fast and loudly during build/boot rather than at a random runtime
    // call site. Misconfiguration should never silently degrade security.
    throw new Error(`Missing required public env var: ${name}`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  /** Canonical origin, e.g. https://aushang.app — used for redirect URLs. */
  siteUrl: required(
    "NEXT_PUBLIC_SITE_URL",
    process.env.NEXT_PUBLIC_SITE_URL,
  ).replace(/\/$/, ""),

  /**
   * Web Push VAPID PUBLIC key — needed by the browser to subscribe. Public by
   * design. Empty string when push isn't configured (the UI then hides push).
   */
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
} as const;
