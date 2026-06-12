# Aushang Worker (Phase 2)

Python FastAPI service that does the heavy, privacy-critical processing **off the
client**: OCR, **local PII redaction**, image blur, and the EU LLM extraction
call (on redacted text only). It runs on a VPS (Docker), separate from the
Next.js app.

> **Status: skeleton.** Only the API shell + shared-secret auth + the job
> contract exist so the quality gates (Ruff, mypy, pytest) have a real target.
> The pipeline itself (OpenCV → OCR → Presidio/spaCy/regex redaction → blur →
> Mistral → schema-validate → callback) is built in Phase 2.

## Pipeline (Phase 2 target)

```
photo (private bucket, short-TTL signed URL)
  → OpenCV deskew/perspective/contrast
  → OCR (Tesseract deu / PaddleOCR) → text + word boxes
  → PII detection LOCAL (Presidio + spaCy de_core_news_lg + regex), FAIL-CLOSED
  → gaussian blur of redacted regions → redacted_image
  → EU LLM (Mistral) on REDACTED TEXT ONLY → structured JSON
  → validate vs the shared extraction schema (invalid → manual path)
  → callback to the Next.js app (service role) with draft + events
```

The LLM never sees raw PII; placeholders like `[NAME_1]` are preserved verbatim.
All logs are PII-free (IDs only).

## Dev

```bash
cd worker
python -m venv .venv && . .venv/bin/activate    # or your env manager
pip install -e ".[dev]"

ruff check .          # lint
ruff format --check . # format check
mypy                  # types
pytest                # tests

uvicorn aushang_worker.app:app --reload   # run locally (needs WORKER_SHARED_SECRET)
```

## Auth

`POST /process` requires an `X-Worker-Secret` header matching
`WORKER_SHARED_SECRET` (constant-time compare). The Next.js app sends it. The
worker fails closed if the secret is unset.
