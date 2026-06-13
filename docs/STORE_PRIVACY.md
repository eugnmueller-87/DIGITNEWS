# Store privacy disclosure — source of truth for Apple & Google forms

This document is the single source for the **Apple App Privacy ("Nutrition
Label")** and **Google Play Data Safety** forms. It maps exactly what Aushang
collects/processes, where it goes, and why — leaning on the architecture:
**only already-published board content, raw photos never leave our infra, PII
redacted locally before any external call, fail-closed.**

> Status: PWA-first. There is **no native wrapper yet**, so there are no native
> SDKs and no device-identifier/ad collection of any kind. When a Capacitor
> shell is added, revisit only the "Permissions" and "Identifiers" rows.

## 1. Architecture facts the forms depend on

- **Auth:** email + password, invite-only. No public signup — accounts are
  operator/admin **provisioned**; the first password is set via a one-time
  emailed code. We store the user's **email** (in Supabase Auth, password hashed
  by Supabase) and a **profile** (org, role, display name, digest opt-in).
- **Content source:** the org's own physical notice board. An admin photographs
  it. We process **only what the org already published** publicly on that board.
- **Raw photo path:** the browser compresses the photo and uploads it to a
  **private** Supabase Storage bucket (`raw-photos`). The raw image is sent
  **only** to our own VPS worker via a short-TTL signed URL. **It never goes to
  any third-party LLM or service.**
- **Local redaction (fail-closed):** the worker runs OCR (Tesseract) then
  **Presidio + spaCy + regex** PII detection, **blurs** the redacted image
  regions, and only the **redacted text** is sent onward. If redaction fails,
  the job fails — nothing is published.
- **LLM:** the **Claude API (Anthropic)** receives the **redacted text only**
  (never the raw image, never raw PII). It _advises_ a structure; deterministic
  code + an admin confirm before anything is published. ⚠️ **Data residency:**
  Anthropic's API is **US-hosted** (no EU endpoint at time of writing) — so
  unlike the rest of the stack, this one external call leaves the EU. It carries
  only locally-redacted text (PII already masked to `[NAME_1]`-style
  placeholders), never raw images or raw PII. If strict EU residency is required,
  swap the worker's extraction module back to an EU LLM — no other change.
- **RLS + column REVOKE:** every table is org-scoped by Row Level Security. The
  PII columns (`ocr_text_raw`, `ocr_text_redacted`, `redactions`,
  `source_image_path`) are **column-level REVOKE'd** from `authenticated`, so no
  browser/anon client — not even an admin's — can read them; admin PII access is
  server-only.

## 2. Sub-processors / external calls (the only places data leaves our app)

| Service                    | Region  | What it receives                                                                      | Why                                             |
| -------------------------- | ------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Supabase**               | EU      | Email, profile, org data, posts, events, raw+redacted images (private buckets)        | DB, auth, storage                               |
| **Anthropic (Claude API)** | **US**  | **Redacted OCR text only** — no images, no raw PII                                    | Structure extraction (advisory)                 |
| **Resend**                 | (email) | Recipient email + message body (app-owned emails: QR verification now, digests later) | Transactional email                             |
| Worker (our VPS)           | EU      | Short-TTL signed URL to the raw image                                                 | OCR + local redaction (ours, not a third party) |

> The **Anthropic key lives on the worker, never in the web app** — the app
> never sees raw PII or calls the LLM directly. Anthropic is the one US-based
> sub-processor; it receives redacted text only (see §1).

## 3. Apple App Privacy ("Nutrition Label")

For each type: _Linked to identity? Used for tracking? Purpose?_ We do **no
tracking** and **no third-party advertising/analytics** (`poweredByHeader` off,
no analytics SDKs — see `next.config.ts`).

