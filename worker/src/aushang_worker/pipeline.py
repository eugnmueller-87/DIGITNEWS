"""End-to-end pipeline: fetch image → preprocess → OCR → redact → blur → LLM →
validate → callback. All processing logs are PII-free (IDs only)."""

from __future__ import annotations

import logging

import httpx

from .config import Settings
from .cover import generate_cover
from .extraction import extract
from .models import ProcessRequest
from .ocr import preprocess, run_ocr
from .redaction import redact

log = logging.getLogger("aushang.pipeline")


def _blur_redacted_regions(
    image_bytes: bytes,
    boxes: list[tuple[str, int, int, int, int]],
    redacted_words: set[str],
) -> bytes:  # pragma: no cover - needs cv2
    """Gaussian-blur the image regions whose OCR word was redacted."""
    try:
        import cv2
        import numpy as np

        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes
        for word, x, y, w, h in boxes:
            if word in redacted_words:
                roi = img[y : y + h, x : x + w]
                if roi.size:
                    img[y : y + h, x : x + w] = cv2.GaussianBlur(roi, (45, 45), 0)
        ok, buf = cv2.imencode(".jpg", img)
        return buf.tobytes() if ok else image_bytes
    except Exception:
        return image_bytes


def process_job(req: ProcessRequest, settings: Settings) -> None:
    """Run the full pipeline for one job and call back with the result.

    On any failure, calls back to mark the post 'failed' (manual path). Never
    raises out of the worker thread.
    """
    try:
        # 1. Fetch the raw image via the short-TTL signed URL.
        with httpx.Client(timeout=60) as client:
            image_bytes = client.get(req.image_url).content

        # 2. Preprocess (deskew/contrast) for better OCR.
        pre = preprocess(image_bytes)

        # 3. OCR (German) → text + word boxes.
        ocr = run_ocr(pre)

        # 4. LOCAL PII redaction (fail-closed). Only redacted text leaves here.
        red = redact(ocr.text)

        # 5. Blur the redacted regions in the image.
        redacted_words = {r.original for r in red.redactions}
        redacted_image = _blur_redacted_regions(image_bytes, ocr.boxes, redacted_words)

        # 6. LLM extraction on REDACTED text only (provider per LLM_PROVIDER).
        envelope = extract(
            api_key=settings.llm_api_key or "",
            redacted_text=red.redacted_text,
            org_type=req.org_type,
            capture_date=req.capture_date,
            provider=settings.llm_provider,
        )

        # 6.5 Decorative cover (text-to-image) from the SUGGESTED content_type —
        # no PII, no people. FAIL-OPEN: None when unconfigured or on any error.
        cover_image = generate_cover(
            api_url=settings.image_api_url,
            api_key=settings.image_api_key,
            content_type=envelope.content_type_suggested,
        )

        # 7. Callback: write the draft (with the cover if we got one).
        _callback_draft(req, settings, ocr, red, redacted_image, envelope, cover_image)
        log.info("job %s -> draft (%s)", req.post_id, envelope.content_type_suggested)

    except Exception as e:
        log.warning("job %s failed: %s", req.post_id, type(e).__name__)
        _callback_failed(req, settings, type(e).__name__)


def _callback_url(settings: Settings, path: str) -> str:
    base = settings.app_callback_url.rstrip("/")
    return f"{base}{path}"


def _callback_draft(  # type: ignore[no-untyped-def]
    req, settings, ocr, red, redacted_image, envelope, cover_image: bytes | None = None
) -> None:
    # Upload the redacted image (+ optional cover), then post the draft payload to
    # the app callback. (The app route validates the shared secret and writes via
    # worker_write_draft.)
    redactions_json = [
        {
            "placeholder": r.placeholder,
            "type": r.entity_type,
            "confidence": r.confidence,
            "kept": True,
        }
        for r in red.redactions
    ]
    with httpx.Client(timeout=60) as client:
        files = {"redacted_image": ("redacted.jpg", redacted_image, "image/jpeg")}
        if cover_image:
            files["cover_image"] = ("cover.jpg", cover_image, "image/jpeg")
        data = {
            "post_id": req.post_id,
            "org_id": req.org_id,
            "ocr_text_raw": ocr.text,
            "ocr_text_redacted": red.redacted_text,
            "redactions": _dumps(redactions_json),
            "extraction": envelope.model_dump_json(),
            "title": envelope.title,
            "summary": envelope.summary,
            "content_type_suggested": envelope.content_type_suggested,
        }
        client.post(
            _callback_url(settings, "/api/worker/callback"),
            headers={"X-Worker-Secret": settings.worker_shared_secret},
            data=data,
            files=files,
        )


def _callback_failed(req, settings, reason: str) -> None:  # type: ignore[no-untyped-def]
    with httpx.Client(timeout=30) as client:
        client.post(
            _callback_url(settings, "/api/worker/callback"),
            headers={"X-Worker-Secret": settings.worker_shared_secret},
            data={"post_id": req.post_id, "failed": "1", "reason": reason},
        )


def _dumps(obj: object) -> str:
    import json

    return json.dumps(obj, ensure_ascii=False)
