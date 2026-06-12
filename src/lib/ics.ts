import "server-only";

import { randomBytes } from "node:crypto";

import { brand } from "@/config/brand";
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

interface IcsEvent {
  id: string;
  title: string;
  category: "closure" | "event" | "deadline";
  starts_on: string;
  ends_on: string | null;
  all_day: boolean;
  time_start: string | null;
  time_end: string | null;
  status: "pending" | "confirmed" | "cancelled";
  ics_sequence: number;
}

function icsEscape(s: string): string {
  return s.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

function ymd(iso: string): string {
  return iso.replace(/-/g, "");
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
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${brand.name}//Kalender//DE`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(brand.name)}`,
  ];

  // A fixed DTSTAMP avoids per-request churn; we don't have a request clock here
  // that we want to leak, and SEQUENCE drives client updates instead.
  const stamp = "20260101T000000Z";

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@${brand.productionHost}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`SEQUENCE:${e.ics_sequence}`);
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    lines.push(
      `STATUS:${e.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    );

    if (e.all_day || !e.time_start) {
      // All-day: DTEND is exclusive, so add one day to the end.
      const end = e.ends_on ?? e.starts_on;
      const endDate = new Date(end + "T00:00:00Z");
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const endIso = endDate.toISOString().slice(0, 10);
      lines.push(`DTSTART;VALUE=DATE:${ymd(e.starts_on)}`);
      lines.push(`DTEND;VALUE=DATE:${ymd(endIso)}`);
    } else {
      const day = e.starts_on;
      const start = `${ymd(day)}T${e.time_start.replace(":", "")}00`;
      const endTime = e.time_end ?? e.time_start;
      const endDay = e.ends_on ?? day;
      const end = `${ymd(endDay)}T${endTime.replace(":", "")}00`;
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // ICS lines should be CRLF-terminated.
  return lines.join("\r\n") + "\r\n";
}
