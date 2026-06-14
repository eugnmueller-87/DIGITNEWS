"""Structured extraction via the Claude API (Anthropic) on REDACTED text only.

The LLM receives ONLY redacted text (placeholders like [NAME_1] preserved
verbatim). Its JSON output is validated against the shared contract (mirrors
src/lib/content/extraction-schema.ts). Validation failure => the caller routes
the post to the manual path; nothing is ever auto-published.

PRIVACY NOTE: Anthropic's API is US-hosted (no EU data-residency endpoint at the
time of writing), unlike the previous Mistral (EU) integration. The "privacy by
construction" guarantee is preserved by the redaction step UPSTREAM of this
call: only the locally-redacted text (PII already masked to [NAME_1]-style
placeholders) is sent here — never raw images, never raw PII. If strict EU data
residency is later required, swap this module back to an EU LLM; nothing else in
the pipeline changes.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

# Cheap, fast model for structured extraction. JSON output via output_config.
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-haiku-4-5"
ANTHROPIC_VERSION = "2023-06-01"

CONTENT_TYPES = [
    "meal_plan",
    "reflection",
    "health_notice",
    "event_notice",
    "info",
]

# JSON Schema the API constrains the response to (output_config.format).
#
# Strict structured-output mode requires EVERY object to set
# additionalProperties:false and list EVERY property as required (optionality is
# expressed via nullable type unions), and it does NOT support oneOf
# discriminated unions. So instead of branching the payload by content_type, the
# schema carries ALL FIVE typed sub-payloads as nullable siblings under
# `details`; the model fills the ONE matching content_type_suggested and sets
# the rest to null. `extract()` then collapses the non-null branch into
# `payload` (the shape the app + DB read). The five shapes mirror
# src/lib/content/extraction-schema.ts.

# --- reusable field schemas ---
# NOTE: strict mode rejects an `enum` that mixes a value list with null + a
# union type, so nullable fields use type+description only (the prompt + the
# downstream review gate constrain the actual values).
_DAY = {"type": ["string", "null"], "description": "mon|tue|wed|thu|fri oder null"}
_ISO = {"type": ["string", "null"], "description": "ISO Datum JJJJ-MM-TT oder null"}
_NUTRI = {"type": ["string", "null"], "description": "A|B|C|D|E oder null (Schätzung)"}
_HHMM = {"type": ["string", "null"], "description": "HH:MM oder null"}
_STR = {"type": ["string", "null"]}


def _obj(props: dict, required: list[str] | None = None) -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": props,
        "required": required if required is not None else list(props.keys()),
    }


_MEAL = _obj(
    {
        "week_of": _ISO,
        "days": {
            "type": "array",
            "items": _obj(
                {
                    "day": _DAY,
                    "date": _ISO,
                    "dishes": {"type": "array", "items": {"type": "string"}},
                    "nutri_score": _NUTRI,
                    "nutri_rationale": _STR,
                }
            ),
        },
        "nutri_score_week": _NUTRI,
    }
)
_REFLECTION = _obj(
    {
        "week_of": _ISO,
        "days": {
            "type": "array",
            "items": _obj(
                {
                    "day": _DAY,
                    "date": _ISO,
                    "summary": {"type": "string"},
                    "activities": {"type": "array", "items": {"type": "string"}},
                }
            ),
        },
    }
)
_HEALTH = _obj(
    {
        "topic": {"type": "string"},
        "severity": {"type": "string", "enum": ["info", "advisory", "urgent"]},
        "action_required": _STR,
        "date": _ISO,
        "ends_on": _ISO,
    }
)
_EVENT_ITEM = _obj(
    {
        "category": {"type": "string", "enum": ["closure", "event", "deadline"]},
        "title": {"type": "string"},
        "starts_on": {"type": "string", "description": "ISO Datum JJJJ-MM-TT"},
        "ends_on": _ISO,
        "all_day": {"type": "boolean"},
        "time_start": _HHMM,
        "time_end": _HHMM,
    }
)
_EVENTS = _obj({"events": {"type": "array", "items": _EVENT_ITEM}})
# Info is structured so the UI can show bullet lists + a time→activity table
# instead of one text block. `sections` = themed bullet groups; `schedule` =
# a daily timetable; `notes` = a short intro / fallback.
_INFO = _obj(
    {
        "notes": _STR,
        "sections": {
            "type": "array",
            "items": _obj(
                {
                    "heading": _STR,
                    "items": {"type": "array", "items": {"type": "string"}},
                }
            ),
        },
        "schedule": {
            "type": "array",
            "items": _obj(
                {
                    "time": {
                        "type": "string",
                        "description": "z.B. 08:00 oder 8:00-8:30",
                    },
                    "activity": {"type": "string"},
                }
            ),
        },
    }
)

# The five typed payloads as siblings (strict mode rejects oneOf/nullable
# objects, so each is a plain object). The model fills the one matching
# content_type with real data and leaves the others' fields null/empty;
# extract() reads only the matching branch.
_DETAILS = _obj(
    {
        "meal_plan": _MEAL,
        "reflection": _REFLECTION,
        "health_notice": _HEALTH,
        "event_notice": _EVENTS,
        "info": _INFO,
    }
)

_OUTPUT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "content_type_suggested": {"type": "string", "enum": CONTENT_TYPES},
        "confidence": {"type": "number"},
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "details": _DETAILS,
    },
    "required": [
        "content_type_suggested",
        "confidence",
        "title",
        "summary",
        "details",
    ],
}


class ExtractionEnvelope(BaseModel):
    """Validated LLM output. Loose payload (validated per-type by the schema in
    the prompt + downstream review); the envelope fields are the contract."""

    content_type_suggested: str
    confidence: float
    title: str
    summary: str
    payload: dict[str, Any]

    def normalized(self) -> ExtractionEnvelope:
        if self.content_type_suggested not in CONTENT_TYPES:
            raise ValueError("invalid content_type_suggested")
        return self


def _system_prompt(org_type: str, capture_date: str) -> str:
    return (
        "Du extrahierst strukturierte Daten aus einem deutschen Aushang einer "
        f"Einrichtung vom Typ '{org_type}'. Der Text wurde bereits anonymisiert; "
        "Platzhalter wie [NAME_1] MUSST du unverändert übernehmen. Klassifiziere "
        "den Aushang als einen von: meal_plan (Speiseplan), reflection "
        "(Wochenrückblick), health_notice (Krankheit/Hinweis), event_notice "
        "(Termine/Schließtage), info (Sonstiges). Löse relative Daten gegen das "
        f"Aufnahmedatum {capture_date} auf (Zeitzone Europe/Berlin); bei "
        "Unsicherheit Datum null lassen, niemals erfinden.\n"
        "Felder: content_type_suggested, confidence (0-1), title, summary, "
        "details. In 'details' füllst du GENAU das Unterobjekt aus, das zum "
        "content_type passt; alle anderen Unterobjekte setzt du auf null:\n"
        "• meal_plan → { week_of, days:[{day(mon..fri|null), date, "
        "dishes:[Gericht,…], nutri_score(A-E|null, SCHÄTZUNG), nutri_rationale}], "
        "nutri_score_week }\n"
        "• reflection → { week_of, days:[{day, date, summary, activities:[…]}] }\n"
        "• health_notice → { topic, severity(info|advisory|urgent), "
        "action_required, date, ends_on }\n"
        "• event_notice → { events:[{category('closure'=Schließtag, 'event'="
        "Termin/Fest, 'deadline'=Frist), title(kurz), starts_on(JJJJ-MM-TT), "
        "ends_on, all_day(true ohne Uhrzeit), time_start, time_end(HH:MM|null)}] } "
        "— lege für JEDES konkrete Datum/jede Frist einen Eintrag an; mehrtägige "
        "Schließungen als ein Eintrag mit ends_on.\n"
        "• info → { notes: kurzer Einleitungstext (1-2 Sätze) oder null; "
        "sections:[{heading: Thema/Überschrift oder null, items:[Stichpunkt,…]}] "
        "— zerlege Aufzählungen in thematische Gruppen mit kurzen Stichpunkten; "
        "schedule:[{time, activity}] — NUR bei einem Tages-/Zeitablauf, je Zeile "
        "ein Eintrag (time z.B. '08:00' oder '8:00-8:30'). Leere Listen [] wenn "
        "nicht zutreffend }\n"
        "Erfinde keine Felder, lass Unbekanntes null/leer."
    )


def extract(
    *, api_key: str, redacted_text: str, org_type: str, capture_date: str
) -> ExtractionEnvelope:
    """Call the Claude API on the redacted text and return the validated
    envelope.

    Raises on transport error or validation failure (caller -> manual path).
    """
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    body = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": 4096,
        "system": _system_prompt(org_type, capture_date),
        "messages": [{"role": "user", "content": redacted_text}],
        # Constrain the response to the JSON envelope (structured outputs).
        "output_config": {
            "format": {
                "type": "json_schema",
                "schema": _OUTPUT_SCHEMA,
            }
        },
    }
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        # A safety refusal returns stop_reason "refusal" with no usable text.
        if data.get("stop_reason") == "refusal":
            raise ValueError("extraction refused by safety classifier")
        content = _first_text(data)

    try:
        raw = json.loads(content)
        # The schema carries all five typed payloads under `details` (the model
        # fills the one matching content_type, nulls the rest). Collapse the
        # matching branch into `payload` — the shape the app + publish_post read.
        details = raw.pop("details", {}) or {}
        ct = raw.get("content_type_suggested")
        branch = details.get(ct) if isinstance(details, dict) else None
        raw["payload"] = branch if isinstance(branch, dict) else {}
        return ExtractionEnvelope.model_validate(raw).normalized()
    except (json.JSONDecodeError, ValidationError, ValueError) as e:
        raise ValueError(f"extraction validation failed: {e}") from e


def _first_text(data: dict[str, Any]) -> str:
    """Pull the first text block out of an Anthropic messages response."""
    for block in data.get("content", []):
        if isinstance(block, dict) and block.get("type") == "text":
            return str(block.get("text", ""))
    raise ValueError("no text block in response")
