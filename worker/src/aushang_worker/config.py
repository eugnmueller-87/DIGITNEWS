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

    # Base URL of the Next.js app the worker calls back to (e.g.
    # https://aushang.app). The callback writes the draft via the service role.
    app_callback_url: str

    # Claude API (Anthropic) key. Receives REDACTED text only — never raw images
    # or raw PII. Optional until the extraction step is wired.
    anthropic_api_key: str | None = None

    # Text-to-image cover endpoint (provider-agnostic; point at an EU-hosted
    # FLUX.1 [schnell] endpoint). Receives a no-PII decorative prompt only.
    # Both optional: when unset, cover generation is skipped (fail-open).
    image_api_url: str | None = None
    image_api_key: str | None = None


def load_settings() -> Settings:
    """Build Settings from the environment. Fails closed on a missing secret."""
    secret = os.environ.get("WORKER_SHARED_SECRET", "")
    if not secret:
        # Fail loud at startup rather than accept unauthenticated requests.
        raise RuntimeError("WORKER_SHARED_SECRET is required")
    callback = os.environ.get("APP_CALLBACK_URL", "")
    if not callback:
        raise RuntimeError("APP_CALLBACK_URL is required")
    return Settings(
        worker_shared_secret=secret,
        app_callback_url=callback,
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY") or None,
        image_api_url=os.environ.get("IMAGE_API_URL") or None,
        image_api_key=os.environ.get("IMAGE_API_KEY") or None,
    )
