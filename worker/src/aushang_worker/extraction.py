"""Structured extraction on REDACTED text only — provider-agnostic.

The LLM receives ONLY redacted text (placeholders like [NAME_1] preserved
verbatim). Its JSON output is validated against the shared contract (mirrors
src/lib/content/extraction-schema.ts). Validation failure => the caller routes
the post to the manual path; nothing is ever auto-published.

MULTI-PROVIDER: the worker can call Anthropic, Mistral, OpenAI, or Gemini,
selected by LLM_PROVIDER. Each provider has its own endpoint / auth / structured-
output mechanism, but they all return the SAME validated ExtractionEnvelope, so
the rest of the pipeline is unchanged. The maintainer's deployment uses Anthropic;
the self-host wizard lets an operator pick a provider and supply THEIR OWN key.

PRIVACY NOTE: provider choice does not change the privacy model — only locally-
redacted text is ever sent (PII already masked to [NAME_1]-style placeholders),
never raw images, never raw PII. Data RESIDENCY does differ: Anthropic/OpenAI are
US-hosted; Mistral (La Plateforme) is EU — pick Mistral for strict EU residency.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

# --- Provider endpoints + default models ------------------------------------
# All use a cheap/fast model for structured extraction. Each provider's
# structured-output mechanism differs (see the per-provider _call_* below).
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-haiku-4-5"
ANTHROPIC_VERSION = "2023-06-01"

MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_MODEL = "mistral-small-latest"

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-4o-mini"

# Gemini uses the model in the path + the key as a query param.
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

PROVIDERS = ("anthropic", "mistral", "openai", "gemini")

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
# NOTE 1: strict mode rejects an `enum` that mixes a value list with null + a
# union type, so constrained fields use type+description only (the prompt + the
# downstream review gate constrain the actual values).
# NOTE 2: Anthropic caps a schema at 16 union/nullable parameters. So ONLY the
# genuinely date-semantic fields (where null ≠ "") stay nullable; everything
# else is a plain string and the model emits "" when there's nothing — the app
# treats empty as absent. This keeps us under the union limit.
_DAY = {"type": "string", "description": "mon|tue|wed|thu|fri oder leer"}
_ISO = {"type": ["string", "null"], "description": "ISO Datum JJJJ-MM-TT oder null"}
_NUTRI = {"type": "string", "description": "A|B|C|D|E oder leer (Schätzung)"}
_HHMM = {"type": "string", "description": "HH:MM oder leer"}
_STR = {"type": "string", "description": "Text oder leer"}


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
    *,
    api_key: str,
    redacted_text: str,
    org_type: str,
    capture_date: str,
    provider: str = "anthropic",
) -> ExtractionEnvelope:
    """Extract structure from REDACTED text via the chosen provider, returning
    the validated envelope. Raises on transport/validation failure (caller ->
    manual path). All providers return the SAME envelope shape.
    """
    provider = (provider or "anthropic").lower()
    if provider not in PROVIDERS:
        raise RuntimeError(f"unknown LLM_PROVIDER {provider!r}")
    if not api_key:
        raise RuntimeError(f"API key not set for provider {provider!r}")

    system = _system_prompt(org_type, capture_date)
    caller = {
        "anthropic": _call_anthropic,
        "mistral": _call_mistral,
        "openai": _call_openai,
        "gemini": _call_gemini,
    }[provider]
    content = caller(api_key=api_key, system=system, text=redacted_text)
    return _validate_envelope(content)


def _validate_envelope(content: str) -> ExtractionEnvelope:
    """Parse the model's JSON text into the validated envelope (provider-agnostic).

    The schema carries all five typed payloads under `details` (the model fills
    the one matching content_type, nulls the rest). Collapse the matching branch
    into `payload` — the shape the app + publish_post read.
    """
    try:
        raw = json.loads(content)
        details = raw.pop("details", {}) or {}
        ct = raw.get("content_type_suggested")
        branch = details.get(ct) if isinstance(details, dict) else None
        raw["payload"] = branch if isinstance(branch, dict) else {}
        return ExtractionEnvelope.model_validate(raw).normalized()
    except (json.JSONDecodeError, ValidationError, ValueError) as e:
        raise ValueError(f"extraction validation failed: {e}") from e


# --- Per-provider adapters: (system, text) -> raw JSON string ---------------
# Each constrains the model to JSON and returns the response text. The schema is
# enforced natively where supported (Anthropic output_config, OpenAI/Gemini
# json_schema); Mistral uses json_object mode + the schema embedded in the prompt.


def _call_anthropic(*, api_key: str, system: str, text: str) -> str:
    body = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": 4096,
        "system": system,
        "messages": [{"role": "user", "content": text}],
        "output_config": {"format": {"type": "json_schema", "schema": _OUTPUT_SCHEMA}},
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
        if data.get("stop_reason") == "refusal":
            raise ValueError("extraction refused by safety classifier")
        for block in data.get("content", []):
            if isinstance(block, dict) and block.get("type") == "text":
                return str(block.get("text", ""))
    raise ValueError("no text block in Anthropic response")


def _call_openai(*, api_key: str, system: str, text: str) -> str:
    body = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "aushang_extraction",
                "schema": _OUTPUT_SCHEMA,
                "strict": True,
            },
        },
    }
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            OPENAI_URL,
            headers={
                "authorization": f"Bearer {api_key}",
                "content-type": "application/json",
            },
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        return str(data["choices"][0]["message"]["content"])


def _call_mistral(*, api_key: str, system: str, text: str) -> str:
    # Mistral supports json_object mode (not full json_schema), so the schema is
    # carried in the system prompt and we request a JSON object back.
    sys_with_schema = (
        f"{system}\n\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt, das diesem "
        f"JSON-Schema entspricht (keine Erklärungen, kein Markdown):\n"
        f"{json.dumps(_OUTPUT_SCHEMA, ensure_ascii=False)}"
    )
    body = {
        "model": MISTRAL_MODEL,
        "messages": [
            {"role": "system", "content": sys_with_schema},
            {"role": "user", "content": text},
        ],
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            MISTRAL_URL,
            headers={
                "authorization": f"Bearer {api_key}",
                "content-type": "application/json",
            },
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        return str(data["choices"][0]["message"]["content"])


def _call_gemini(*, api_key: str, system: str, text: str) -> str:
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": _gemini_schema(_OUTPUT_SCHEMA),
        },
    }
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            GEMINI_URL,
            params={"key": api_key},
            headers={"content-type": "application/json"},
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        parts = data["candidates"][0]["content"]["parts"]
        return str(parts[0]["text"])


def _gemini_schema(schema: Any) -> Any:
    """Gemini's responseSchema is OpenAPI-ish and rejects `additionalProperties`
    and JSON-Schema `type` arrays. Strip those recursively so our schema is
    accepted (the prompt + downstream validation still constrain the output)."""
    if isinstance(schema, dict):
        out = {}
        for k, v in schema.items():
            if k == "additionalProperties":
                continue
            if k == "type" and isinstance(v, list):
                # take the first non-null type (Gemini wants a scalar type)
                v = next((t for t in v if t != "null"), "string")
            out[k] = _gemini_schema(v)
        return out
    if isinstance(schema, list):
        return [_gemini_schema(x) for x in schema]
    return schema
