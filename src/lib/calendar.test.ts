import { describe, expect, it } from "vitest";

import {
  anchorMonth,
  covers,
  currentMonth,
  isoOf,
  monthGrid,
  nextMonth,
  prevMonth,
  sortByStart,
  type DateSpan,
} from "@/lib/calendar";

describe("covers", () => {
  const single: DateSpan = { starts_on: "2026-03-10", ends_on: null };
  const range: DateSpan = { starts_on: "2026-03-10", ends_on: "2026-03-12" };

  it("matches the exact single day", () => {
    expect(covers(single, "2026-03-10")).toBe(true);
  });
  it("does not match adjacent days for a single-day event", () => {
    expect(covers(single, "2026-03-09")).toBe(false);
    expect(covers(single, "2026-03-11")).toBe(false);
  });
  it("is inclusive on both ends of a range", () => {
    expect(covers(range, "2026-03-10")).toBe(true);
    expect(covers(range, "2026-03-11")).toBe(true);
    expect(covers(range, "2026-03-12")).toBe(true);
  });
  it("excludes the day after a range", () => {
    expect(covers(range, "2026-03-13")).toBe(false);
  });
});

describe("isoOf", () => {
  it("zero-pads month and day", () => {
    expect(isoOf(2026, 0, 1)).toBe("2026-01-01");
    expect(isoOf(2026, 11, 31)).toBe("2026-12-31");
  });
});

describe("anchorMonth", () => {
  it("anchors on the first event's month parsed from the string", () => {
    expect(anchorMonth("2026-02-01", { y: 2000, m: 0 })).toEqual({
      y: 2026,
      m: 1,
    });
  });

  it("REGRESSION: does not shift the month across the UTC boundary", () => {
    // `new Date("2026-02-01").getMonth()` is January (0) for viewers west of UTC
    // because the string parses as UTC midnight. String parsing avoids that.
    expect(anchorMonth("2026-02-01", { y: 2000, m: 0 })).toEqual({
      y: 2026,
      m: 1,
    });
  });

  it("falls back when there is no event or the date is malformed", () => {
    expect(anchorMonth(undefined, { y: 2026, m: 5 })).toEqual({
      y: 2026,
      m: 5,
    });
    expect(anchorMonth("not-a-date", { y: 2026, m: 5 })).toEqual({
      y: 2026,
      m: 5,
    });
  });
});

describe("currentMonth", () => {
  it("returns the local-time year and 0-based month of the given date", () => {
    // Use a local-time constructor (y, m, d) so the test is timezone-stable:
    // it asserts the same fields it reads back, regardless of the viewer's zone.
    expect(currentMonth(new Date(2026, 5, 23))).toEqual({ y: 2026, m: 5 });
    expect(currentMonth(new Date(2027, 0, 1))).toEqual({ y: 2027, m: 0 });
    expect(currentMonth(new Date(2025, 11, 31))).toEqual({ y: 2025, m: 11 });
  });
});

describe("prevMonth / nextMonth", () => {
  it("rolls the year back at January and forward at December", () => {
    expect(prevMonth({ y: 2026, m: 0 })).toEqual({ y: 2025, m: 11 });
    expect(nextMonth({ y: 2026, m: 11 })).toEqual({ y: 2027, m: 0 });
  });
  it("is reversible mid-year", () => {
    const c = { y: 2026, m: 5 };
    expect(prevMonth(nextMonth(c))).toEqual(c);
  });
});

describe("monthGrid", () => {
  it("starts with leading nulls so day 1 lands on its weekday (Mon=0)", () => {
    // Feb 2026: the 1st is a Sunday → Mon-indexed weekday 6 → 6 leading nulls.
    const grid = monthGrid({ y: 2026, m: 1 });
    expect(grid.indexOf(1)).toBe(6);
  });
  it("length is always a multiple of 7", () => {
    for (let m = 0; m < 12; m++) {
      expect(monthGrid({ y: 2026, m }).length % 7).toBe(0);
    }
  });
  it("contains every day exactly once; leap February has 29", () => {
    const feb2026 = monthGrid({ y: 2026, m: 1 }).filter((d) => d !== null);
    expect(feb2026).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(monthGrid({ y: 2028, m: 1 }).filter((d) => d !== null).length).toBe(
      29,
    );
  });
});

describe("sortByStart", () => {
  it("sorts ascending by start date without mutating input", () => {
    const input: DateSpan[] = [
      { starts_on: "2026-03-10", ends_on: null },
      { starts_on: "2026-01-05", ends_on: null },
      { starts_on: "2026-02-20", ends_on: null },
    ];
    expect(sortByStart(input).map((e) => e.starts_on)).toEqual([
      "2026-01-05",
      "2026-02-20",
      "2026-03-10",
    ]);
    expect(input[0].starts_on).toBe("2026-03-10");
  });
});
