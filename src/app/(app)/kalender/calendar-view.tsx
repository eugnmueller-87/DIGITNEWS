"use client";

import { useMemo, useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import { DateTile } from "@/components/date-tile";
import {
  anchorMonth,
  covers,
  isoOf,
  monthGrid,
  nextMonth,
  prevMonth,
  sortByStart,
} from "@/lib/calendar";
import { clsx } from "@/lib/clsx";
import { maskPlaceholders } from "@/lib/content/mask";
import { formatDate } from "@/lib/i18n/format";
import { useLocale, useT } from "@/lib/i18n/provider";

import type { CalEvent } from "./page";

type View = "month" | "list";

// Three visually DISTINCT dot colors (the old map had event/deadline both amber).
const CATEGORY_DOT: Record<CalEvent["category"], string> = {
  closure: "bg-sage",
  event: "bg-sky",
  deadline: "bg-sunshine",
};
// Soft-fill chip per calendar category (matches the dot hue).
const CATEGORY_CHIP: Record<CalEvent["category"], string> = {
  closure: "bg-sage-soft text-sage",
  event: "bg-sky-soft text-sky",
  deadline: "bg-sun-soft text-sun-deep",
};
export function CalendarView({ events: rawEvents }: { events: CalEvent[] }) {
  const t = useT();
  const locale = useLocale();
  const WEEKDAYS = t.calendar.weekdaysShort;
  const MONTHS = t.calendar.months;
  // Strip any leftover [NAME_x]-style redaction placeholders from titles so the
  // calendar reads cleanly (same one-way mask the feed uses). Done once here so
  // every render site (grid dots, day sheet, list) is covered.
  const events = useMemo(
    () => rawEvents.map((e) => ({ ...e, title: maskPlaceholders(e.title) })),
    [rawEvents],
  );

  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() =>
    anchorMonth(events[0]?.starts_on, { y: 2026, m: 0 }),
  );
  // The tapped day (ISO) whose events are shown in the detail sheet, or a single
  // tapped event from the list view.
  const [sheetDay, setSheetDay] = useState<string | null>(null);
  const [sheetEvent, setSheetEvent] = useState<CalEvent | null>(null);

  const grid = useMemo(() => monthGrid(cursor), [cursor]);
  const upcoming = useMemo(() => sortByStart(events), [events]);

  const dayEvents = sheetDay
    ? events.filter((e) => covers(e, sheetDay))
    : sheetEvent
      ? [sheetEvent]
      : [];
  const sheetTitle = sheetDay
    ? formatDate(sheetDay, locale, t)
    : t.calendar.eventSheetTitle;
  const closeSheet = () => {
    setSheetDay(null);
    setSheetEvent(null);
  };

  // Localized date+time range for an event row (replaces the old German helper).
  const rangeOf = (e: CalEvent): string => {
    const base =
      e.ends_on && e.ends_on !== e.starts_on
        ? `${formatDate(e.starts_on, locale, t)} – ${formatDate(e.ends_on, locale, t)}`
        : formatDate(e.starts_on, locale, t);
    if (!e.all_day && e.time_start) {
      const suffix = t.calendar.oClock ? ` ${t.calendar.oClock}` : "";
      return `${base}, ${e.time_start}${e.time_end ? `–${e.time_end}` : ""}${suffix}`;
    }
    return base;
  };

  return (
    <div className="space-y-4">
      {/* iOS segmented control — a sliding white thumb in a surface-2 track. */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative grid grid-cols-2 rounded-full bg-surface-2 p-1 text-sm font-bold">
          <span
            aria-hidden
            className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-paper shadow-felt transition-transform duration-200 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]"
            style={{
              transform:
                view === "month" ? "translateX(0)" : "translateX(100%)",
            }}
          />
          {(["month", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={clsx(
                "relative z-10 rounded-full px-5 py-1.5 transition-colors",
                view === v ? "text-ink" : "text-ink-soft",
              )}
            >
              {v === "month" ? t.calendar.viewMonth : t.calendar.viewList}
            </button>
          ))}
        </div>

        {view === "month" && (
          <div className="font-display flex items-center gap-1.5">
            <button
              type="button"
              aria-label={t.calendar.prevMonth}
              onClick={() => setCursor(prevMonth)}
              className="press flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-lg leading-none text-ink"
            >
              ‹
            </button>
            <span className="min-w-28 text-center text-sm font-bold tabular-nums sm:min-w-32">
              {MONTHS[cursor.m]} {cursor.y}
            </span>
            <button
              type="button"
              aria-label={t.calendar.nextMonth}
              onClick={() => setCursor(nextMonth)}
              className="press flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-lg leading-none text-ink"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {view === "month" ? (
        <div className="rounded-[16px] border border-border bg-paper p-3">
          <div className="grid grid-cols-7 gap-px text-center text-[11px] font-bold text-ink-faint">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {grid.map((d, i) => {
              const iso = d ? isoOf(cursor.y, cursor.m, d) : "";
              const cellEvents = d ? events.filter((e) => covers(e, iso)) : [];
              const hasEvents = cellEvents.length > 0;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!hasEvents}
                  onClick={() => hasEvents && setSheetDay(iso)}
                  className={clsx(
                    "min-h-16 rounded-lg p-0.5 text-left text-[11px] sm:p-1 sm:text-xs",
                    hasEvents && "press cursor-pointer hover:bg-surface-2",
                  )}
                >
                  {d && (
                    <>
                      <div className="font-display font-bold tabular-nums text-ink">
                        {d}
                      </div>
                      <div className="mt-0.5 space-y-0.5">
                        {cellEvents.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center gap-1 truncate text-ink-soft"
                            title={e.title}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOT[e.category]}`}
                            />
                            <span className="truncate">{e.title}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setSheetEvent(e)}
              className="press flex w-full items-center gap-3.5 rounded-[16px] border border-border bg-paper p-3.5 text-left"
            >
              <DateTile iso={e.starts_on} dict={t} />
              <div className="min-w-0 flex-1">
                <span
                  className={clsx(
                    "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                    CATEGORY_CHIP[e.category],
                  )}
                >
                  {t.calendar.category[e.category]}
                </span>
                <h3 className="mt-1 text-[17px] font-bold text-ink">
                  {e.title}
                </h3>
                <p className="text-sm text-ink-soft">{rangeOf(e)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Day / event detail sheet */}
      <BottomSheet
        open={sheetDay != null || sheetEvent != null}
        onClose={closeSheet}
        title={sheetTitle}
      >
        <div className="space-y-3">
          {dayEvents.map((e) => (
            <div
              key={e.id}
              className="rounded-[14px] border border-border bg-paper p-3.5"
            >
              <span
                className={clsx(
                  "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                  CATEGORY_CHIP[e.category],
                )}
              >
                {t.calendar.category[e.category]}
              </span>
              <h3 className="mt-1.5 text-[17px] font-bold text-ink">
                {e.title}
              </h3>
              <p className="mt-0.5 text-sm text-ink-soft">{rangeOf(e)}</p>
            </div>
          ))}
          {dayEvents.length === 0 && (
            <p className="text-sm text-ink-soft">{t.calendar.noEventsOnDay}</p>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
