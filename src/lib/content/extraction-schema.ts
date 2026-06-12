/**
 * JSON Schema (draft-07) for the LLM extraction contract.
 *
 * The Phase 2 worker forces the EU LLM (Mistral) to emit an object matching this
 * schema, then validates it. Validation failure => the post goes to the manual
 * path (status 'failed'), never auto-published. The discriminator is
 * `content_type_suggested`; each variant pins its own `payload` shape.
 *
 * Hard rules encoded here:
 *   - additionalProperties:false everywhere (no smuggled fields).
 *   - Dates are ISO yyyy-mm-dd or null; the worker resolves relatives against the
 *     capture date (Europe/Berlin) and lists anything unresolved in
 *     ambiguous_dates[] rather than inventing a date.
 *   - meal_plan.payload.nutri_is_estimate is const true (rejects an LLM that
 *     claims an official score).
 *   - PII placeholders like [NAME_1] are preserved verbatim (enforced by prompt;
 *     the schema just allows strings).
 *
 * This object is intentionally framework-agnostic (plain JSON Schema) so the
 * Python worker can consume the same contract via a shared export or codegen.
 */

const ISO_DATE = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } as const;
const ISO_DATE_NULLABLE = {
  type: ["string", "null"],
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
} as const;
const HHMM_NULLABLE = {
  type: ["string", "null"],
  pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
} as const;
const NUTRI = { type: ["string", "null"], enum: ["A", "B", "C", "D", "E", null] } as const;
const WEEKDAY = { type: ["string", "null"], enum: ["mon", "tue", "wed", "thu", "fri", null] } as const;

const MEAL_PLAN_PAYLOAD = {
  type: "object",
  additionalProperties: false,
  required: ["week_of", "days", "nutri_score_week", "nutri_is_estimate"],
  properties: {
    week_of: ISO_DATE_NULLABLE,
    days: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "date", "dishes", "nutri_score", "nutri_rationale", "source_quote"],
        properties: {
          day: WEEKDAY,
          date: ISO_DATE_NULLABLE,
          dishes: { type: "array", minItems: 1, items: { type: "string", maxLength: 200 } },
          nutri_score: NUTRI,
          nutri_rationale: { type: ["string", "null"], maxLength: 300 },
          source_quote: { type: "string", maxLength: 500 },
        },
      },
    },
    nutri_score_week: NUTRI,
    // Must be literally true: the LLM may not claim an official score.
    nutri_is_estimate: { const: true },
  },
} as const;

const REFLECTION_PAYLOAD = {
  type: "object",
  additionalProperties: false,
  required: ["week_of", "days"],
  properties: {
    week_of: ISO_DATE_NULLABLE,
    days: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "date", "summary", "activities", "source_quote"],
        properties: {
          day: WEEKDAY,
          date: ISO_DATE_NULLABLE,
          summary: { type: "string", maxLength: 500 },
          activities: { type: "array", items: { type: "string", maxLength: 200 } },
          source_quote: { type: "string", maxLength: 500 },
        },
      },
    },
  },
} as const;

const HEALTH_PAYLOAD = {
  type: "object",
  additionalProperties: false,
  required: ["topic", "severity", "action_required", "date", "ends_on"],
  properties: {
    topic: { type: "string", maxLength: 200 },
    severity: { enum: ["info", "advisory", "urgent"] },
    action_required: { type: ["string", "null"], maxLength: 300 },
    date: ISO_DATE_NULLABLE,
    ends_on: ISO_DATE_NULLABLE,
  },
} as const;

const EVENT_PAYLOAD = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "title", "starts_on", "ends_on", "all_day", "time_start", "time_end", "source_quote"],
        properties: {
          category: { enum: ["closure", "event", "deadline"] },
          title: { type: "string", maxLength: 120 },
          starts_on: ISO_DATE,
          ends_on: ISO_DATE_NULLABLE,
          all_day: { type: "boolean" },
          time_start: HHMM_NULLABLE,
          time_end: HHMM_NULLABLE,
          source_quote: { type: "string", maxLength: 500 },
        },
      },
    },
  },
} as const;

const INFO_PAYLOAD = {
  type: "object",
  additionalProperties: false,
  required: ["notes"],
  properties: { notes: { type: ["string", "null"], maxLength: 4000 } },
} as const;

/** The envelope shared by every variant (the discriminator + common fields). */
const ENVELOPE_BASE = {
  type: "object",
  additionalProperties: false,
  required: ["content_type_suggested", "confidence", "title", "summary", "source_quotes", "ambiguous_dates", "payload"],
  properties: {
    content_type_suggested: { enum: ["meal_plan", "reflection", "health_notice", "event_notice", "info"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    title: { type: "string", maxLength: 120 },
    summary: { type: "string", maxLength: 2000 },
    source_quotes: { type: "array", items: { type: "string", maxLength: 500 } },
    ambiguous_dates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["quote", "reason"],
        properties: {
          quote: { type: "string", maxLength: 300 },
          reason: { type: "string", maxLength: 200 },
        },
      },
    },
  },
} as const;

/**
 * The full extraction schema: a discriminated union via oneOf, where each branch
 * pins content_type_suggested to a const and supplies the matching payload shape.
 */
export const EXTRACTION_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "AushangExtraction",
  oneOf: [
    { ...ENVELOPE_BASE, properties: { ...ENVELOPE_BASE.properties, content_type_suggested: { const: "meal_plan" }, payload: MEAL_PLAN_PAYLOAD } },
    { ...ENVELOPE_BASE, properties: { ...ENVELOPE_BASE.properties, content_type_suggested: { const: "reflection" }, payload: REFLECTION_PAYLOAD } },
    { ...ENVELOPE_BASE, properties: { ...ENVELOPE_BASE.properties, content_type_suggested: { const: "health_notice" }, payload: HEALTH_PAYLOAD } },
    { ...ENVELOPE_BASE, properties: { ...ENVELOPE_BASE.properties, content_type_suggested: { const: "event_notice" }, payload: EVENT_PAYLOAD } },
    { ...ENVELOPE_BASE, properties: { ...ENVELOPE_BASE.properties, content_type_suggested: { const: "info" }, payload: INFO_PAYLOAD } },
  ],
} as const;
