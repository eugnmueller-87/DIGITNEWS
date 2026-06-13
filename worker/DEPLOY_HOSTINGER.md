# Deploy the Aushang worker on a Hostinger VPS

The worker code is complete and tested. This gets it running so the
photograph → OCR → redact → extract → draft pipeline works end to end.

## What you need first

- A **Hostinger VPS** (not shared hosting) with SSH access — KVM plan, Ubuntu.
- A **Mistral API key** — sign up at https://console.mistral.ai → API Keys →
  create one (EU-hosted; receives only redacted text).
- The **shared secret** (already generated — keep it secret, used in 2 places):
  `WORKER_SHARED_SECRET` = _(the value from the chat)_

## Target VPS

`root@187.127.87.206` — Ubuntu 24.04, KVM, 50 GB disk. Run everything below
over SSH on this box.

## 1. SSH into the VPS

```bash
ssh root@187.127.87.206
```

## 2. Install Docker (once)

```bash
curl -fsSL https://get.docker.com | sh
docker --version   # confirm it works
```

## 3. Get the worker code onto the VPS

The repo is public, so just clone it:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/eugnmueller-87/DIGITNEWS.git
cd DIGITNEWS/worker
```

## 4. Build the image (bakes in Tesseract + German + spaCy; ~5–10 min)

```bash
docker build -t aushang-worker .
```

## 5. Run it

Replace the two placeholder values. `APP_CALLBACK_URL` is your live app.

```bash
docker run -d --name aushang-worker --restart unless-stopped \
  -p 8000:8000 \
  -e WORKER_SHARED_SECRET="PASTE_THE_SHARED_SECRET" \
  -e APP_CALLBACK_URL="https://kita-connect.cloud" \
  -e MISTRAL_API_KEY="PASTE_YOUR_MISTRAL_KEY" \
  aushang-worker
```

Check it's up:

```bash
curl http://localhost:8000/health    # -> {"status":"ok"}
docker logs aushang-worker           # watch for errors
```

## 6. Expose it over HTTPS (the app calls it from the internet)

The app sends a job to `WORKER_URL`. That URL must be reachable + HTTPS. Two
options:

**Simple (HTTP, fastest to test):** open port 8000 and use `http://YOUR_VPS_IP:8000`.
Fine to verify the pipeline; not ideal long-term (unencrypted job payload —
but note the raw image is fetched by the worker via a signed URL, and only a
short-TTL signed URL travels in the request, no raw PII).

**Proper (HTTPS via a subdomain + Caddy — recommended):**

```bash
# Point a DNS A record:  worker.kita-connect.cloud  ->  YOUR_VPS_IP   (in Hostinger DNS)
apt-get install -y caddy
# /etc/caddy/Caddyfile:
#   worker.kita-connect.cloud {
#     reverse_proxy localhost:8000
#   }
systemctl restart caddy   # Caddy auto-provisions a Let's Encrypt cert
```

Then `WORKER_URL = https://worker.kita-connect.cloud`.

## 7. Wire the app to the worker (in Vercel)

Vercel → project → Settings → Environment Variables (Production), add:

- `WORKER_URL` = your worker URL (from step 6)
- `WORKER_SHARED_SECRET` = the SAME secret you put on the VPS

Then **redeploy** the Vercel app so it picks up the vars.

## 8. End-to-end test

1. Log in as admin → `/aufnahme` → photograph (or upload) a German notice.
2. The app uploads it, creates a `processing` post, and triggers the worker.
3. Within ~10–30s the worker OCRs → redacts → calls Mistral → posts back a draft.
4. Go to `/review` → the draft should appear, classified, redacted, ready to
   confirm + publish.

If the post stays `processing`: `docker logs aushang-worker` on the VPS, and
check the Vercel function logs for the `/process` trigger.

## Updating later

```bash
cd DIGITNEWS && git pull && cd worker
docker build -t aushang-worker .
docker rm -f aushang-worker
# re-run the `docker run` from step 5
```
