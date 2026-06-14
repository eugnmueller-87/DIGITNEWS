"use client";

import { useMemo, useState } from "react";

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
const CATEGORY_LABEL: Record<CalEvent["category"], string> = {
  closure: "Schließtag",
  event: "Fest",
  deadline: "Frist",
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export function CalendarView({ events }: { events: CalEvent[] }) {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() =>
    anchorMonth(events[0]?.starts_on, { y: 2026, m: 0 }),
  );

  const grid = useMemo(() => monthGrid(cursor), [cursor]);
  const upcoming = useMemo(() => sortByStart(events), [events]);

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
              {v === "month" ? "Monat" : "Liste"}
            </button>
          ))}
        </div>

        {view === "month" && (
          <div className="font-display flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Vorheriger Monat"
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
              aria-label="Nächster Monat"
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
              const dayEvents = d ? events.filter((e) => covers(e, iso)) : [];
              return (
                <div
                  key={i}
                  className="min-h-16 rounded-lg p-0.5 text-left text-[11px] sm:p-1 sm:text-xs"
                >
                  {d && (
                    <>
                      <div className="font-display font-bold tabular-nums text-ink">
                        {d}
                      </div>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => (
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
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3.5 rounded-[16px] border border-border bg-paper p-3.5"
            >
              <DateTile iso={e.starts_on} />
              <div className="min-w-0 flex-1">
                <span
                  className={clsx(
                    "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                    CATEGORY_CHIP[e.category],
                  )}
                >
                  {CATEGORY_LABEL[e.category]}
                </span>
                <h3 className="mt-1 text-[17px] font-bold text-ink">
                  {e.title}
                </h3>
                <p className="text-sm text-ink-soft">{formatRange(e)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRange(e: CalEvent): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  };
  const base =
    e.ends_on && e.ends_on !== e.starts_on
      ? `${fmt(e.starts_on)} – ${fmt(e.ends_on)}`
      : fmt(e.starts_on);
  if (!e.all_day && e.time_start) {
    return `${base}, ${e.time_start}${e.time_end ? `–${e.time_end}` : ""} Uhr`;
  }
  return base;
}
