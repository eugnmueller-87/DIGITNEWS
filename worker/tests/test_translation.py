"""Unit tests for publish-time translation. The provider HTTP call is stubbed —
we verify the bundle round-trips, placeholders are preserved by our handling, and
translate_job assembles the callback payload (best-effort per locale)."""

from __future__ import annotations

import json
from typing import Any

import pytest

from aushang_worker import pipeline, translation
from aushang_worker.config import Settings
from aushang_worker.models import TranslateEvent, TranslateRequest


def _settings() -> Settings:
    return Settings(
        worker_shared_secret="s",
        app_callback_url="http://localhost:3000",
        llm_provider="mistral",
        llm_api_key="key",
    )


def test_translate_bundle_returns_same_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    # Stub the provider caller: echo a "translated" object with the same keys.
    def _fake_call(*, api_key: str, system: str, text: str) -> str:
        src = json.loads(text)
        # Pretend to translate by suffixing values; keep structure + placeholders.
        out = {
            "title": src["title"] + " [EN]",
            "body": src["body"],
            "events": {k: v + " [EN]" for k, v in src.get("events", {}).items()},
        }
        return json.dumps(out)

    monkeypatch.setattr(translation, "_call_mistral", _fake_call)
    out = translation.translate_bundle(
        api_key="key",
        bundle={
            "title": "Fest",
            "body": "Hallo [NAME_1]",
            "events": {"e1": "Sommerfest"},
        },
        target_locale="en",
        provider="mistral",
    )
    assert out["title"] == "Fest [EN]"
    assert out["body"] == "Hallo [NAME_1]"  # placeholder untouched
    assert out["events"]["e1"] == "Sommerfest [EN]"


def test_translate_bundle_rejects_non_object(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(translation, "_call_mistral", lambda **k: "[1, 2, 3]")
    with pytest.raises(ValueError):
        translation.translate_bundle(
            api_key="key", bundle={"title": "x"}, target_locale="en", provider="mistral"
        )


def test_strip_fences() -> None:
    assert translation._strip_fences('```json\n{"a":1}\n```') == '{"a":1}'
    assert translation._strip_fences('{"a":1}') == '{"a":1}'


def test_translate_job_collects_locales_and_calls_back(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Stub translate_bundle to return a per-locale tagged result.
    def _fake_bundle(
        *, api_key: str, bundle: dict[str, Any], target_locale: str, provider: str
    ) -> dict[str, Any]:
        return {
            "title": f"T-{target_locale}",
            "body": f"B-{target_locale}",
            "events": {
                e: f"{t}-{target_locale}" for e, t in bundle.get("events", {}).items()
            },
        }

    monkeypatch.setattr(pipeline, "translate_bundle", _fake_bundle)

    captured: dict[str, Any] = {}

    def _fake_callback(
        req: Any, settings: Any, translations: Any, event_titles: Any
    ) -> None:
        captured["translations"] = translations
        captured["event_titles"] = event_titles

    monkeypatch.setattr(pipeline, "_callback_translations", _fake_callback)

    req = TranslateRequest(
        post_id="p1",
        org_id="o1",
        title="Titel",
        body="Text",
        payload=None,
        events=[TranslateEvent(id="e1", title="Sommerfest")],
        locales=["en", "ru", "de"],  # 'de' must be skipped (source language)
    )
    pipeline.translate_job(req, _settings())

    assert set(captured["translations"]) == {"en", "ru"}  # de skipped
    assert captured["translations"]["en"]["title"] == "T-en"
    assert captured["event_titles"]["ru"]["e1"] == "Sommerfest-ru"


def test_translate_job_best_effort_on_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    # en fails, ru succeeds — en is omitted, ru still delivered.
    def _fake_bundle(
        *, api_key: str, bundle: dict[str, Any], target_locale: str, provider: str
    ) -> dict[str, Any]:
        if target_locale == "en":
            raise RuntimeError("provider down")
        return {"title": "ok", "body": "ok"}

    monkeypatch.setattr(pipeline, "translate_bundle", _fake_bundle)

    captured: dict[str, Any] = {}
    monkeypatch.setattr(
        pipeline,
        "_callback_translations",
        lambda req, settings, translations, event_titles: captured.update(
            translations=translations
        ),
    )

    req = TranslateRequest(
        post_id="p1", org_id="o1", title="t", body="b", locales=["en", "ru"]
    )
    pipeline.translate_job(req, _settings())
    assert set(captured["translations"]) == {"ru"}  # en dropped, ru kept
