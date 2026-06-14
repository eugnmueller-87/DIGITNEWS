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

# JSON Schema the API constrains the response to (output_config.format). Mirrors
# the ExtractionEnvelope below.
#
# Anthropic's structured-output (strict JSON schema) mode requires EVERY object
# to set `additionalProperties: false` — an open `{"type":"object",
# "additionalProperties": true}` is rejected with a 400. The per-type payload is
# free-form and is validated downstream in the review gate, so we return it here
# as a JSON STRING the model fills with a JSON object, then parse it ourselves
# (see `extract`). This keeps the schema strict-mode-valid while preserving the
# open payload contract.
# A single calendar event. Strict-mode-valid (additionalProperties:false, every
# field required — nullable via type unions). Mirrors EventNoticeItem in
# src/lib/content/types.ts; publish_post inserts these into the events table.
_EVENT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "category": {"type": "string", "enum": ["closure", "event", "deadline"]},
        "title": {"type": "string"},
        "starts_on": {"type": "string", "description": "ISO Datum JJJJ-MM-TT"},
        "ends_on": {"type": ["string", "null"], "description": "ISO oder null"},
        "all_day": {"type": "boolean"},
        "time_start": {"type": ["string", "null"], "description": "HH:MM oder null"},
        "time_end": {"type": ["string", "null"], "description": "HH:MM oder null"},
    },
    "required": [
        "category",
        "title",
        "starts_on",
        "ends_on",
        "all_day",
        "time_start",
        "time_end",
    ],
}

_OUTPUT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "content_type_suggested": {"type": "string", "enum": CONTENT_TYPES},
        "confidence": {"type": "number"},
        "title": {"type": "string"},
        "summary": {"type": "string"},
        # Calendar events — REQUIRED to be filled for event_notice (every concrete
        # date/Schließtag/Frist), otherwise an empty array. Drives /kalender + ICS.
        "events": {"type": "array", "items": _EVENT_SCHEMA},
        # Other type-specific detail as a JSON-object STRING (strict mode forbids
        # an open object); parsed server-side. Events live in `events`, not here.
        "payload_json": {
            "type": "string",
            "description": (
                "Typ-spezifische Detaildaten als JSON-OBJEKT-String "
                '(z.B. "{}" wenn keine). Wird serverseitig geparst.'
            ),
        },
    },
    "required": [
        "content_type_suggested",
        "confidence",
        "title",
        "summary",
        "events",
        "payload_json",
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
        "Unsicherheit Datum null lassen, niemals erfinden. Felder: "
        "content_type_suggested, confidence (0-1), title, summary, events, "
        'payload_json (typ-spezifische Details als JSON-Objekt-String, z.B. "{}"). '
        "WICHTIG für den Kalender: 'events' ist eine Liste. Wenn der Aushang "
        "konkrete Termine, Schließtage oder Fristen nennt (content_type "
        "event_notice, aber auch sonst), lege für JEDES Datum einen Eintrag an: "
        "category ('closure'=Schließtag, 'event'=Termin/Fest, 'deadline'=Frist), "
        "title (kurz), starts_on (JJJJ-MM-TT), ends_on (oder null), all_day "
        "(true wenn keine Uhrzeit), time_start/time_end (HH:MM oder null). "
        "Mehrtägige Schließungen entweder als ein Eintrag mit ends_on ODER als "
        "einzelne Tageseinträge. Gibt es keine Termine, ist events eine leere "
        "Liste []."
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
        # The model returns the free-form payload as a JSON STRING (payload_json)
        # because strict structured-output mode forbids an open object. Parse it
        # back into a dict so the rest of the pipeline + app see `payload` as
        # before. A malformed/empty string degrades to {} rather than failing the
        # whole extraction (the review gate validates per-type detail anyway).
        payload_json = raw.pop("payload_json", "{}")
        try:
            parsed = json.loads(payload_json) if payload_json else {}
            payload = parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            payload = {}
        # The calendar events come back as a top-level structured array (strict
        # schema). Fold them into payload.events — the shape the app + the
        # publish_post RPC read to create calendar rows.
        events = raw.pop("events", [])
        if isinstance(events, list) and events:
            payload["events"] = events
        raw["payload"] = payload
        return ExtractionEnvelope.model_validate(raw).normalized()
    except (json.JSONDecodeError, ValidationError, ValueError) as e:
        raise ValueError(f"extraction validation failed: {e}") from e


def _first_text(data: dict[str, Any]) -> str:
    """Pull the first text block out of an Anthropic messages response."""
    for block in data.get("content", []):
        if isinstance(block, dict) and block.get("type") == "text":
            return str(block.get("text", ""))
    raise ValueError("no text block in response")
