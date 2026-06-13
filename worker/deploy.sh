#!/usr/bin/env bash
# One-shot worker deploy for a fresh Ubuntu VPS. Run AS ROOT on the box:
#
#   curl -fsSL https://raw.githubusercontent.com/eugnmueller-87/DIGITNEWS/main/worker/deploy.sh | \
#     WORKER_SHARED_SECRET="..." MISTRAL_API_KEY="..." APP_CALLBACK_URL="https://kita-connect.cloud" bash
#
# Or clone the repo and run: WORKER_SHARED_SECRET=... MISTRAL_API_KEY=... bash worker/deploy.sh
#
# Installs Docker, builds the worker image, and (re)starts the container.
# Idempotent: re-run it to update (it pulls latest + rebuilds + replaces).
set -euo pipefail

: "${WORKER_SHARED_SECRET:?set WORKER_SHARED_SECRET}"
: "${MISTRAL_API_KEY:?set MISTRAL_API_KEY}"
APP_CALLBACK_URL="${APP_CALLBACK_URL:-https://kita-connect.cloud}"
REPO="${REPO:-https://github.com/eugnmueller-87/DIGITNEWS.git}"

echo "==> Installing Docker + git (if missing)"
command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sh
command -v git >/dev/null 2>&1 || { apt-get update && apt-get install -y git; }

echo "==> Fetching the worker source"
if [ -d /opt/aushang/.git ]; then
  git -C /opt/aushang pull --ff-only
else
  rm -rf /opt/aushang
  git clone --depth 1 "$REPO" /opt/aushang
fi

echo "==> Building the image (Tesseract + German + spaCy; takes a few minutes)"
docker build -t aushang-worker /opt/aushang/worker

echo "==> (Re)starting the container"
docker rm -f aushang-worker 2>/dev/null || true
docker run -d --name aushang-worker --restart unless-stopped \
  -p 8000:8000 \
  -e WORKER_SHARED_SECRET="$WORKER_SHARED_SECRET" \
  -e APP_CALLBACK_URL="$APP_CALLBACK_URL" \
  -e MISTRAL_API_KEY="$MISTRAL_API_KEY" \
  aushang-worker

echo "==> Waiting for health"
for i in $(seq 1 30); do
  if curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
    echo "✓ worker is up: $(curl -fsS http://localhost:8000/health)"
    exit 0
  fi
  sleep 2
done
echo "!! worker did not become healthy — check: docker logs aushang-worker"
exit 1
