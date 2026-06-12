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
>
> - RLS + helper functions, auth/onboarding flows, deny-by-default middleware, and
>   an empty member feed. The capture → OCR → redaction → LLM pipeline (Phase 2+)
>   is **not** built yet. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the
>   full plan.

The working title is **Aushang**; final naming is TBD. All branding lives in one
file — [`src/config/brand.ts`](src/config/brand.ts) — so a rename is a one-file
change.

---

## Tech stack

| Layer               | Choice                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Frontend            | Next.js 16 (App Router), React 19, TypeScript, PWA                                                         |
| DB / Auth / Storage | Supabase (EU region), RLS on every table                                                                   |
| Auth method         | Supabase Auth, **magic link / email OTP only** (no passwords; no public signup — accounts are provisioned) |
| Styling             | Tailwind CSS v4                                                                                            |

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
   - `supabase/migrations/0005_operator_model.sql` (three-role model)
   - `supabase/migrations/0006_rls_three_roles.sql` (superadmin RLS)
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

## Roles & onboarding (operator-provisioned)

There is **no public signup and no self-service join**. Accounts are provisioned:

- **Superadmin (operator — you)** logs in (bootstrapped from `SUPERADMIN_EMAILS`)
  and uses **`/operator`** to create orgs and add each org's first **admin**.
  Can also grant/revoke admin rights across orgs.
- **Admin** uses **`/admin/mitglieder`** to add/remove **members** in their own
  org (enter an email → that person's account is created and a login link is
  sent; they show as _invited_ until first login). Admins cannot add other admins
  or touch other orgs.
- **Member** has read-only access (feed, calendar).
- **Everyone** logs in at **`/login`** with a magic link.

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
