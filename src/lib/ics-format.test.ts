import { describe, expect, it } from "vitest";

import {
  allDayDtEnd,
  buildVCalendar,
  eventToVeventLines,
  icsEscape,
  ymd,
  type IcsEvent,
} from "@/lib/ics-format";

function ev(over: Partial<IcsEvent>): IcsEvent {
  return {
    id: over.id ?? "11111111-1111-1111-1111-111111111111",
    title: over.title ?? "Sommerfest",
    category: over.category ?? "event",
    starts_on: over.starts_on ?? "2026-07-01",
    ends_on: over.ends_on ?? null,
    all_day: over.all_day ?? true,
    time_start: over.time_start ?? null,
    time_end: over.time_end ?? null,
    status: over.status ?? "confirmed",
    ics_sequence: over.ics_sequence ?? 0,
  };
}

describe("icsEscape / ymd", () => {
  it("escapes backslash, semicolon, comma, newline", () => {
    expect(icsEscape("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
  });
  it("strips dashes from an ISO date", () => {
    expect(ymd("2026-07-01")).toBe("20260701");
  });
});

describe("allDayDtEnd (exclusive end = last day + 1)", () => {
  it("adds one day, rolling month/year and leap day", () => {
    expect(allDayDtEnd("2026-07-01")).toBe("2026-07-02");
    expect(allDayDtEnd("2026-07-31")).toBe("2026-08-01");
    expect(allDayDtEnd("2026-12-31")).toBe("2027-01-01");
    expect(allDayDtEnd("2028-02-29")).toBe("2028-03-01");
  });
});

describe("eventToVeventLines", () => {
  it("emits an all-day event with an exclusive DATE DTEND", () => {
    const lines = eventToVeventLines(
      ev({ all_day: true }),
      "kita-connect.cloud",
    );
    expect(lines).toContain("DTSTART;VALUE=DATE:20260701");
    expect(lines).toContain("DTEND;VALUE=DATE:20260702");
  });

  it("uses the all-day path when no time is set even if all_day is false", () => {
    const lines = eventToVeventLines(
      ev({ all_day: false, time_start: null }),
      "h",
    );
    expect(lines.some((l) => l.startsWith("DTSTART;VALUE=DATE:"))).toBe(true);
  });

  it("emits a timed event with DATE-TIME DTSTART/DTEND", () => {
    const lines = eventToVeventLines(
      ev({ all_day: false, time_start: "09:30", time_end: "11:00" }),
      "h",
    );
    expect(lines).toContain("DTSTART:20260701T093000");
    expect(lines).toContain("DTEND:20260701T110000");
  });

  it("falls back to time_start for the end when time_end is absent", () => {
    const lines = eventToVeventLines(
      ev({ all_day: false, time_start: "09:30", time_end: null }),
      "h",
    );
    expect(lines).toContain("DTEND:20260701T093000");
  });

  it("namespaces the UID, escapes SUMMARY, maps cancelled status", () => {
    expect(eventToVeventLines(ev({ id: "abc" }), "example.test")).toContain(
      "UID:abc@example.test",
    );
    expect(eventToVeventLines(ev({ title: "A; B, C" }), "h")).toContain(
      "SUMMARY:A\\; B\\, C",
    );
    expect(eventToVeventLines(ev({ status: "cancelled" }), "h")).toContain(
      "STATUS:CANCELLED",
    );
    expect(eventToVeventLines(ev({ status: "pending" }), "h")).toContain(
      "STATUS:CONFIRMED",
    );
  });
});

describe("buildVCalendar", () => {
  const meta = {
    prodId: "-//Aushang//Kalender//DE",
    calName: "Aushang",
    uidHost: "kita-connect.cloud",
  };

  it("wraps events in a CRLF-terminated VCALENDAR", () => {
    const out = buildVCalendar([ev({})], meta);
    expect(out.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(out).toContain("PRODID:-//Aushang//Kalender//DE");
  });

  it("emits one VEVENT per event; header-only for no events", () => {
    expect(
      (
        buildVCalendar([ev({ id: "a" }), ev({ id: "b" })], meta).match(
          /BEGIN:VEVENT/g,
        ) ?? []
      ).length,
    ).toBe(2);
    expect(buildVCalendar([], meta)).not.toContain("BEGIN:VEVENT");
  });
});
