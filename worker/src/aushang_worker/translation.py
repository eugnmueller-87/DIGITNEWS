"""Publish-time translation of member-visible post content — provider-agnostic.

Reuses the same provider endpoints/auth as extraction (Anthropic/Mistral/OpenAI/
Gemini, selected by LLM_PROVIDER). For strict EU residency the maintainer runs
Mistral (La Plateforme, EU).

PRIVACY: only ALREADY-REDACTED, member-safe German content is sent (the same text
members can read) — never raw OCR, never the source image, never raw PII. Redaction
placeholders ([NAME_1] etc.) are preserved verbatim in the translation.

APPROACH: we hand the model a JSON bundle of German strings (title, body, and the
structured payload + event titles) and ask it to return the SAME JSON shape with
every string VALUE translated and every KEY + placeholder left untouched. One call
per target locale. This is shape-agnostic, so it covers all content_type payloads
(meal_plan dishes, reflection summaries, health topic/action, info sections, event
names) without per-type code. Failure is non-fatal to the caller (best-effort):
the locale is simply omitted and read sites fall back to the German original.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from .extraction import (
    ANTHROPIC_MODEL,
    ANTHROPIC_URL,
    ANTHROPIC_VERSION,
    GEMINI_URL,
    MISTRAL_MODEL,
    MISTRAL_URL,
    OPENAI_MODEL,
    OPENAI_URL,
    PROVIDERS,
)

log = logging.getLogger("aushang.translation")

# Human-readable language names for the prompt (keep in sync with the app's LOCALES
# minus 'de', which is always the source).
LANGUAGE_NAMES = {
    "en": "English",
    "ru": "Russian (Русский)",
}


def _system_prompt(language: str) -> str:
    return (
        f"You are a professional translator for a childcare (Kita) noticeboard app. "
        f"Translate the German text VALUES in the given JSON object into {language}. "
        f"Rules:\n"
        f"- Return ONLY a JSON object with the EXACT same keys and structure.\n"
        f"- Translate string values only; keep all keys unchanged.\n"
        f"- Preserve placeholders like [NAME_1], [TEL_2], [EMAIL_1] EXACTLY — never "
        f"translate or alter them.\n"
        f"- Keep dates, numbers, Nutri-Score letters (A-E), and ISO date strings as-is.\n"
        f"- Use warm, clear, parent-friendly language.\n"
        f"- Do not add, remove, or reorder keys. Do not add explanations or markdown."
    )


def translate_bundle(
    *,
    api_key: str,
    bundle: dict[str, Any],
    target_locale: str,
    provider: str = "anthropic",
) -> dict[str, Any]:
    """Translate the string values of `bundle` into `target_locale`, returning the
    same JSON shape. Raises on transport/parse failure so the caller can treat the
    locale as best-effort (skip + German fallback). Never mutates `bundle`.
    """
    provider = (provider or "anthropic").lower()
    if provider not in PROVIDERS:
        raise RuntimeError(f"unknown LLM_PROVIDER {provider!r}")
    if not api_key:
        raise RuntimeError(f"API key not set for provider {provider!r}")

    language = LANGUAGE_NAMES.get(target_locale, target_locale)
    system = _system_prompt(language)
    user = json.dumps(bundle, ensure_ascii=False)

    caller = {
        "anthropic": _call_anthropic,
        "mistral": _call_mistral,
        "openai": _call_openai,
        "gemini": _call_gemini,
    }[provider]
    content = caller(api_key=api_key, system=system, text=user)

    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise ValueError("translation did not return a JSON object")
    return parsed


# --- Per-provider adapters: (system, text) -> raw JSON string -----------------
# json_object mode is the common denominator across all four providers (we don't
# need a fixed schema here — the shape is whatever bundle we sent).


def _call_anthropic(*, api_key: str, system: str, text: str) -> str:
    body = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": 4096,
        "system": system,
        "messages": [{"role": "user", "content": text}],
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
        for block in data.get("content", []):
            if isinstance(block, dict) and block.get("type") == "text":
                return _strip_fences(str(block.get("text", "")))
    raise ValueError("no text block in Anthropic response")


def _call_mistral(*, api_key: str, system: str, text: str) -> str:
    body = {
        "model": MISTRAL_MODEL,
        "messages": [
            {"role": "system", "content": system},
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


def _call_openai(*, api_key: str, system: str, text: str) -> str:
    body = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ],
        "response_format": {"type": "json_object"},
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


def _call_gemini(*, api_key: str, system: str, text: str) -> str:
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": text}]}],
        "generationConfig": {"response_mime_type": "application/json"},
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
        return _strip_fences(str(parts[0]["text"]))


def _strip_fences(s: str) -> str:
    """Remove a ```json ... ``` markdown fence if the model added one."""
    t = s.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1] if "\n" in t else t
        if t.endswith("```"):
            t = t[:-3]
        if t.startswith("json"):
            t = t[4:]
    return t.strip()
