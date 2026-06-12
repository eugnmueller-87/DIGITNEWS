# Aushang

> Digitalisierung ohne Prozessänderung.

A digitization layer for old-school organizations (Kitas, Vereine,
Kirchengemeinden, Kleingartenkolonien, small businesses) that does **not** change
their processes. The org keeps pinning paper notices to its physical board; one
admin photographs the board from inside the tool; the system OCRs and redacts the
photo locally, extracts structured content and dates via an EU-hosted LLM, the
admin reviews and confirms, and members get a private feed, a shared calendar, an
ICS subscription, and an email digest.

> **Status: Phase 1 — walking skeleton.** Repo, Next.js + Supabase wiring, schema
> + RLS + helper functions, auth/onboarding flows, deny-by-default middleware, and
> an empty member feed. The capture → OCR → redaction → LLM pipeline (Phase 2+)
> is **not** built yet. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the
> full plan.

The working title is **Aushang**; final naming is TBD. All branding lives in one
file — [`src/config/brand.ts`](src/config/brand.ts) — so a rename is a one-file
change.

---

## Tech stack

| Layer            | Choice                                              |
| ---------------- | --------------------------------------------------- |
| Frontend         | Next.js 16 (App Router), React 19, TypeScript, PWA  |
| DB / Auth / Storage | Supabase (EU region), RLS on every table         |
| Auth method      | Supabase Auth, **magic link / email OTP only** (no passwords; public signup disabled) |
| Styling          | Tailwind CSS v4                                      |

Future phases add: Python FastAPI OCR/redaction worker (Tesseract/PaddleOCR +
Microsoft Presidio + spaCy), Mistral (EU) LLM extraction, Resend email, Web Push.

---

## Non-negotiable principles

1. **LLM advises, deterministic code decides.** Nothing publishes without explicit
   admin confirmation; all LLM output is schema-validated.
2. **Privacy by construction.** Raw photos never leave our infrastructure; PII is
   detected and masked **locally before any external API call**; fail-closed.
3. **Only published information.** The tool processes only what the org already
   posted to its own board.
4. **Two roles, period.** `admin` and `member`. No third role anywhere.
5. **Deny by default.** No public surface except `/login`, `/start`, `/join/[code]`,
   `/auth/*`, `/api/ics/*`, and `/datenschutz`. Everything else requires auth.

---

## Getting started

### 1. Prerequisites

- Node.js 20+ (developed on 24), npm 11+
- A **new** Supabase project in an **EU region** (Ireland or Frankfurt). Do not
  reuse any prior project.

### 2. Provision Supabase

1. Create a new Supabase project (EU region).
2. In **Authentication → Providers → Email**: disable password auth, enable
   magic link / OTP. In **Authentication → Settings**: set **"Allow new users to
   sign up" = OFF** (matches `supabase/config.toml: enable_signup = false`).
3. In **Authentication → URL Configuration**: set the Site URL and add
   `http://localhost:3000/auth/callback` (and your prod equivalent) to the
   **Redirect Allow List** — exact matches only.
4. **Magic-link email template** (Authentication → Email Templates → Magic Link):
   the link MUST deliver a `token_hash` to our callback, because the app verifies
   links with `verifyOtp({ token_hash, type })`. Set the link to:

   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink
   ```

   (Do **not** use the default `{{ .ConfirmationURL }}` — that is the PKCE/redirect
   flow, which does not apply to server-issued links and will fail to establish a
   session. See `supabase/config.toml`.)
5. Apply the migrations in order (SQL editor or `supabase db push`):
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_functions.sql`
   - `supabase/migrations/0003_rls.sql`
   - `supabase/migrations/0004_security_hardening.sql`
6. Configure SMTP (or Supabase's built-in email) so magic links are delivered.

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

### 4. Run

```bash
npm install
npm run dev      # http://localhost:3000
```

### 5. Verify (run before every push)

```bash
npm run verify   # typecheck + lint + build + client-secret scan
```

`npm run check:secrets` greps the built client bundle and **fails** if a server
secret ever leaks into it (Brief §11).

---

## Onboarding flows

- **Create an org** — `/start`: enter org name + type + your email → magic link →
  on click, the org is created and you become its **admin**, with a shareable
  join code. Gated by `ALLOW_ORG_SIGNUP` (waitlist toggle).
- **Join an org** — `/join/[code]`: enter your email. If the invite requires
  approval, a pending request is recorded and an admin approves it (then you get
  a link). Otherwise you get a join link immediately.
- **Log in** — `/login`: existing users request a magic link.

Accounts are **only** created through these server-side security-definer flows
(`create_org_and_admin`, `redeem_invite`, `redeem_approved_join`). The public
signup endpoint is off.

---

## Security model (Phase 1)

Defense in depth, four layers:

1. **Middleware (`src/proxy.ts`)** — deny-by-default coarse gate. Validates the
   session via `getUser()` (JWT checked against the auth server), redirects
   non-allowlisted unauthenticated requests to `/login`.
2. **Server auth helpers (`src/lib/auth.ts`)** — `requireSession()` /
   `requireAdmin()` re-check session + DB-backed role at every protected route.
3. **Security-definer RPCs** — the only writers of `profiles.role`; pinned
   `search_path`, input-validated, `service_role`-only.
4. **Row Level Security + column grants** — the final backstop. Every table is
   org-scoped; members read only published/confirmed rows. Because RLS gates
   rows but **not columns**, PII columns (`ocr_text_raw`, `ocr_text_redacted`,
   `redactions`, `source_image_path`) are **column-level REVOKE**d from
   `authenticated` (migration `0004`), so a member cannot read them even by
   querying the base `posts` table directly. Admin PII access is server-only
   (service role).

**Onboarding intent is bound server-side.** Magic-link URLs carry **no** org or
invite parameters (those are user-editable and were a privilege-escalation
vector). The intent lives in the `pending_onboarding` table keyed by email; the
callback reads it by the *authenticated* email and re-checks the waitlist gate.

This walking skeleton was put through a multi-agent **adversarial security
review** before first commit; findings and fixes are recorded in
[`SECURITY.md`](SECURITY.md).

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
      admin/               # admin-only (requireAdmin) — members, approvals
      feed/                # member feed (empty in Phase 1)
    auth/callback/         # magic-link landing + onboarding finalizer
    join/[code]/           # member onboarding
    login/  start/         # auth entry points
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
  migrations/              # 0001 schema, 0002 functions, 0003 RLS
  fixtures/two_orgs.sql    # isolation test fixture
  config.toml              # security-critical auth settings (version-controlled)
scripts/
  check-no-client-secrets.mjs   # CI guard: no secrets in client bundle
```

---

## Roadmap

- **Phase 1 (done)** — walking skeleton.
- **Phase 2** — capture flow (compression, multi-shot, offline queue) + FastAPI
  worker (OCR + Presidio redaction + image blur) + Mistral extraction + schema
  validation.
- **Phase 3** — review gate UI, redaction chips, event confirmation, publish.
- **Phase 4** — calendar (month/list), ICS per-user tokens, email-on-publish, web
  push, PWA install.
- **Phase 5** — GDPR one-pager, AVV PDF, Datenschutzerklärung, deletion flows,
  audit purges, hardening sweep.
