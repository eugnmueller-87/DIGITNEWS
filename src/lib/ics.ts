import "server-only";

import { randomBytes } from "node:crypto";

import { brand } from "@/config/brand";
import { buildVCalendar, type IcsEvent } from "@/lib/ics-format";
import { createAdminClient } from "@/lib/supabase/admin";

/** Per-user ICS calendar subscription: token mgmt + VCALENDAR generation. */

export async function createIcsToken(actorId: string): Promise<string> {
  const admin = createAdminClient();
  const token = randomBytes(24).toString("base64url"); // ~192-bit
  const { error } = await admin.rpc("create_ics_token", {
    p_actor_id: actorId,
    p_token: token,
  });
  if (error) throw new Error("Konnte Kalender-Abo nicht erstellen.");
  return token;
}

export async function revokeIcsTokens(actorId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("revoke_ics_tokens", {
    p_actor_id: actorId,
  });
  if (error) throw new Error("Konnte Abo nicht widerrufen.");
}

/** The caller's active (non-revoked) token, or null. */
export async function getActiveIcsToken(
  actorId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ics_tokens")
    .select("token")
    .eq("profile_id", actorId)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.token ?? null;
}

/** Build a VCALENDAR body for an org's events resolved from a token. */
export async function buildIcsForToken(token: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: orgId } = await admin.rpc("resolve_ics_token", {
    p_token: token,
  });
  if (!orgId) return null;

  const { data } = await admin
    .from("events")
    .select(
      "id, title, category, starts_on, ends_on, all_day, time_start, time_end, status, ics_sequence",
    )
    .eq("org_id", orgId)
    .in("status", ["confirmed", "cancelled"])
    .limit(1000);

  const events = (data ?? []) as IcsEvent[];
  return buildVCalendar(events, {
    prodId: `-//${brand.name}//Kalender//DE`,
    calName: brand.name,
    uidHost: brand.productionHost,
  });
}
