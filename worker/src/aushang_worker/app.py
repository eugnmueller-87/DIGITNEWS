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

from fastapi import FastAPI, Header, HTTPException, status

from .config import Settings, load_settings
from .models import ProcessAccepted, ProcessRequest

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
    x_worker_secret: str | None = Header(default=None),
) -> ProcessAccepted:
    """Accept a job. Authenticates via the shared secret, then (Phase 2) queues
    the redaction + extraction pipeline and returns an immediate ack.
    """
    _check_secret(x_worker_secret, _settings().worker_shared_secret)
    # Phase 2: enqueue the pipeline for req.image_url and call back on completion.
    return ProcessAccepted(post_id=req.post_id)
