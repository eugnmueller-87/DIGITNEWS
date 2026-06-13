/**
 * Pure ICS (RFC 5545) formatting — no DB, no `server-only`, so it is unit
 * testable. `ics.ts` owns the token/DB plumbing and delegates the VCALENDAR
 * body construction here.
 *
 * Dates are civil ISO `YYYY-MM-DD` strings. The one place we touch `Date` is the
 * all-day DTEND (which is EXCLUSIVE in iCalendar, so the last day + 1): we pin
 * it to UTC explicitly (`T00:00:00Z` + getUTCDate) so the +1 never lands on the
 * wrong day for a viewer in any zone.
 */

export interface IcsEvent {
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

export interface IcsCalendarMeta {
  prodId: string;
  calName: string;
  /** Host used to namespace UIDs, e.g. "kita-connect.cloud". */
  uidHost: string;
}

/** Fixed DTSTAMP — SEQUENCE drives client updates, so no per-request clock. */
const DTSTAMP = "20260101T000000Z";

export function icsEscape(s: string): string {
  return s.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

/** ISO `YYYY-MM-DD` → `YYYYMMDD` (the iCalendar DATE form). */
export function ymd(iso: string): string {
  return iso.replace(/-/g, "");
}

/** All-day DTEND is exclusive: the inclusive last day + 1, computed in UTC. */
export function allDayDtEnd(lastDayIso: string): string {
  const endDate = new Date(lastDayIso + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return endDate.toISOString().slice(0, 10);
}

/** The VEVENT block lines for one event (no CRLF joining — caller assembles). */
export function eventToVeventLines(e: IcsEvent, uidHost: string): string[] {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${e.id}@${uidHost}`,
    `DTSTAMP:${DTSTAMP}`,
    `SEQUENCE:${e.ics_sequence}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `STATUS:${e.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
  ];

  if (e.all_day || !e.time_start) {
    // All-day: DTEND is exclusive, so add one day to the (inclusive) end.
    const end = e.ends_on ?? e.starts_on;
    lines.push(`DTSTART;VALUE=DATE:${ymd(e.starts_on)}`);
    lines.push(`DTEND;VALUE=DATE:${ymd(allDayDtEnd(end))}`);
  } else {
    const start = `${ymd(e.starts_on)}T${e.time_start.replace(":", "")}00`;
    const endTime = e.time_end ?? e.time_start;
    const endDay = e.ends_on ?? e.starts_on;
    const end = `${ymd(endDay)}T${endTime.replace(":", "")}00`;
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

/** Build the full VCALENDAR body (CRLF-terminated, per RFC 5545). */
export function buildVCalendar(
  events: readonly IcsEvent[],
  meta: IcsCalendarMeta,
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${meta.prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(meta.calName)}`,
  ];
  for (const e of events) lines.push(...eventToVeventLines(e, meta.uidHost));
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
