# Aushang worker — OCR + PII redaction + LLM extraction (Phase 2).
# Bakes in Tesseract (German) and the spaCy de_core_news_lg model so the image
# is self-contained. Run on a VPS; receives short-TTL signed image URLs.
FROM python:3.11-slim

# System deps: Tesseract + German language pack, and the OpenCV runtime libs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr \
      tesseract-ocr-deu \
      libgl1 \
      libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer caching). Copy only metadata, then install.
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir -e ".[ml]" \
    && python -m spacy download de_core_news_lg

# Drop privileges.
RUN useradd --create-home appuser
USER appuser

EXPOSE 8000

# Required env at runtime: WORKER_SHARED_SECRET, APP_CALLBACK_URL, MISTRAL_API_KEY
CMD ["uvicorn", "aushang_worker.app:app", "--host", "0.0.0.0", "--port", "8000"]
