"""Request/response models for the worker API (Phase 2 contract).

These mirror the TypeScript extraction contract in
`src/lib/content/extraction-schema.ts`. The worker validates the LLM output
against the same shape before calling back; validation failure => manual path.
"""

from __future__ import annotations

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
