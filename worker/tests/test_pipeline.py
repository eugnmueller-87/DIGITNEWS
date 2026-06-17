"""Tests for process_job routing. The OCR/cv2/LLM stack is mocked so we verify the
control flow: a photo-dominant notice (empty OCR) must produce an EMPTY DRAFT for
the admin to fill — NOT a failure (which would block posting a legitimate photo
notice). A normal text notice goes through extraction as before."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from aushang_worker import pipeline
from aushang_worker.config import Settings
from aushang_worker.models import ProcessRequest


def _settings() -> Settings:
    return Settings(
        worker_shared_secret="s",
        app_callback_url="http://localhost:3000",
        llm_provider="anthropic",
        llm_api_key="key",
    )


def _req() -> ProcessRequest:
    return ProcessRequest(
        post_id="p1",
        org_id="o1",
        image_url="http://img.test/x.jpg",
        org_type="kita",
        capture_date="2026-06-17",
    )


def _patch_common(monkeypatch: pytest.MonkeyPatch, ocr_text: str) -> dict[str, Any]:
    """Stub image fetch, preprocess, OCR, redact, blur. Returns a dict the test
    inspects to see which callback fired."""
    calls: dict[str, Any] = {}

    # httpx image fetch -> dummy bytes
    monkeypatch.setattr(
        pipeline.httpx,
        "Client",
        lambda *a, **k: _FakeClient(),
    )
    monkeypatch.setattr(pipeline, "preprocess", lambda b: b)
    monkeypatch.setattr(
        pipeline,
        "run_ocr",
        lambda b: SimpleNamespace(text=ocr_text, boxes=[]),
    )
    monkeypatch.setattr(
        pipeline,
        "redact",
        lambda t: SimpleNamespace(redacted_text=t, redactions=[]),
    )
    monkeypatch.setattr(pipeline, "_blur_redacted_regions", lambda *a: b"img")
    monkeypatch.setattr(pipeline, "generate_cover", lambda **k: None)

    monkeypatch.setattr(
        pipeline,
        "_callback_draft",
        lambda req, settings, ocr, red, img, env, cover: calls.update(
            draft=env.content_type_suggested, title=env.title
        ),
    )
    monkeypatch.setattr(
        pipeline,
        "_callback_failed",
        lambda req, settings, reason: calls.update(failed=reason),
    )
    return calls


class _FakeResp:
    content = b"\xff\xd8jpegbytes"


class _FakeClient:
    def __enter__(self) -> _FakeClient:
        return self

    def __exit__(self, *a: object) -> None:
        return None

    def get(self, url: str, **k: Any) -> _FakeResp:
        return _FakeResp()


def test_empty_ocr_produces_empty_draft_not_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _patch_common(monkeypatch, ocr_text="   ")  # photo-only, no text
    # extract must NOT be called for the empty path; make it explode if it is.
    monkeypatch.setattr(
        pipeline,
        "extract",
        lambda **k: (_ for _ in ()).throw(
            AssertionError("extract called on empty OCR")
        ),
    )
    pipeline.process_job(_req(), _settings())
    assert calls.get("draft") == "info"  # empty draft created
    assert calls.get("title") == ""  # title blank for the admin to fill
    assert "failed" not in calls  # NOT a failure


def test_normal_text_goes_through_extraction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _patch_common(monkeypatch, ocr_text="Sommerfest am 12.07.2026.")
    monkeypatch.setattr(
        pipeline,
        "extract",
        lambda **k: SimpleNamespace(
            content_type_suggested="event_notice",
            title="Sommerfest",
            summary="…",
            model_dump_json=lambda: "{}",
        ),
    )
    pipeline.process_job(_req(), _settings())
    assert calls.get("draft") == "event_notice"
    assert "failed" not in calls
