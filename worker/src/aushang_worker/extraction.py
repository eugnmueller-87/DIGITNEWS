"""Structured extraction via the EU LLM (Mistral) on REDACTED text only.

The LLM receives ONLY redacted text (placeholders like [NAME_1] preserved
verbatim). Its JSON output is validated against the shared contract (mirrors
src/lib/content/extraction-schema.ts). Validation failure => the caller routes
the post to the manual path; nothing is ever auto-published.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_MODEL = "mistral-small-latest"

CONTENT_TYPES = [
    "meal_plan",
    "reflection",
    "health_notice",
    "event_notice",
    "info",
]


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
        "Platzhalter wie [NAME_1] MUSST du unverändert übernehmen. Antworte NUR "
        "mit JSON (keine Markdown-Fences). Klassifiziere den Aushang als einen "
        "von: meal_plan (Speiseplan), reflection (Wochenrückblick), "
        "health_notice (Krankheit/Hinweis), event_notice (Termine/Schließtage), "
        "info (Sonstiges). Löse relative Daten gegen das Aufnahmedatum "
        f"{capture_date} auf (Zeitzone Europe/Berlin); bei Unsicherheit Datum "
        "null lassen, niemals erfinden. Felder: content_type_suggested, "
        "confidence (0-1), title, summary, payload (typ-spezifisch)."
    )


def extract(
    *, api_key: str, redacted_text: str, org_type: str, capture_date: str
) -> ExtractionEnvelope:
    """Call Mistral on the redacted text and return the validated envelope.

    Raises on transport error or validation failure (caller -> manual path).
    """
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY not set")

    body = {
        "model": MISTRAL_MODEL,
        "messages": [
            {"role": "system", "content": _system_prompt(org_type, capture_date)},
            {"role": "user", "content": redacted_text},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
    }
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            MISTRAL_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json=body,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]

    try:
        raw = json.loads(content)
        return ExtractionEnvelope.model_validate(raw).normalized()
    except (json.JSONDecodeError, ValidationError, ValueError) as e:
        raise ValueError(f"extraction validation failed: {e}") from e
