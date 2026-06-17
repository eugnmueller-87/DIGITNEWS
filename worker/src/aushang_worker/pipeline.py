"""End-to-end pipeline: fetch image → preprocess → OCR → redact (text) → LLM →
validate → callback. The IMAGE is stored unblurred (a Kita board is public, so its
text isn't sensitive); only the extracted TEXT is redacted before the LLM. All
processing logs are PII-free (IDs only)."""

from __future__ import annotations

import logging

import httpx

from .config import Settings
from .cover import generate_cover
from .extraction import (
    MIN_OCR_CHARS,
    EmptyExtractionInputError,
    empty_envelope,
    extract,
)
from .models import ProcessRequest, TranslateRequest
from .ocr import preprocess, run_ocr
from .redaction import redact
from .translation import translate_bundle

log = logging.getLogger("aushang.pipeline")


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

        # 4. LOCAL PII redaction of the TEXT (fail-closed). Only redacted text ever
        # leaves here for the LLM. The IMAGE is not blurred — a Kita board is public,
        # so the photo's text isn't sensitive (see note below).
        red = redact(ocr.text)

        # 5. The stored member-facing photo is the original (no text blurring). The
        # privacy model is unchanged: raw originals stay member-REVOKE'd and are only
        # released via the double-gated photo consent (src/lib/photo.ts).
        redacted_image = image_bytes

        # 6. PHOTO-DOMINANT notice (little/no readable text — e.g. a board that is
        # mostly children's activity photos). OCR yields ~nothing, so there is
        # nothing to extract. Rather than fail (which blocks the admin from posting
        # a legitimate photo notice), produce an EMPTY draft: the photo with
        # empty title/text for the admin to fill in /review. Skip the LLM entirely
        # (an empty prompt 400s everywhere). content_type stays unconfirmed; the
        # admin picks the type on review.
        # NOTE: this is the WEB-APP rule. The native-app phase will introduce a
        # stricter ruleset for photos containing children (per product decision).
        if len(red.redacted_text.strip()) < MIN_OCR_CHARS:
            log.info(
                "job %s -> empty draft (no readable text, photo-only)", req.post_id
            )
            _callback_draft(
                req, settings, ocr, red, redacted_image, empty_envelope(), None
            )
            return

        # 7. LLM extraction on REDACTED text only (provider per LLM_PROVIDER).
        envelope = extract(
            api_key=settings.llm_api_key or "",
            redacted_text=red.redacted_text,
            org_type=req.org_type,
            capture_date=req.capture_date,
            provider=settings.llm_provider,
        )

        # 7.5 Decorative cover (text-to-image) from the SUGGESTED content_type —
        # no PII, no people. FAIL-OPEN: None when unconfigured or on any error.
        cover_image = generate_cover(
            api_url=settings.image_api_url,
            api_key=settings.image_api_key,
            content_type=envelope.content_type_suggested,
        )

        # 8. Callback: write the draft (with the cover if we got one).
        _callback_draft(req, settings, ocr, red, redacted_image, envelope, cover_image)
        log.info("job %s -> draft (%s)", req.post_id, envelope.content_type_suggested)

    except EmptyExtractionInputError:
        # Defense in depth: extract() also guards empty input. If we somehow reach
        # the LLM with empty text, still produce an empty draft rather than failing.
        log.info("job %s -> empty draft (empty extraction input)", req.post_id)
        _callback_failed(req, settings, "no_readable_text")
    except httpx.HTTPStatusError as e:
        # An LLM/provider HTTP error. Log the status (the body is already logged in
        # extraction._raise_for_status_logged) so the reason is diagnosable from the
        # logs, and record a status-tagged reason on the post.
        status = e.response.status_code if e.response is not None else "?"
        log.warning("job %s failed: HTTP %s from provider", req.post_id, status)
        _callback_failed(req, settings, f"provider_http_{status}")
    except Exception as e:
        log.warning(
            "job %s failed: %s: %s", req.post_id, type(e).__name__, str(e)[:200]
        )
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
        resp = client.post(
            _callback_url(settings, "/api/worker/callback"),
            headers={"X-Worker-Secret": settings.worker_shared_secret},
            data=data,
            files=files,
        )
        _check_callback(f"draft {req.post_id}", resp)


