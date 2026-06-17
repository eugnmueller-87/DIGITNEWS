"""Request/response models for the worker API (Phase 2 contract).

These mirror the TypeScript extraction contract in
`src/lib/content/extraction-schema.ts`. The worker validates the LLM output
against the same shape before calling back; validation failure => manual path.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    """Job the Next.js app hands to the worker for one photographed notice."""

    post_id: str = Field(..., description="The posts.id this job belongs to")
    org_id: str = Field(..., description="Owning org (for callback scoping)")
    image_url: str = Field(..., description="Short-TTL signed URL of the RAW image")
    org_type: str = Field(..., description="Domain vocabulary hint, e.g. 'kita'")
    capture_date: str = Field(
        ..., description="ISO date the photo was taken; relative dates resolve to it"
    )


class ProcessAccepted(BaseModel):
    """Immediate ack; the worker processes asynchronously and calls back."""

    accepted: bool = True
    post_id: str


class TranslateEvent(BaseModel):
    """One event title to translate (events created from this post at publish)."""

    id: str = Field(..., description="events.id")
    title: str = Field(..., description="German event title (already member-safe)")


class TranslateRequest(BaseModel):
    """Publish-time translation job. The app sends the FINAL, admin-confirmed,
    already-REDACTED German content; the worker translates into `locales` and calls
    back. Only member-safe text is ever sent — never raw OCR or the source image.
    """

    post_id: str = Field(..., description="The posts.id this translation belongs to")
    org_id: str = Field(..., description="Owning org (for callback scoping)")
    title: str = Field(default="", description="German title (redacted)")
    body: str = Field(default="", description="German body (redacted)")
    payload: dict[str, Any] | None = Field(
        default=None, description="German structured payload (redacted) or null"
    )
    events: list[TranslateEvent] = Field(
        default_factory=list, description="Event titles to translate"
    )
    locales: list[str] = Field(
        default_factory=lambda: ["en", "ru"], description="Target locales"
    )


class TranslateAccepted(BaseModel):
    """Immediate ack; the worker translates asynchronously and calls back."""

    accepted: bool = True
    post_id: str
