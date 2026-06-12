"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui";

import type { CalEvent } from "./page";

type View = "month" | "list";

const CATEGORY_COLOR: Record<CalEvent["category"], string> = {
  closure: "bg-red-500",
  event: "bg-emerald-500",
  deadline: "bg-amber-500",
};
const CATEGORY_LABEL: Record<CalEvent["category"], string> = {
  closure: "Schließtag",
  event: "Termin",
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

/** Does an event span a given YYYY-MM-DD day? */
function covers(ev: CalEvent, iso: string): boolean {
  const end = ev.ends_on ?? ev.starts_on;
  return ev.starts_on <= iso && iso <= end;
}

function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function CalendarView({ events }: { events: CalEvent[] }) {
  const [view, setView] = useState<View>("month");
  // Anchor the month on the first upcoming event, else today's month-ish.
  const firstStart = events[0]?.starts_on;
  const initial = firstStart ? new Date(firstStart) : null;
  const [cursor, setCursor] = useState(() => ({
    y: initial ? initial.getFullYear() : 2026,
    m: initial ? initial.getMonth() : 0,
  }));

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const upcoming = useMemo(
    () => [...events].sort((a, b) => a.starts_on.localeCompare(b.starts_on)),
    [events],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl border border-zinc-200 p-0.5 text-sm dark:border-zinc-800">
          {(["month", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={
                view === v
                  ? "rounded-lg bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900"
                  : "rounded-lg px-3 py-1 text-zinc-600 dark:text-zinc-300"
              }
            >
              {v === "month" ? "Monat" : "Liste"}
            </button>
          ))}
        </div>

        {view === "month" && (
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              aria-label="Vorheriger Monat"
              onClick={() =>
                setCursor((c) =>
                  c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 },
                )
              }
              className="rounded-lg border border-zinc-200 px-2 py-1 dark:border-zinc-800"
            >
              ‹
            </button>
            <span className="min-w-32 text-center font-medium">
              {MONTHS[cursor.m]} {cursor.y}
            </span>
            <button
              type="button"
              aria-label="Nächster Monat"
              onClick={() =>
                setCursor((c) =>
                  c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 },
                )
              }
              className="rounded-lg border border-zinc-200 px-2 py-1 dark:border-zinc-800"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {view === "month" ? (
        <Card className="p-3">
          <div className="grid grid-cols-7 gap-px text-center text-xs text-zinc-400">
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
                  className="min-h-16 rounded-lg p-1 text-left text-xs"
                >
                  {d && (
                    <>
                      <div className="text-zinc-400">{d}</div>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center gap-1 truncate"
                            title={e.title}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_COLOR[e.category]}`}
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
        </Card>
      ) : (
        <div className="space-y-2">
          {upcoming.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CATEGORY_COLOR[e.category]}`}
                />
                <div className="min-w-0">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {CATEGORY_LABEL[e.category]} · {formatRange(e)}
                  </div>
                </div>
              </div>
            </Card>
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
