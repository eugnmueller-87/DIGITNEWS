"""Unit tests for extraction guards. The empty-OCR guard short-circuits BEFORE any
provider call, so these need no network — they exercise the exact bug where a
blank/blurry photo (OCR -> empty text) used to hit the LLM with empty content and
fail with an opaque provider 400."""

from __future__ import annotations

import pytest

from aushang_worker.extraction import EmptyExtractionInputError, extract


@pytest.mark.parametrize("text", ["", "   ", "\n\t ", "ab"])
def test_extract_rejects_empty_or_tiny_text(text: str) -> None:
    # No API call happens — the guard raises before any provider is invoked, so a
    # dummy key/provider is fine. This is the fix for the "no readable text" crash.
    with pytest.raises(EmptyExtractionInputError):
        extract(
            api_key="dummy",
            redacted_text=text,
            org_type="kita",
            capture_date="2026-06-17",
            provider="anthropic",
        )


def test_empty_extraction_error_is_a_valueerror() -> None:
    # The pipeline catches it specifically, but it stays a ValueError so any generic
    # ValueError handling still applies.
    assert issubclass(EmptyExtractionInputError, ValueError)
