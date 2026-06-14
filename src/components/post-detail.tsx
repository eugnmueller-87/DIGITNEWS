import { CategoryChip } from "@/components/category-chip";
import { DateTile } from "@/components/date-tile";
import { Icon } from "@/components/icons";
import { clsx } from "@/lib/clsx";
import type {
  EventNoticeItem,
  EventNoticePayload,
  HealthNoticePayload,
  HealthSeverity,
  InfoPayload,
  MealPlanDay,
  MealPlanPayload,
  NutriScore,
  ReflectionDay,
  ReflectionPayload,
  Weekday,
} from "@/lib/content/types";

/**
 * Per-content-type detail renderer. Renders the structured `payload` of a post
 * inside the existing detail bottom sheets — turning the typed extraction into a
 * clean, scannable German layout instead of a wall of body text.
 *
 * DEFENSIVE BY DESIGN: the worker's payload schema is being migrated, so legacy
 * posts may carry free-form keys (tagesablauf, bildungsbereiche, …) that don't
 * match the typed shapes here. Every branch narrows `payload: unknown` with a
 * small type guard and FALLS BACK to the body text on any mismatch — so a post
 * never crashes the sheet and never shows raw JSON. The body fallback is the
 * critical path for those legacy payloads.
 */

// --- weekday + date helpers -------------------------------------------------

const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: "Mo",
  tue: "Di",
  wed: "Mi",
  thu: "Do",
  fri: "Fr",
};

/**
 * Format an ISO yyyy-mm-dd date as dd.mm.yyyy by SPLITTING the string. Never
 * `new Date(iso)` — that parses as UTC midnight and renders the day before in
 * timezones west of UTC (the same bug <DateTile> avoids).
 */
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/** A date range "dd.mm.yyyy" or "dd.mm.yyyy – dd.mm.yyyy" (ends optional). */
function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return end ? formatIsoDate(end) : "";
  if (!end || end === start) return formatIsoDate(start);
  return `${formatIsoDate(start)} – ${formatIsoDate(end)}`;
}

// --- shared fallback --------------------------------------------------------

/**
 * The universal fallback: render the post body as readable paragraphs. Used for
 * `info` without notes, the DEFAULT branch, and any payload that fails its guard.
 */
function BodyText({ body }: { body: string | null }) {
  if (!body) return null;
  return (
    <p className="whitespace-pre-line text-[16px] leading-relaxed text-ink">
      {body}
    </p>
  );
}

// --- type guards (narrow `unknown` before rendering the typed shape) --------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

