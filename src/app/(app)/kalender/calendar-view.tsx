"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui";

import type { CalEvent } from "./page";

type View = "month" | "list";

const CATEGORY_COLOR: Record<CalEvent["category"], string> = {
  closure: "bg-berry",
  event: "bg-wool-pink",
  deadline: "bg-sunshine",
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
        <div className="font-display inline-flex gap-1 rounded-full border-[3px] border-ink bg-paper p-1 text-sm font-semibold">
          {(["month", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={
                view === v
                  ? "rounded-full bg-sunshine px-3 py-1 text-ink"
                  : "rounded-full px-3 py-1 text-ink-soft"
              }
            >
              {v === "month" ? "Monat" : "Liste"}
            </button>
          ))}
        </div>

        {view === "month" && (
          <div className="font-display flex items-center gap-2 text-sm">
            <button
              type="button"
              aria-label="Vorheriger Monat"
              onClick={() =>
                setCursor((c) =>
                  c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 },
                )
              }
              className="rounded-full border-[3px] border-ink bg-paper px-2.5 py-0.5"
            >
              ‹
            </button>
            <span className="min-w-32 text-center font-semibold">
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
              className="rounded-full border-[3px] border-ink bg-paper px-2.5 py-0.5"
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
        <div className="space-y-3">
          {upcoming.map((e) => {
            const [, m, d] = e.starts_on.split("-");
            const MONTH_ABBR = [
              "Jan",
              "Feb",
              "Mär",
              "Apr",
              "Mai",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Okt",
              "Nov",
              "Dez",
            ];
            return (
              <div
                key={e.id}
                className="rounded-wobble-a flex items-center gap-4 border-[3px] border-ink bg-paper p-4 shadow-felt-sm"
              >
                <div className="font-display flex w-16 shrink-0 flex-col items-center rounded-2xl border-[3px] border-ink bg-white py-1.5">
                  <span className="text-2xl font-bold leading-none text-ink">
                    {d}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-tomato">
                    {MONTH_ABBR[Number(m) - 1]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className={`inline-block rounded-full border-2 border-ink px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${CATEGORY_COLOR[e.category]} ${e.category === "closure" ? "text-white" : "text-ink"}`}
                  >
                    {CATEGORY_LABEL[e.category]}
                  </span>
                  <h3 className="font-display mt-1 text-lg font-semibold text-ink">
                    {e.title}
                  </h3>
                  <p className="text-sm font-semibold text-ink-soft">
                    {formatRange(e)}
                  </p>
                </div>
              </div>
            );
          })}
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
