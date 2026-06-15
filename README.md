# Aushang

[![CI](https://github.com/eugnmueller-87/DIGITNEWS/actions/workflows/ci.yml/badge.svg)](https://github.com/eugnmueller-87/DIGITNEWS/actions/workflows/ci.yml)
[![Android build](https://github.com/eugnmueller-87/DIGITNEWS/actions/workflows/android.yml/badge.svg)](https://github.com/eugnmueller-87/DIGITNEWS/actions/workflows/android.yml)

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-EU-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/explore/progressive-web-apps)
[![i18n](https://img.shields.io/badge/i18n-DE%20%C2%B7%20EN-informational)](#)
[![Deploy: Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)
[![Privacy by construction](https://img.shields.io/badge/Privacy-by%20construction-2EA043)](SECURITY.md)

> Digitalisierung ohne Prozessänderung.

A digitization layer for old-school organizations (Kitas, Vereine,
Kirchengemeinden, Kleingartenkolonien, small businesses) that does **not** change
their processes. The org keeps pinning paper notices to its physical board; one
admin photographs the board from inside the tool; the system OCRs and redacts the
photo locally, extracts structured content and dates via an LLM (on the
**redacted text only** — see the LLM note below), the admin reviews and confirms,
and members get a private feed, browsable category libraries, a shared calendar,
an ICS subscription, and an email digest. Available as a PWA and, now, a native
**Android** app (Capacitor).

> **Status: live & in real-world testing.** Phases 1–5 are built and the full
> pipeline runs end-to-end in production — schema + RLS, auth, the capture → OCR →
> redaction → LLM → review → publish pipeline, content-type routing + per-category
> libraries, calendar/ICS, email, web push, PWA, and GDPR/deletion flows. The web
> app runs on Vercel at **[kita-connect.cloud](https://kita-connect.cloud)**; the
> OCR/redaction worker (`worker/`) runs on a VPS. A first Kita is testing it, and
> the app has since gained a clean mobile redesign ("Tafel"), post take-down,
> duplicate prevention, opt-in clear-photo consent, "new since last visit"
> category counts, a native **Android** shell (Capacitor), reflection-original
> deletion at publish, and (post-launch) AI cover illustrations (see
> **Post-launch** below). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
> [`docs/GO_LIVE_CHECKLIST.md`](docs/GO_LIVE_CHECKLIST.md),
> [`docs/CAPACITOR.md`](docs/CAPACITOR.md), and
> [`docs/PLAY_LAUNCH.md`](docs/PLAY_LAUNCH.md).

The working title is **Aushang**; final naming is TBD. All branding lives in one
file — [`src/config/brand.ts`](src/config/brand.ts) — so a rename is a one-file
change.

---

## Tech stack

| Layer               | Choice                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend            | Next.js 16 (App Router), React 19, TypeScript, PWA                                                                                     |
| DB / Auth / Storage | Supabase (EU region), RLS on every table                                                                                               |
| Auth method         | Supabase Auth, **email + password** — invite-only (no public signup; accounts are provisioned, first password set via a one-time link) |
| Styling             | Tailwind CSS v4                                                                                                                        |

Plus a Python FastAPI OCR/redaction worker (Tesseract + Microsoft Presidio +
spaCy), **Claude (Anthropic) LLM extraction on the redacted text only**, Resend
email, and Web Push — see `worker/`.

> **LLM note:** extraction uses the **Claude API** (`claude-haiku-4-5`), which is
> **US-hosted**. The "privacy by construction" guarantee is preserved by the
> redaction step _upstream_ of the call: only locally-redacted text (PII already
> masked to `[NAME_1]`-style placeholders) is ever sent — never raw images, never
> raw PII. The Anthropic key lives **only on the worker**. If strict EU residency
> is ever required, swap the worker's `extraction` module back to an EU LLM;
> nothing else in the pipeline changes. (Earlier docs referenced Mistral (EU);
> the worker now uses Claude.)

---

## Non-negotiable principles

1. **LLM advises, deterministic code decides.** Nothing publishes without explicit
   admin confirmation; all LLM output is schema-validated.
2. **Privacy by construction.** Raw photos never leave our infrastructure; PII is
   detected and masked **locally before any external API call**; fail-closed.
3. **Only published information.** The tool processes only what the org already
   posted to its own board.
4. **Three roles.** `superadmin` (operator — you, cross-org), `admin` (manages
   their own org's members), `member` (read-only). _Note: this supersedes the
   brief's original "two roles" — the project moved to an operator-provisioned
   model where you create orgs and admins manage their own people._
5. **Deny by default.** No public surface except `/login`, `/auth/*`,
   `/api/ics/*`, and `/datenschutz`. Everything else requires auth. No public
   signup or self-service join.

---

## Getting started

### 1. Prerequisites

- Node.js 20+ (developed on 24), npm 11+
- A **new** Supabase project in an **EU region** (Ireland or Frankfurt). Do not
  reuse any prior project.

### 2. Provision Supabase

1. Create a new Supabase project (EU region).
2. In **Authentication → Providers → Email**: enable the Email provider with
   **password sign-in ON**. In **Authentication → Settings**: set **"Allow new
   users to sign up" = OFF** (matches `supabase/config.toml: enable_signup =
false`) — accounts are invite-only.
3. In **Authentication → URL Configuration**: set the Site URL and add
   `http://localhost:3000/auth/callback` (and your prod equivalent) to the
   **Redirect Allow List** — exact matches only.
4. **Invite / password-reset links.** The app sends a one-time "set your
   password" link itself via Resend (so onboarding doesn't depend on Supabase
   SMTP). It is verified by the callback with `verifyOtp({ token_hash, type })`
   and the redirect target is set in code (`generateLink` `options.redirectTo` →
   `/auth/callback?type=recovery`). If you instead let Supabase send recovery
   mail directly, set its template link to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`
   (not the default `{{ .ConfirmationURL }}`). See `supabase/config.toml`.

5. Apply **all** migrations in `supabase/migrations/` in numeric order (SQL editor
   or `supabase db push`) — currently `0001` … `0023`. Highlights:
   - `0001`–`0004` — schema, helper functions, RLS, column-grant hardening
   - `0005`–`0007` — operator-provisioned three-role model + superadmin RLS
   - `0008` — content classification (`content_type` routing)
   - `0009` — QR self-apply public surface
   - `0010` — capture pipeline (buckets, worker-callback definer flows)
   - `0011`–`0014` — ICS tokens, account deletion, push subscriptions, retention purges
   - `0015` — groups + admin role management
   - `0016`–`0019` — duplicate prevention, publish-creates-events, post take-down, re-publish restores events
   - `0020` — opt-in clear-photo consent (double-gated)
   - `0021` — per-member "new since last visit" category counts
   - `0022` — per-user UI language (de/en)
   - `0023` — reflection originals deleted at publish + `cover_image_path` (AI cover)
6. Set `RESEND_API_KEY` + `EMAIL_FROM` (on a Resend-verified domain) so invite /
   password-reset emails are delivered. (Optionally also point Supabase's own
   SMTP at Resend for any mail Supabase sends directly.)

> The `gen_random_uuid` / `gen_random_bytes` functions require the `pgcrypto`
> extension, which Supabase enables by default in the `extensions` schema. Verify
> with `select * from pg_extension;`.

### 3. Configure environment

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL.
```

`.env.local` is gitignored. **Never commit secrets.** Only `NEXT_PUBLIC_*`
variables reach the browser; `SUPABASE_SERVICE_ROLE_KEY` is server-only and
bypasses RLS — treat it as a root credential.

### Email (Resend)

All app-owned email — the one-time **set-password / invite** links, password
resets, QR verification, and digests — is sent directly via the **Resend SDK**
using `RESEND_API_KEY` + `EMAIL_FROM`. (Supabase's own SMTP is only relevant if
you let Supabase send any auth mail directly; the app does not rely on it.)

**Setup:**

1. Create a [Resend](https://resend.com) account.
2. **Verify a sending domain** (Resend → Domains → add your domain, then add the
   shown DKIM/SPF/DMARC DNS records). To start without a domain you can use
   Resend's test sender `onboarding@resend.dev`, but it only delivers to your own
   account email.
3. Put the API key in `RESEND_API_KEY` and set `EMAIL_FROM` to an address on the
   verified domain, e.g. `Aushang <hallo@kita-connect.cloud>`.

> If `RESEND_API_KEY` is unset, app emails **no-op** (a warning is logged) — the
> app still runs, but invite / reset links won't be delivered, so nobody new can
> set a password. This is the #1 thing to get right for onboarding.

### 4. Run

```bash
npm install
npm run dev      # http://localhost:3000
```

### 5. Verify (run before every push)

```bash
npm run verify   # typecheck + lint + format + build + client- & source-secret scans
```

`npm run check:secrets` greps the built client bundle and **fails** if a server
secret ever leaks into it (Brief §11); `check:source-secrets` does the same for
tracked source and also runs in the pre-commit hook.

---

## Roles & onboarding (operator-provisioned)

There is **no public signup and no self-service join**. Accounts are provisioned:

- **Superadmin (operator — you)** logs in (bootstrapped from `SUPERADMIN_EMAILS`)
  and uses **`/operator`** to create orgs and add each org's first **admin**.
  Can also grant/revoke admin rights across orgs.
- **Admin** uses **`/admin/mitglieder`** to add/remove **members** in their own
  org (enter an email → that person's account is created and a one-time "set your
  password" email is sent; they show as _invited_ until first login). Admins
  cannot add other admins or touch other orgs.
- **Member** has read-only access (feed, calendar).
- **Everyone** logs in at **`/login`** with email + password (first password set
  via the invite link, resettable at `/passwort-vergessen`).

### Bootstrapping the first superadmin

There is no one above the operator, so the first superadmin is **bootstrapped
from an env allowlist**: put your email in `SUPERADMIN_EMAILS`. On your first
login, the callback auto-creates an "Operator" anchor org and elevates you to
`superadmin`.

**SQL fallback (break-glass)** — if you'd rather not use the env, after logging
in once (you'll be bounced to `/login?error=notprovisioned`), run in Supabase:

```sql
-- Replace with your auth user id (Authentication → Users):
select public.ensure_superadmin('<your-auth-user-uuid>', 'you@example.com');
```

All account creation and role changes flow through server-side security-definer
RPCs (`create_org`, `add_person`, `remove_person`, `set_admin`,
`ensure_superadmin`); the public signup endpoint is off.

---

## Security model

Defense in depth, four layers:

1. **Middleware (`src/proxy.ts`)** — deny-by-default coarse gate. Validates the
   session via `getUser()` (JWT checked against the auth server), redirects
   non-allowlisted unauthenticated requests to `/login`.
2. **Server auth helpers (`src/lib/auth.ts`)** — `requireSession()` /
   `requireAdmin()` re-check session + DB-backed role at every protected route.
3. **Security-definer RPCs** — the only writers of `profiles.role` (`create_org`,
   `add_person`, `remove_person`, `set_admin`, `ensure_superadmin`); pinned
   `search_path`, input-validated, `service_role`-only, with the actor's
   authorization re-checked inside each function.
4. **Row Level Security + column grants** — the final backstop. Every table is
   org-scoped; members read only published/confirmed rows. Because RLS gates
   rows but **not columns**, PII columns (`ocr_text_raw`, `ocr_text_redacted`,
   `redactions`, `source_image_path`) are **column-level REVOKE**d from
   `authenticated` (migration `0004`), so a member cannot read them even by
   querying the base `posts` table directly. Admin PII access is server-only
   (service role). **One deliberate exception** (migration `0020`): a member may
   see the unblurred **original** photo of a post — but only when they opted in
   (`profiles.photo_consent`) **and** an admin released that specific post
   (`posts.clear_photo_allowed`), both default-off. The decision is made
   server-side and the original is delivered only via a short-TTL **signed URL**;
   the `source_image_path` column stays REVOKE'd and the client can never set
   `clear_photo_allowed`. See [`SECURITY.md`](SECURITY.md).

**No onboarding intent in URLs.** Login is email + password; the only links
emailed are one-time invite/recovery links that merely _establish a session_ to
set a password — they carry no org/role parameters. Account + role assignment
happen entirely server-side when an operator/admin provisions someone, so there
is nothing escalatable to tamper with in the link.

This skeleton was put through multi-agent **adversarial security reviews** (the
initial build and the operator-model refactor); findings and fixes are recorded
in [`SECURITY.md`](SECURITY.md).

**Phase 1 acceptance test:** two users in two different orgs cannot see each
other's anything. Seed with `supabase/fixtures/two_orgs.sql` and confirm
cross-org reads return zero rows.

### Known advisory

`npm audit` reports a moderate advisory for a **transitive** `postcss` pinned
inside Next.js's own dependency tree. The suggested "fix" downgrades Next.js to
9.x (a severe regression) and is **not** applied. The vector (CSS-stringify XSS)
does not apply to our build-time usage; it resolves when Next.js bumps its
internal postcss. Do not run `npm audit fix --force`.

---

## Repository layout

```
src/
  app/
    (app)/                 # authenticated shell (requireSession)
      aufnahme/            # admin capture (photograph → upload → trigger worker)
      review/              # admin review gate — confirm content_type, edit, publish/take-down
      feed/                # the Pinnwand: every published post (a row inside Bereiche)
      bereiche/            # category hub + libraries + "new" counts; CategoryFeed
      essensplan/ rueckblick/ kalender/ info/ gesundheit/   # per-category libraries
      einstellungen/       # member settings: ICS sub, digest, push, photo-consent, delete
      mehr/                # phone overflow hub
      admin/mitglieder/    # admin (requireAdmin) — members, groups, invites, consent overview
      operator/            # superadmin (requireSuperadmin) — create orgs, manage admins
    api/worker/callback/   # worker → app callback (shared-secret)
    api/ics/[token]/       # per-user ICS calendar feed
    apply/                 # QR self-apply public surface (verified by admin)
    auth/callback/         # invite/recovery link landing + superadmin bootstrap
    login/ set-password/ passwort-vergessen/   # email+password auth entry points
    datenschutz/           # public legal page
  components/              # UI primitives ("Tafel" design system, category chips, nav)
  config/brand.ts          # SINGLE source of branding
  lib/
    supabase/              # client / server / admin / middleware clients
    content/               # content_type routing, extraction schema, placeholder mask
    photo.ts               # the single raw-vs-redacted signed-URL decision (consent)
    feed.ts ics.ts push.ts auth.ts auth-flows.ts   # domain helpers
    routes.ts              # public/admin route allowlist
    env.ts env.server.ts   # public vs server-only env (secret boundary)
  proxy.ts                 # deny-by-default middleware
supabase/
  migrations/              # 0001 … 0023 (see "Provision Supabase" above)
  fixtures/two_orgs.sql    # isolation test fixture
  config.toml              # security-critical auth settings (version-controlled)
worker/                    # FastAPI OCR + Presidio redaction + Claude extraction (VPS, Docker)
scripts/
  check-no-client-secrets.mjs   # CI guard: no secrets in client bundle
  check-no-source-secrets.mjs   # CI + pre-commit guard: no secrets in tracked source
```

---

## Capture pipeline (Phase 2)

An admin photographs a notice on `/aufnahme`; the browser compresses it
(HEIC→JPEG, ≤600 KB, max 1600px) and uploads the **raw** image to the private
`raw-photos` bucket via a signed URL. The app creates a `processing` post and
triggers the **worker** (`worker/`) with a short-TTL signed URL. The worker:
OpenCV deskew → Tesseract OCR (German) → **local PII redaction** (Presidio +
spaCy + regex, fail-closed) → blur redacted regions → **Claude** (Anthropic)
extraction on the **redacted text only** → schema-validate → callback. The
callback (`/api/worker/callback`, shared-secret-guarded) uploads the redacted
image and writes the draft. The admin reviews on `/review`: confirm the content
type (pre-filled to the LLM suggestion, **tap to correct it**), edit title/body,
optionally release the original photo, and **publish** — the only path to member
visibility. Publishing routes the post by its confirmed `content_type` (meal plan
→ Essensplan, event → calendar + ICS, reflection → Rückblick, health → top-of-feed
alert, info → general feed) and every published post also appears on the Pinnwand.

The redaction is deliberately conservative but tuned not to mangle ordinary
notices: deterministic PII (phone, email, IBAN, birthdate-near-"geb.") is caught
by a regex pack at confidence 1.0, while the spaCy model's fuzzier guesses are
held to higher per-entity thresholds and **`LOCATION` is excluded entirely** (on a
public board the "locations" are the org's own name and town — not PII).

### Deploying the worker

The worker needs a VPS (the ML stack is heavy). It ships with a Dockerfile that
bakes in Tesseract + the German spaCy model:

```bash
cd worker
docker build -t aushang-worker .
docker run -d --name aushang-worker --restart unless-stopped -p 8000:8000 \
  -e WORKER_SHARED_SECRET="<same as the app>" \
  -e APP_CALLBACK_URL="https://kita-connect.cloud" \
  -e ANTHROPIC_API_KEY="<your anthropic key>" \
  aushang-worker
```

Then set `WORKER_URL` + `WORKER_SHARED_SECRET` in the app's env. The **Anthropic
key lives on the worker**, never in the web app — the app never sees raw PII or
calls the LLM. Until the worker is deployed, captures upload and create a post
but stay `processing` (no worker to run). Full VPS steps:
[`worker/DEPLOY_HOSTINGER.md`](worker/DEPLOY_HOSTINGER.md). To ship a worker
change: pull on the VPS, `docker build`, then recreate the container.

---

## Roadmap

- **Phase 1 (done)** — walking skeleton: schema, RLS, auth, operator model.
- **Phase 2 (done)** — capture flow + FastAPI worker (OCR + Presidio redaction +
  image blur) + Claude extraction + schema validation.
- **Phase 3 (done)** — review gate UI, redaction handling, content-type confirmation,
  event creation, publish.
- **Phase 4 (done)** — calendar (month/list), ICS per-user tokens, email-on-publish,
  web push, PWA install.
- **Phase 5 (done)** — GDPR one-pager, AVV, Datenschutzerklärung, deletion flows,
  audit purges, hardening sweep.

### Post-launch (during real-world testing)

The app went live on [kita-connect.cloud](https://kita-connect.cloud) and a first
Kita began testing. Shipped since:

- **"Tafel" mobile redesign** — clean iOS-style, teal accent, 4-tab bottom nav +
  staff capture FAB; **Bereiche** (the category hub) is the home tab.
- **Content-type routing + category libraries** — each `content_type` has its own
  browsable library (Essensplan, Rückblick, Termine, Infos, Gesundheit); the
  Pinnwand carries everything. Per-type structured detail rendering, `[NAME_x]`
  placeholders masked in member views.
- **"New since last visit" counts** — per-member, per-category badges on the
  Bereiche hub (migration `0021`).
- **Post take-down + re-publish** — an admin can pull a published post; its
  calendar events are cancelled (and removed from subscribed ICS feeds) and
  restored on re-publish (`0018`/`0019`).
- **Duplicate prevention** — exact-photo block at capture + same-title block at
  publish (`0016`).
- **Opt-in clear-photo consent** — double-gated (member opt-in × admin per-post
  release) path to the original photo, server-minted signed URLs only (`0020`).
- **Onboarding/email fixes** — invite email links to the registration page; From
  address pinned to the verified domain; add-person create-or-find flow.
- **Redaction tuning** — exclude `LOCATION`, raise fuzzy ML thresholds, so notices
  full of dates/town names aren't over-masked.
- **Per-user language (de/en)** — members switch the app chrome between German and
  English (`0022`); notice content stays in its German source.
- **Reflection originals not retained** — a Rückblick (the type most likely to
  depict children) has its raw original **deleted at publish**; members keep the
  blurred image and the generated cover. `publish_post` force-blocks the
  clear-photo release for reflections so the consent path can't reach a deleted
  original (`0023`). _Per-viewer "see the real photo" was deliberately rejected
  for reflections — see [`docs/COVER_IMAGES_SPEC.md`](docs/COVER_IMAGES_SPEC.md)
  (the "multiple children" problem)._
- **Native Android app (Capacitor)** — a remote-URL native shell so the
  server-rendered app keeps its full security model; native camera capture
  (`@capacitor/camera`) feeding the same redaction pipeline; brand launcher icons;
  a cloud AAB build (`.github/workflows/android.yml`). iOS is added later from the
  same project. See [`docs/CAPACITOR.md`](docs/CAPACITOR.md) /
  [`docs/NATIVE_TODO.md`](docs/NATIVE_TODO.md).
- **AI cover illustrations (post-launch, built/dormant)** — text-to-image covers
  generated from the redacted extraction (FLUX.1 [schnell], EU-hosted), no PII, no
  people, admin-confirmed. Inert until the worker + an EU image endpoint are
  configured. See [`docs/COVER_IMAGES_SPEC.md`](docs/COVER_IMAGES_SPEC.md).

### Out of scope / follow-ups

- Worker behind HTTPS (currently reachable over the VPS; front with Caddy/Traefik
  - a `worker.` subdomain for TLS).
- Regenerate `src/lib/database.types.ts` from the live schema (currently a
  hand-authored stub).
- Native follow-ups (tracked in [`docs/NATIVE_TODO.md`](docs/NATIVE_TODO.md)):
  deep links / `assetlinks.json`, native push (APNs/FCM), and the iOS phase
  (needs a Mac). The Android shell + native camera are already done.
- Move the structure-extraction LLM into the EU (the redacted-text call currently
  goes to a US sub-processor — disclosed honestly on `/datenschutz`).
