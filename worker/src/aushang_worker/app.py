"""FastAPI app for the Aushang worker (Phase 2 skeleton).

Endpoints:
  GET  /health   — liveness probe (no auth).
  POST /process  — accept a redaction+extraction job (shared-secret auth).

The actual pipeline (OpenCV deskew -> OCR -> Presidio/spaCy/regex PII redaction
-> gaussian blur of redacted regions -> EU LLM on REDACTED text -> schema
validation -> callback) lands in Phase 2. This shell exists so the quality gates
(Ruff, mypy) have a real, typed target and the auth boundary is established now.
"""

from __future__ import annotations

import hmac
import logging
import os

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, status

from .config import Settings, load_settings
from .models import (
    ProcessAccepted,
    ProcessRequest,
    TranslateAccepted,
    TranslateRequest,
)
from .pipeline import process_job, translate_job

# Configure logging ONCE at import (uvicorn loads this module on startup). Without
# this, Python's root logger defaults to WARNING with no handler, so the worker's
# log.info()/log.warning() diagnostics (job outcomes, provider HTTP errors, callback
# failures) are silently dropped — which made a live extraction outage undiagnosable
# from `docker logs`. We attach a stdout handler at INFO (override via LOG_LEVEL) so
# every aushang.* log line is captured. All log lines are PII-free (IDs only).
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="Aushang Worker", version="0.1.0")


def _settings() -> Settings:
    # Resolved per-process; kept tiny so tests can monkeypatch the env.
    return load_settings()


def _check_secret(provided: str | None, expected: str) -> None:
    """Constant-time compare of the shared secret; reject on mismatch."""
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid worker secret",
        )


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe. No auth, no PII, IDs only."""
    return {"status": "ok"}


@app.post("/process", response_model=ProcessAccepted)
def process(
    req: ProcessRequest,
    background: BackgroundTasks,
    x_worker_secret: str | None = Header(default=None),
) -> ProcessAccepted:
    """Accept a job. Authenticates via the shared secret, enqueues the redaction
    + extraction pipeline in the background, and returns an immediate ack. The
    pipeline calls back to the app on completion (or failure).
    """
    settings = _settings()
    _check_secret(x_worker_secret, settings.worker_shared_secret)
    background.add_task(process_job, req, settings)
    return ProcessAccepted(post_id=req.post_id)


@app.post("/translate", response_model=TranslateAccepted)
def translate(
    req: TranslateRequest,
    background: BackgroundTasks,
    x_worker_secret: str | None = Header(default=None),
) -> TranslateAccepted:
    """Accept a publish-time translation job. Authenticates via the shared secret,
    enqueues translation in the background, and returns an immediate ack. The job
    calls back to the app with the translations (best-effort per locale). The body
    carries only the already-redacted, member-safe German content — no raw PII.
    """
    settings = _settings()
    _check_secret(x_worker_secret, settings.worker_shared_secret)
    background.add_task(translate_job, req, settings)
    return TranslateAccepted(post_id=req.post_id)