const NUTRI_SCORES = ["A", "B", "C", "D", "E"] as const;
function isNutriScore(v: unknown): v is NutriScore {
  return (
    typeof v === "string" && (NUTRI_SCORES as readonly string[]).includes(v)
  );
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
function isWeekday(v: unknown): v is Weekday {
  return typeof v === "string" && (WEEKDAYS as readonly string[]).includes(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isMealPlanDay(v: unknown): v is MealPlanDay {
  return isRecord(v) && isStringArray(v.dishes);
}

function isMealPlan(p: unknown): p is MealPlanPayload {
  return (
    isRecord(p) &&
    Array.isArray(p.days) &&
    p.days.length > 0 &&
    p.days.every(isMealPlanDay)
  );
}

function isReflectionDay(v: unknown): v is ReflectionDay {
  return isRecord(v) && typeof v.summary === "string";
}

function isReflection(p: unknown): p is ReflectionPayload {
  return (
    isRecord(p) &&
    Array.isArray(p.days) &&
    p.days.length > 0 &&
    p.days.every(isReflectionDay)
  );
}

const SEVERITIES = ["info", "advisory", "urgent"] as const;
function isHealthNotice(p: unknown): p is HealthNoticePayload {
  return (
    isRecord(p) &&
    typeof p.topic === "string" &&
    typeof p.severity === "string" &&
    (SEVERITIES as readonly string[]).includes(p.severity)
  );
}

function isEventItem(v: unknown): v is EventNoticeItem {
  return (
    isRecord(v) &&
    typeof v.title === "string" &&
    typeof v.starts_on === "string"
  );
}

function isEventNotice(p: unknown): p is EventNoticePayload {
  return (
    isRecord(p) &&
    Array.isArray(p.events) &&
    p.events.length > 0 &&
    p.events.every(isEventItem)
  );
}

function isInfo(p: unknown): p is InfoPayload {
  return isRecord(p) && "notes" in p;
}

// --- small building blocks --------------------------------------------------

/**
 * A colored Nutri-Score letter badge, driven by the --nutri-a..e CSS vars (data
 * semantics, theme-independent). C is yellow, so it gets dark ink text; the rest
 * are saturated enough for white. Always shown alongside the word "Schätzung":
 * the score is ALWAYS an estimate, never an official rating.
 */
function NutriBadge({ score }: { score: NutriScore }) {
  const lower = score.toLowerCase();
  const darkText = score === "C";
  return (
    <span
      className={clsx(
        "font-display inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[13px] font-extrabold",
        darkText ? "text-ink" : "text-white",
      )}
      style={{ backgroundColor: `var(--nutri-${lower})` }}
    >
      {score}
    </span>
  );
}

/** The "weekday · date" label for a meal/reflection day row. */
function dayLabel(day: Weekday | null, date: string | null): string | null {
  const wd = isWeekday(day) ? WEEKDAY_LABEL[day] : null;
  const ds = date ? formatIsoDate(date) : null;
  if (wd && ds) return `${wd} · ${ds}`;
  return wd ?? ds;
}

// --- per-type sections ------------------------------------------------------

function MealPlanDetail({ payload }: { payload: MealPlanPayload }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryChip category="meal_plan" />
        {payload.week_of && (
          <span className="font-display text-[13px] font-bold uppercase tracking-wide text-ink-faint">
            Woche ab {formatIsoDate(payload.week_of)}
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {payload.days.map((d, i) => {
          const label = dayLabel(d.day, d.date);
          return (
            <li key={i} className="rounded-[12px] bg-surface-2 p-3.5">
              <div className="flex items-center gap-2">
                {label && (
                  <span className="font-display text-[15px] font-bold text-ink">
                    {label}
                  </span>
                )}
                {isNutriScore(d.nutri_score) && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <NutriBadge score={d.nutri_score} />
                    <span className="text-[12px] font-semibold text-ink-faint">
                      Schätzung
                    </span>
                  </span>
                )}
              </div>
              {d.dishes.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {d.dishes.map((dish, j) => (
                    <li
                      key={j}
                      className="flex gap-2 text-[15px] leading-relaxed text-ink"
                    >
                      <span aria-hidden className="text-ink-faint">
                        •
                      </span>
                      <span>{dish}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {isNutriScore(payload.nutri_score_week) && (
        <div className="flex items-center gap-2 rounded-[12px] bg-accent-soft px-3.5 py-2.5">
          <NutriBadge score={payload.nutri_score_week} />
          <span className="text-[14px] font-semibold text-ink">
            Nutri-Score der Woche
          </span>
          <span className="ml-auto text-[12px] font-semibold text-ink-faint">
            Schätzung
          </span>
        </div>
      )}
    </div>
  );
}

function ReflectionDetail({ payload }: { payload: ReflectionPayload }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryChip category="reflection" />
        {payload.week_of && (
          <span className="font-display text-[13px] font-bold uppercase tracking-wide text-ink-faint">
            Woche ab {formatIsoDate(payload.week_of)}
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {payload.days.map((d, i) => {
          const label = dayLabel(d.day, d.date);
          return (
            <li key={i} className="rounded-[12px] bg-surface-2 p-3.5">
              {label && (
                <p className="font-display text-[15px] font-bold text-ink">
                  {label}
                </p>
              )}
              {d.summary && (
                <p className="mt-1 text-[15px] leading-relaxed text-ink">
                  {d.summary}
                </p>
              )}
              {isStringArray(d.activities) && d.activities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.activities.map((a, j) => (
                    <span
                      key={j}
                      className="rounded-full bg-paper px-2.5 py-0.5 text-[12px] font-semibold text-ink-soft"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SEVERITY_STYLE: Record<
  HealthSeverity,
  { block: string; heading: string; meta: string }
> = {
  urgent: {
    block: "bg-tomato-soft",
    heading: "text-tomato",
    meta: "text-tomato",
  },
  advisory: {
    block: "bg-sun-soft",
    heading: "text-sun-deep",
    meta: "text-sun-deep",
  },
  info: {
    block: "bg-sun-soft",
    heading: "text-sun-deep",
    meta: "text-sun-deep",
  },
};

function HealthNoticeDetail({ payload }: { payload: HealthNoticePayload }) {
  const s = SEVERITY_STYLE[payload.severity];
  const dateRange = formatDateRange(payload.date, payload.ends_on);
  return (
    <div className={clsx("rounded-[16px] p-4", s.block)}>
      <div className={clsx("flex items-center gap-2", s.heading)}>
        <Icon name="warning" size={20} />
        <h3 className="font-display text-[18px] font-bold leading-snug">
          {payload.topic}
        </h3>
      </div>

      {payload.action_required && (
        <div className="mt-3">
          <p className="text-[13px] font-bold uppercase tracking-wide text-ink-soft">
            Was zu tun ist:
          </p>
          <p className="mt-0.5 text-[15px] leading-relaxed text-ink">
            {payload.action_required}
          </p>
        </div>
      )}

      {dateRange && (
        <p className={clsx("mt-3 text-[13px] font-semibold", s.meta)}>
          {dateRange}
        </p>
      )}
    </div>
  );
}

const EVENT_CATEGORY_LABEL: Record<EventNoticeItem["category"], string> = {
  closure: "Schließtag",
  event: "Termin",
  deadline: "Frist",
};

function eventTimeRange(ev: EventNoticeItem): string | null {
  if (ev.all_day) return null;
  if (ev.time_start && ev.time_end)
    return `${ev.time_start} – ${ev.time_end} Uhr`;
  if (ev.time_start) return `ab ${ev.time_start} Uhr`;
  return null;
}

function EventNoticeDetail({ payload }: { payload: EventNoticePayload }) {
  return (
    <ul className="space-y-3">
      {payload.events.map((ev, i) => {
        const time = eventTimeRange(ev);
        return (
          <li key={i} className="flex gap-3">
            <DateTile iso={ev.starts_on} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold uppercase tracking-wide text-ink-faint">
                {EVENT_CATEGORY_LABEL[ev.category] ?? "Termin"}
              </p>
              <h3 className="mt-0.5 text-[16px] font-bold leading-snug text-ink">
                {ev.title}
              </h3>
              <p className="mt-0.5 text-[14px] font-semibold text-ink-soft">
                {formatDateRange(ev.starts_on, ev.ends_on)}
                {time && <span className="text-ink-faint"> · {time}</span>}
                {ev.all_day && (
                  <span className="text-ink-faint"> · ganztägig</span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function InfoDetail({
  payload,
  body,
}: {
  payload: InfoPayload;
  body: string | null;
}) {
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  const sections = Array.isArray(payload.sections)
    ? payload.sections.filter(
        (s) => s && Array.isArray(s.items) && s.items.length > 0,
      )
    : [];
  const schedule = Array.isArray(payload.schedule)
    ? payload.schedule.filter((r) => r && r.time && r.activity)
    : [];

  // Nothing structured → fall back to notes intro, then body.
  if (!sections.length && !schedule.length) {
    if (notes) {
      return (
        <p className="whitespace-pre-line text-[16px] leading-relaxed text-ink">
          {notes}
        </p>
      );
    }
    return <BodyText body={body} />;
  }

  return (
    <div className="space-y-4">
      {notes && (
        <p className="text-[16px] leading-relaxed text-ink-soft">{notes}</p>
      )}

      {/* Timetable: time → activity rows */}
      {schedule.length > 0 && (
        <div className="overflow-hidden rounded-[12px] border border-border">
          {schedule.map((row, i) => (
            <div
              key={i}
              className={clsx(
                "flex gap-3 px-3 py-2",
                i > 0 && "border-t border-[color:var(--hairline)]",
              )}
            >
              <span className="w-24 shrink-0 font-bold tabular-nums text-accent-deep">
                {row.time}
              </span>
              <span className="text-ink">{row.activity}</span>
            </div>
          ))}
        </div>
      )}

      {/* Themed bullet groups */}
      {sections.map((s, i) => (
        <div key={i}>
          {s.heading && (
            <h3 className="font-display mb-1 text-[15px] font-bold text-ink">
              {s.heading}
            </h3>
          )}
          <ul className="space-y-1">
            {s.items.map((it, j) => (
              <li key={j} className="flex gap-2 text-[16px] text-ink">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="leading-relaxed">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// --- public API -------------------------------------------------------------

/**
 * Render a post's structured detail. Picks a typed layout by `contentType`,
 * narrows the `unknown` payload with a guard, and falls back to the body text on
 * any mismatch (legacy free-form payloads, unconfirmed types, or `info`).
 */
export function PostDetail({
  contentType,
  body,
  payload,
}: {
  contentType: string | null;
  body: string | null;
  payload: unknown;
}) {
  switch (contentType) {
    case "meal_plan":
      if (isMealPlan(payload)) return <MealPlanDetail payload={payload} />;
      break;
    case "reflection":
      if (isReflection(payload)) return <ReflectionDetail payload={payload} />;
      break;
    case "health_notice":
      if (isHealthNotice(payload))
        return <HealthNoticeDetail payload={payload} />;
      break;
    case "event_notice":
      if (isEventNotice(payload))
        return <EventNoticeDetail payload={payload} />;
      break;
    case "info":
      if (isInfo(payload)) return <InfoDetail payload={payload} body={body} />;
      break;
    default:
      break;
  }

  // DEFAULT / unrecognized payload: the body text is the source of truth.
  return <BodyText body={body} />;
}
