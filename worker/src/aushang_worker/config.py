"""Worker configuration, loaded from the environment.

Secrets (the shared secret, the LLM key) come from env only — never hardcoded.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Immutable worker settings resolved from the environment."""

    # Shared secret the Next.js app sends in the X-Worker-Secret header. The
    # worker rejects any request without an exact match. Required in production.
    worker_shared_secret: str

    # EU LLM (Mistral) API key. Receives REDACTED text only. Optional until the
    # extraction step is wired in Phase 2.
    mistral_api_key: str | None = None


def load_settings() -> Settings:
    """Build Settings from the environment. Fails closed on a missing secret."""
    secret = os.environ.get("WORKER_SHARED_SECRET", "")
    if not secret:
        # Fail loud at startup rather than accept unauthenticated requests.
        raise RuntimeError("WORKER_SHARED_SECRET is required")
    return Settings(
        worker_shared_secret=secret,
        mistral_api_key=os.environ.get("MISTRAL_API_KEY") or None,
    )