| Data type                            | Collected? | Linked to user | Tracking | Purpose                                   |
| ------------------------------------ | ---------- | -------------- | -------- | ----------------------------------------- |
| **Email address**                    | Yes        | Yes            | No       | App functionality (login)                 |
| **Name** (display)                   | Yes (opt)  | Yes            | No       | App functionality                         |
| **Photos** (board)                   | Yes        | Yes (to org)   | No       | App functionality (the core feature)      |
| **User content** (post text, events) | Yes        | Yes (to org)   | No       | App functionality                         |
| Coarse/precise location              | **No**     | —              | —        | — (Permissions-Policy denies geolocation) |
| Identifiers (device, ad)             | **No**     | —              | —        | —                                         |
| Usage data / analytics               | **No**     | —              | —        | —                                         |
| Diagnostics                          | **No**     | —              | —        | —                                         |

- **Data used to track you:** None.
- **Data linked to you:** Email, Name, Photos, User Content.
- **Data not linked to you:** None.
- **Account deletion:** in-app (see §6) — required by Apple Guideline 5.1.1(v).

## 4. Google Play Data Safety

| Question                                                       | Answer                                                                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Does the app collect/share user data?                          | Collects: yes. Shares with third parties: **no** (sub-processors in §2 are processors acting on our behalf, not independent recipients). |
| Data encrypted in transit?                                     | Yes (HTTPS/TLS everywhere; HSTS header).                                                                                                 |
| Can users request data deletion?                               | Yes — in-app account deletion (§6) and `/datenschutz` contact.                                                                           |
| Data types: **Personal info** (email, name)                    | Collected, for app functionality, processed by Supabase (EU).                                                                            |
| Data types: **Photos**                                         | Collected, for app functionality; raw image stays in our infra; redacted before any LLM call.                                            |
| Data types: **App activity / location / contacts / financial** | **Not collected.**                                                                                                                       |

## 5. Permission usage strings (German — ready for native config)

These are needed only once a native wrapper exists; drafted now so they drop in.

- **`NSCameraUsageDescription`**
  `„Aushang nutzt die Kamera, damit du einen Aushang von der Pinnwand
abfotografieren kannst. Das Foto bleibt auf unserer Infrastruktur; persönliche
Daten werden vor jeder Weiterverarbeitung lokal unkenntlich gemacht."`
- **`NSPhotoLibraryUsageDescription`** (gallery upload)
  `„Aushang greift auf deine Fotos zu, damit du ein bereits aufgenommenes Bild
eines Aushangs auswählen kannst."`
- **Notifications (push)** — iOS shows its own system prompt; no Info.plist
  string required. Android 13+ uses the runtime `POST_NOTIFICATIONS` permission.
- **No** microphone, location, contacts, calendar-write, or photo-library-**add**
  permissions are used.

## 6. In-app account deletion (Apple 5.1.1(v) / Play)

**Status: implemented and reachable for every role.**

- Entry point: **account menu → Einstellungen → „Konto löschen"**
  (`src/app/(app)/einstellungen/delete-account-panel.tsx`), two-step confirm.
- Server flow: `deleteOwnAccount` →
  `delete_own_account` security-definer RPC (`src/app/(app)/einstellungen/actions.ts`).
  Honors RLS/audit-purge; **refuses** if the user is the last admin of an org
  (so an org is never orphaned); operator/superadmin accounts cannot self-delete
  here (break-glass is operator-side).
- On success: session is signed out and the user is routed to `/login`.

## 7. Public legal URLs (for the store listings)

- **Privacy policy:** `${siteUrl}${LEGAL_PATHS.privacy}` → `/datenschutz`
  (publicly reachable without auth; allowlisted in `src/lib/routes.ts`). The
  path constant is `LEGAL_PATHS.privacy`.
- **AVV/DPA:** the data-processing agreement PDF for org customers will live
  alongside `/datenschutz` (a later deliverable); link it from the listing's
  support URL once published.
- **Support contact:** `brand.supportEmail` (`hallo@aushang.app`).
