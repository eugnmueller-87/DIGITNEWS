# Aushang

> Digitalisierung ohne Prozessänderung.

A digitization layer for old-school organizations (Kitas, Vereine,
Kirchengemeinden, Kleingartenkolonien, small businesses) that does **not** change
their processes. The org keeps pinning paper notices to its physical board; one
admin photographs the board from inside the tool; the system OCRs and redacts the
photo locally, extracts structured content and dates via an EU-hosted LLM, the
admin reviews and confirms, and members get a private feed, a shared calendar, an
ICS subscription, and an email digest.

> **Status: deployed.** Phases 1–5 are built — schema + RLS, auth, the capture →
> OCR → redaction → LLM → review → publish pipeline, calendar/ICS, email, web
> push, PWA, and GDPR/deletion flows. The web app runs on Vercel at
> **[kita-connect.cloud](https://kita-connect.cloud)**; the OCR/redaction worker
> (`worker/`) deploys separately on a VPS. See
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
> [`docs/GO_LIVE_CHECKLIST.md`](docs/GO_LIVE_CHECKLIST.md).

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
spaCy), Mistral (EU) LLM extraction, Resend email, and Web Push — see `worker/`.

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

5. Apply the migrations in order (SQL editor or `supabase db push`):
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_functions.sql`
   - `supabase/migrations/0003_rls.sql`
   - `supabase/migrations/0004_security_hardening.sql`
   - `supabase/migrations/0005_operator_model.sql` (three-role model)
   - `supabase/migrations/0006_rls_three_roles.sql` (superadmin RLS)
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

## Security model (Phase 1)

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
   (service role).

**No onboarding intent in URLs.** Magic links only log a (pre-provisioned) user
in; they carry no org/role parameters. Account + role assignment happen entirely
server-side when an operator/admin provisions someone, so there is nothing
escalatable to tamper with in the link.

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
      admin/mitglieder/    # admin (requireAdmin) — add/remove members
      operator/            # superadmin (requireSuperadmin) — create orgs, manage admins
      feed/                # member feed (empty in Phase 1)
    auth/callback/         # magic-link landing + superadmin bootstrap + activate
    login/                 # the only auth entry point
    datenschutz/           # the one public legal page
  components/              # UI primitives
  config/brand.ts          # SINGLE source of branding
  lib/
    supabase/              # client / server / admin / middleware clients
    auth.ts auth-flows.ts  # session + onboarding helpers
    routes.ts              # public/admin route allowlist
    env.ts env.server.ts   # public vs server-only env (secret boundary)
  proxy.ts                 # deny-by-default middleware
supabase/
  migrations/              # 0001 schema · 0002 fns · 0003 RLS · 0004 hardening
                          # · 0005 operator model · 0006 superadmin RLS
  fixtures/two_orgs.sql    # isolation test fixture
  config.toml              # security-critical auth settings (version-controlled)
scripts/
  check-no-client-secrets.mjs   # CI guard: no secrets in client bundle
```

---

## Capture pipeline (Phase 2)

An admin photographs a notice on `/aufnahme`; the browser compresses it
(HEIC→JPEG, ≤600 KB, max 1600px) and uploads the **raw** image to the private
`raw-photos` bucket via a signed URL. The app creates a `processing` post and
triggers the **worker** (`worker/`) with a short-TTL signed URL. The worker:
OpenCV deskew → Tesseract OCR (German) → **local PII redaction** (Presidio +
spaCy + regex, fail-closed) → blur redacted regions → **Mistral** (EU) extraction
on the **redacted text only** → schema-validate → callback. The callback
(`/api/worker/callback`, shared-secret-guarded) uploads the redacted image and
writes the draft. The admin reviews on `/review`: confirm the content type
(pre-filled to the LLM suggestion), edit, and **publish** — the only path to
member visibility.

### Deploying the worker

The worker needs a VPS (the ML stack is heavy). It ships with a Dockerfile that
bakes in Tesseract + the German spaCy model:

```bash
cd worker
docker build -t aushang-worker .
docker run -p 8000:8000 \
  -e WORKER_SHARED_SECRET="<same as the app>" \
  -e APP_CALLBACK_URL="https://aushang.app" \
  -e MISTRAL_API_KEY="<your mistral key>" \
  aushang-worker
```

Then set `WORKER_URL` + `WORKER_SHARED_SECRET` in the app's env. The **Mistral
key lives on the worker**, never in the web app — the app never sees raw PII or
calls the LLM. Until the worker is deployed, captures upload and create a post
but stay `processing` (no worker to run).

---

## Roadmap

- **Phase 1 (done)** — walking skeleton.
- **Phase 2 (done)** — capture flow + FastAPI
  worker (OCR + Presidio redaction + image blur) + Mistral extraction + schema
  validation.
- **Phase 3** — review gate UI, redaction chips, event confirmation, publish.
- **Phase 4** — calendar (month/list), ICS per-user tokens, email-on-publish, web
  push, PWA install.
- **Phase 5** — GDPR one-pager, AVV PDF, Datenschutzerklärung, deletion flows,
  audit purges, hardening sweep.
