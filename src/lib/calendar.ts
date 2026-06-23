/**
 * Pure calendar date logic — extracted from the (client) calendar view so it can
 * be unit-tested without a DOM and without timezone flakiness.
 *
 * Events store dates as plain ISO `YYYY-MM-DD` strings (civil dates, no zone).
 * All comparisons work on the STRINGS, never on `new Date(iso)`, which would
 * parse as UTC midnight and then shift a day/month for any viewer west of UTC.
 */

/** Minimal event shape the calendar math needs (subset of CalEvent). */
export interface DateSpan {
  starts_on: string;
  ends_on: string | null;
}

/** Anchor month for the calendar grid (0-based month, like Date.getMonth). */
export interface MonthCursor {
  y: number;
  m: number;
}

/**
 * Today's month in the VIEWER's local time. "What month is it" is inherently a
 * local-time question, so we read the local getters of a `new Date()` (now).
 * This is safe from the UTC-parsing pitfall the rest of this module avoids:
 * that pitfall is `new Date("YYYY-MM-DD")` (parsed as UTC midnight), not the
 * local getters of the current instant. Used as the calendar's opening month.
 */
export function currentMonth(now: Date = new Date()): MonthCursor {
  return { y: now.getFullYear(), m: now.getMonth() };
}

/** Does an event span a given `YYYY-MM-DD` day? Inclusive on both ends. */
export function covers(ev: DateSpan, iso: string): boolean {
  const end = ev.ends_on ?? ev.starts_on;
  return ev.starts_on <= iso && iso <= end;
}

/** `YYYY-MM-DD` for a (year, 0-based month, day). */
export function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Anchor the calendar on the first event's month, parsed from the ISO STRING
 * (not `new Date`, which would shift across the UTC boundary). Falls back to the
 * given default when there are no events.
 */
export function anchorMonth(
  firstStart: string | undefined,
  fallback: MonthCursor,
): MonthCursor {
  if (!firstStart) return fallback;
  const [y, m] = firstStart.split("-");
  const year = Number(y);
  const month = Number(m);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return fallback;
  return { y: year, m: month - 1 };
}

/** Previous month, rolling the year at January. */
export function prevMonth(c: MonthCursor): MonthCursor {
  return c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 };
}

/** Next month, rolling the year at December. */
export function nextMonth(c: MonthCursor): MonthCursor {
  return c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 };
}

/**
 * The month grid: leading nulls for the days before the 1st (Mon=0), then the
 * day numbers, then trailing nulls so the length is a multiple of 7.
 */
export function monthGrid(c: MonthCursor): (number | null)[] {
  const first = new Date(c.y, c.m, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(c.y, c.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Sort events ascending by start date (string compare is correct for ISO). */
export function sortByStart<T extends DateSpan>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
}
