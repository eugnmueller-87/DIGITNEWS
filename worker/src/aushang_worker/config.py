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

    # LLM provider for structure extraction: anthropic | mistral | openai |
    # gemini. Defaults to anthropic. Receives REDACTED text only.
    llm_provider: str = "anthropic"

    # The API key for the selected provider (resolved from the provider-specific
    # env var). Optional until the extraction step is wired.
    llm_api_key: str | None = None

    # Text-to-image cover endpoint (provider-agnostic; point at an EU-hosted
    # FLUX.1 [schnell] endpoint). Receives a no-PII decorative prompt only.
    # Both optional: when unset, cover generation is skipped (fail-open).
    image_api_url: str | None = None
    image_api_key: str | None = None


# Map provider -> the env var that holds ITS key. The wizard writes the matching
# one. ANTHROPIC_API_KEY stays the default so existing deployments are unchanged.
_PROVIDER_KEY_ENV = {
    "anthropic": "ANTHROPIC_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
}


def load_settings() -> Settings:
    """Build Settings from the environment. Fails closed on a missing secret."""
    secret = os.environ.get("WORKER_SHARED_SECRET", "")
    if not secret:
        # Fail loud at startup rather than accept unauthenticated requests.
        raise RuntimeError("WORKER_SHARED_SECRET is required")
    callback = os.environ.get("APP_CALLBACK_URL", "")
    if not callback:
        raise RuntimeError("APP_CALLBACK_URL is required")
    provider = (os.environ.get("LLM_PROVIDER") or "anthropic").lower()
    key_env = _PROVIDER_KEY_ENV.get(provider, "ANTHROPIC_API_KEY")
    # Prefer the provider-specific key; fall back to a generic LLM_API_KEY.
    llm_key = os.environ.get(key_env) or os.environ.get("LLM_API_KEY") or None
    return Settings(
        worker_shared_secret=secret,
        app_callback_url=callback,
        llm_provider=provider,
        llm_api_key=llm_key,
        image_api_url=os.environ.get("IMAGE_API_URL") or None,
        image_api_key=os.environ.get("IMAGE_API_KEY") or None,
    )
