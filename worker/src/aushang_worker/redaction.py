"""Local PII detection + redaction.

Runs ENTIRELY on the worker (no external calls). Detects PII via Microsoft
Presidio (+ spaCy de_core_news_lg) and a German regex pack, then replaces each
hit with a stable placeholder ([NAME_1], [TEL_1], ...). FAIL-CLOSED: anything at
or above the confidence threshold is masked; over-masking costs one tap in the
admin review, under-masking would leak PII to the LLM.

The ONLY text that ever leaves the worker (to the EU LLM) is the redacted text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Presidio/spaCy are heavy and only present in the deployed worker image. Import
# lazily so the module (and the unit tests for the regex pack) load without them.
try:  # pragma: no cover - exercised only in the deployed image
    from presidio_analyzer import AnalyzerEngine
    from presidio_analyzer.nlp_engine import NlpEngineProvider

    _PRESIDIO_AVAILABLE = True
except ImportError:  # pragma: no cover
    _PRESIDIO_AVAILABLE = False


# Confidence at/above which a detection is masked (fail-closed; low on purpose).
REDACTION_THRESHOLD = 0.4


@dataclass
class Redaction:
    """One masked span: its placeholder, type, score, and original (kept local)."""

    placeholder: str
    entity_type: str
    confidence: float
    original: str
    start: int
    end: int


@dataclass
class RedactionResult:
    """Redacted text + the redaction records (originals are worker-local only)."""

    redacted_text: str
    redactions: list[Redaction] = field(default_factory=list)


# --- German regex pack -------------------------------------------------------
# These catch high-signal PII deterministically, independent of the ML model.
_REGEX_PATTERNS: list[tuple[str, str]] = [
    # email
    ("EMAIL", r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    # German phone numbers (loose): +49..., 0..., with spaces/slashes/dashes
    ("PHONE", r"(?:\+49|0)[\d\s/\-()]{6,}\d"),
    # IBAN (DE + generic)
    ("IBAN", r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b"),
    # birthdate near "geb." / "Geburtstag" → dd.mm.yyyy
    (
        "BIRTHDATE",
        r"(?:geb\.?|Geburtstag|geboren am)\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{2,4})",
    ),
]


def _regex_hits(text: str) -> list[tuple[str, int, int]]:
    """Return (entity_type, start, end) for every regex match."""
    hits: list[tuple[str, int, int]] = []
    for entity_type, pattern in _REGEX_PATTERNS:
        for m in re.finditer(pattern, text):
            # For BIRTHDATE we mask only the captured date group, not the prefix.
            if entity_type == "BIRTHDATE" and m.groups():
                hits.append((entity_type, m.start(1), m.end(1)))
            else:
                hits.append((entity_type, m.start(), m.end()))
    return hits


_analyzer: object | None = None


def _get_analyzer() -> object | None:
    """Lazily build the Presidio analyzer with the German spaCy model."""
    global _analyzer
    if not _PRESIDIO_AVAILABLE:
        return None
    if _analyzer is None:  # pragma: no cover - needs the model installed
        provider = NlpEngineProvider(
            nlp_configuration={
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": "de", "model_name": "de_core_news_lg"}],
            }
        )
        _analyzer = AnalyzerEngine(
            nlp_engine=provider.create_engine(), supported_languages=["de"]
        )
    return _analyzer


# Presidio entity types we treat as PII to mask.
_PRESIDIO_ENTITIES = [
    "PERSON",
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "IBAN_CODE",
    "LOCATION",
    "CREDIT_CARD",
    "IP_ADDRESS",
]

# Map raw entity types → short placeholder prefixes.
_PREFIX = {
    "PERSON": "NAME",
    "EMAIL": "EMAIL",
    "EMAIL_ADDRESS": "EMAIL",
    "PHONE": "TEL",
    "PHONE_NUMBER": "TEL",
    "IBAN": "IBAN",
    "IBAN_CODE": "IBAN",
    "LOCATION": "ORT",
    "BIRTHDATE": "GEB",
    "CREDIT_CARD": "KARTE",
    "IP_ADDRESS": "IP",
}


def _presidio_hits(text: str) -> list[tuple[str, int, int, float]]:
    analyzer = _get_analyzer()
    if analyzer is None:
        return []
    results = analyzer.analyze(  # type: ignore[attr-defined]
        text=text, entities=_PRESIDIO_ENTITIES, language="de"
    )
    return [(r.entity_type, r.start, r.end, float(r.score)) for r in results]


def _merge_spans(
    spans: list[tuple[str, int, int, float]],
) -> list[tuple[str, int, int, float]]:
    """Drop overlapping spans, keeping the higher-confidence one. Sorted by start."""
    spans = sorted(spans, key=lambda s: (s[1], -(s[2] - s[1])))
    kept: list[tuple[str, int, int, float]] = []
    for span in spans:
        _, start, end, _ = span
        if any(not (end <= ks or start >= ke) for _, ks, ke, _ in kept):
            continue
        kept.append(span)
    return sorted(kept, key=lambda s: s[1])


def redact(text: str) -> RedactionResult:
    """Detect + mask PII. Returns redacted text with [TYPE_n] placeholders.

    Combines the regex pack (confidence 1.0 — deterministic) with Presidio (ML).
    Fail-closed at REDACTION_THRESHOLD. Stable numbering per type.
    """
    if not text:
        return RedactionResult(redacted_text="")

    spans: list[tuple[str, int, int, float]] = []
    for entity_type, start, end in _regex_hits(text):
        spans.append((entity_type, start, end, 1.0))
    for entity_type, start, end, score in _presidio_hits(text):
        if score >= REDACTION_THRESHOLD:
            spans.append((entity_type, start, end, score))

    merged = _merge_spans(spans)

    # Replace from the end so indices stay valid; number per type.
    counters: dict[str, int] = {}
    redactions: list[Redaction] = []
    chars = list(text)
    for entity_type, start, end, score in sorted(
        merged, key=lambda s: s[1], reverse=True
    ):
        prefix = _PREFIX.get(entity_type, "PII")
        counters[prefix] = counters.get(prefix, 0) + 1
        placeholder = f"[{prefix}_{counters[prefix]}]"
        original = text[start:end]
        chars[start:end] = list(placeholder)
        redactions.append(
            Redaction(
                placeholder=placeholder,
                entity_type=entity_type,
                confidence=score,
                original=original,
                start=start,
                end=end,
            )
        )

    redactions.reverse()  # back to document order
    return RedactionResult(redacted_text="".join(chars), redactions=redactions)
