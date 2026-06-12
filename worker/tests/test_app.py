"""Smoke tests for the worker skeleton (auth boundary + health)."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Test config so load_settings() doesn't fail.
os.environ.setdefault("WORKER_SHARED_SECRET", "test-secret")
os.environ.setdefault("APP_CALLBACK_URL", "http://localhost:3000")

from aushang_worker.app import app

client = TestClient(app)


def test_health_ok() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def _job() -> dict[str, str]:
    return {
        "post_id": "p1",
        "org_id": "o1",
        "image_url": "https://example.test/signed.jpg",
        "org_type": "kita",
        "capture_date": "2026-06-12",
    }


def test_process_rejects_missing_secret() -> None:
    res = client.post("/process", json=_job())
    assert res.status_code == 401


def test_process_rejects_wrong_secret() -> None:
    res = client.post("/process", json=_job(), headers={"X-Worker-Secret": "wrong"})
    assert res.status_code == 401


def test_process_accepts_valid_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    # Stub the background pipeline so the test verifies the ACK contract only —
    # the real pipeline (network + ML stack) is exercised at deploy time, and its
    # pure parts (redaction) have their own unit tests.
    called: dict[str, str] = {}

    def _fake_process_job(req: object, settings: object) -> None:
        called["post_id"] = req.post_id  # type: ignore[attr-defined]

    monkeypatch.setattr("aushang_worker.app.process_job", _fake_process_job)
    res = client.post(
        "/process", json=_job(), headers={"X-Worker-Secret": "test-secret"}
    )
    assert res.status_code == 200
    assert res.json() == {"accepted": True, "post_id": "p1"}
    assert called["post_id"] == "p1"


@pytest.mark.parametrize("missing", ["post_id", "image_url", "capture_date"])
def test_process_validates_required_fields(missing: str) -> None:
    job = _job()
    del job[missing]
    res = client.post("/process", json=job, headers={"X-Worker-Secret": "test-secret"})
    assert res.status_code == 422
