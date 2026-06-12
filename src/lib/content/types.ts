/**
 * Content classification — shared taxonomy + payload types.
 *
 * The single source of truth for "what kind of notice is this?" Used by the
 * Phase 2 extraction worker (the LLM target), the review/confirm UI, and the
 * deterministic publish step. See supabase/migrations/0008_content_classification.sql.
 *
 * Principle: LLM ADVISES, code DECIDES. The LLM emits `content_type_suggested`;
 * the admin confirms it into `content_type`; routing reads ONLY the confirmed
 * value. Nutri-Score is ALWAYS an estimate, never an official rating.
 */

export const CONTENT_TYPES = [
  "meal_plan",
  "reflection",
  "health_notice",
  "event_notice",
  "info",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** German labels for the content types (UI + review screen). */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  meal_plan: "Speiseplan",
  reflection: "Rückblick",
  health_notice: "Gesundheits-Hinweis",
  event_notice: "Termin",
  info: "Info",
};

export type HealthSeverity = "info" | "advisory" | "urgent";
export type NutriScore = "A" | "B" | "C" | "D" | "E";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri";

// --- Per-type structured payloads (what post_details.payload holds) ----------

export interface MealPlanDay {
  day: Weekday | null;
  date: string | null; // ISO yyyy-mm-dd
  dishes: string[];
  nutri_score: NutriScore | null; // per-day ESTIMATE
  nutri_rationale: string | null;
  source_quote: string;
}
export interface MealPlanPayload {
  week_of: string | null;
  days: MealPlanDay[];
  nutri_score_week: NutriScore | null; // per-week ESTIMATE
  nutri_is_estimate: true; // const true — never official
}

export interface ReflectionDay {
  day: Weekday | null;
  date: string | null;
  summary: string;
  activities: string[];
  source_quote: string;
}
export interface ReflectionPayload {
  week_of: string | null;
  days: ReflectionDay[];
}

export interface HealthNoticePayload {
  topic: string;
  severity: HealthSeverity;
  action_required: string | null;
  date: string | null; // may be null (e.g. lice — no date)
  ends_on: string | null;
}

export interface EventNoticeItem {
  category: "closure" | "event" | "deadline";
  title: string;
  starts_on: string; // required ISO date
  ends_on: string | null;
  all_day: boolean;
  time_start: string | null; // HH:MM
  time_end: string | null;
  source_quote: string;
}
export interface EventNoticePayload {
  events: EventNoticeItem[];
}

export interface InfoPayload {
  notes: string | null;
}

/** The full validated extraction envelope the LLM emits (one per notice). */
export interface ExtractionEnvelope {
  content_type_suggested: ContentType;
  confidence: number;
  title: string;
  summary: string;
  source_quotes: string[];
  ambiguous_dates: { quote: string; reason: string }[];
  payload:
    | MealPlanPayload
    | ReflectionPayload
    | HealthNoticePayload
    | EventNoticePayload
    | InfoPayload;
}

/**
 * Which content types route to a dedicated parent-facing section (rendered from
 * post_details) vs. the general feed, and which create calendar events.
 */
export const ROUTING: Record<
  ContentType,
  { section: boolean; usesPostDetails: boolean; createsEvents: boolean }
> = {
  meal_plan: { section: true, usesPostDetails: true, createsEvents: false },
  reflection: { section: true, usesPostDetails: true, createsEvents: false },
  health_notice: { section: true, usesPostDetails: false, createsEvents: false },
  event_notice: { section: false, usesPostDetails: false, createsEvents: true },
  info: { section: false, usesPostDetails: false, createsEvents: false },
};