def _callback_failed(req, settings, reason: str) -> None:  # type: ignore[no-untyped-def]
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            _callback_url(settings, "/api/worker/callback"),
            headers={"X-Worker-Secret": settings.worker_shared_secret},
            data={"post_id": req.post_id, "failed": "1", "reason": reason},
        )
        _check_callback(f"failed {req.post_id}", resp)


def translate_job(req: TranslateRequest, settings: Settings) -> None:
    """Translate one published post's member-visible content into each requested
    locale and call back. BEST-EFFORT: a locale that fails to translate is simply
    omitted (read sites fall back to German). Never raises out of the worker thread.

    The content received here is already redacted + member-safe (the app sends the
    final published title/body/payload), so no PII handling happens here.
    """
    translations: dict[str, dict[str, object]] = {}
    event_titles: dict[str, dict[str, str]] = {}

    for locale in req.locales:
        if locale == "de":
            continue  # German is the source; never translate into it.
        # One bundle per locale: post strings + event titles in a single call.
        bundle: dict[str, object] = {"title": req.title, "body": req.body}
        if req.payload is not None:
            bundle["payload"] = req.payload
        if req.events:
            bundle["events"] = {e.id: e.title for e in req.events}
        try:
            out = translate_bundle(
                api_key=settings.llm_api_key or "",
                bundle=bundle,
                target_locale=locale,
                provider=settings.llm_provider,
            )
        except Exception as e:  # best-effort: skip this locale on any failure
            log.warning(
                "translate %s [%s] failed: %s", req.post_id, locale, type(e).__name__
            )
            continue

        # Coerce ONLY real strings. A misbehaving model might return a list/dict
        # for title/body; str() on that yields a Python repr (e.g. "['a','b']")
        # that would render literally instead of falling back to German. Keep
        # non-strings as "" so the read side treats the field as absent.
        node: dict[str, object] = {
            "title": _as_str(out.get("title")),
            "body": _as_str(out.get("body")),
        }
        payload_out = out.get("payload")
        if isinstance(payload_out, dict):
            node["payload"] = payload_out
        translations[locale] = node

        events_out = out.get("events")
        if isinstance(events_out, dict):
            titles = {str(k): _as_str(v) for k, v in events_out.items() if _as_str(v)}
            if titles:
                event_titles[locale] = titles

    if not translations and not event_titles:
        log.info("translate %s -> nothing produced", req.post_id)
        return

    _callback_translations(req, settings, translations, event_titles)
    log.info("translate %s -> %s", req.post_id, ",".join(sorted(translations)))


def _callback_translations(  # type: ignore[no-untyped-def]
    req, settings, translations, event_titles
) -> None:
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            _callback_url(settings, "/api/worker/translation-callback"),
            headers={"X-Worker-Secret": settings.worker_shared_secret},
            data={
                "post_id": req.post_id,
                "translations": _dumps(translations),
                "event_titles": _dumps(event_titles),
            },
        )
        _check_callback(f"translation {req.post_id}", resp)


def _dumps(obj: object) -> str:
    import json

    return json.dumps(obj, ensure_ascii=False)


def _as_str(v: object) -> str:
    """Return v only if it's actually a string, else "". Prevents a misbehaving
    LLM's list/dict from being str()'d into a Python repr that would render
    literally instead of falling back to the German source."""
    return v if isinstance(v, str) else ""


def _check_callback(label: str, resp: httpx.Response) -> None:
    """Log a non-2xx app-callback response. httpx doesn't raise on 4xx/5xx by
    default, so without this a rejected write (e.g. the app RPC 500'ing) is dropped
    silently — the worker thinks it succeeded. We log rather than raise to keep the
    never-throw-out-of-the-worker-thread contract."""
    if resp.status_code >= 400:
        log.warning(
            "callback %s -> HTTP %s: %s", label, resp.status_code, resp.text[:200]
        )
