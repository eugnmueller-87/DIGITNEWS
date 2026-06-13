# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Aushang" (working title; repo dir is `DIGITNEWS`) — a digitization layer for old-school
orgs (Kitas, clubs, churches). An admin **photographs a paper notice board**; the system OCRs

- redacts PII locally, an EU LLM extracts structure, the admin reviews/confirms, and members
  get a private feed + calendar + ICS + email digest. It is **not** a news/RSS reader despite
  the repo name. Branding is single-source in `src/config/brand.ts` (rename = one-file change).

Production: `kita-connect.cloud` (domain at Hostinger, app on Vercel, DB/auth on Supabase EU,
email via Resend).

## Commands

```bash
npm run dev          # next dev (http://localhost:3000)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (type-aware; no-floating-promises etc. are ERRORS)
npm run format:check # prettier --check
npm run build        # next build (fails on TS errors; ignoreBuildErrors=false)
npm run verify       # typecheck + lint + format:check + build + both secret scans — run before push
npm run gen:icons    # regenerate PWA icons from public/icons/master.svg (uses sharp)
```

Secret scans (`check:secrets` greps the built client bundle; `check:source-secrets` greps
tracked source) run in `verify`, in CI, and `check:source-secrets` also runs in the pre-commit
hook — a server secret reaching the client bundle is a build-blocking failure.

Python worker (`worker/`, separate toolchain):

```bash
cd worker && pip install -e ".[dev]"
ruff check . && ruff format --check .   # lint + format
mypy                                     # types
pytest -q                                # tests (single: pytest tests/test_x.py::test_name)
```

CI (`.github/workflows/ci.yml`) has two jobs: **web** (typecheck/lint/format/build/secret-scans)
and **worker** (ruff/mypy/pytest). It injects placeholder `NEXT_PUBLIC_*` + service-role env so
the build runs — those are not real secrets.

Note: there is currently **no JS test runner** wired into `main` (`verify` has no `test` step).
A Vitest suite exists in branch history but was never merged to the remote `main`.

## Architecture: the security model is the architecture

Authorization is enforced at **four independent layers** — never collapse them, and call out in
any PR if you touch one:

1. **`src/proxy.ts`** — deny-by-default middleware. Everything not on the `src/lib/routes.ts`
   allowlist requires a validated session (`getUser()`, never `getSession()`).
2. **`src/lib/auth.ts`** — `requireSession()` / `requireAdmin()` / `requireSuperadmin()` resolve
   the user + DB-backed profile (org + role) at the top of every protected route. Authoritative;
   trusts no middleware header.
3. **Security-definer RPCs** (`supabase/migrations/0002`, `0005`, `0007`) — the ONLY code that
   writes `profiles.role` or creates orgs/profiles. `search_path`-pinned, input-validated,
   re-check the actor, granted to `service_role` only.
4. **RLS + column grants** (`0003`, `0006`) — DB backstop. Org-scoped; members read only
   published/confirmed rows. PII columns (`ocr_text_raw`, `ocr_text_redacted`, `redactions`,
   `source_image_path`) are column-level `REVOKE`d from `authenticated` (`0004`) — so even an
   admin's browser/anon client cannot read them. **Admin PII access is server-only by
   construction** (service role via a route handler/server component, never the browser client).

### Three roles, multi-tenant by `org_id`

`superadmin` (operator, cross-org) / `admin` (own org) / `member` (read-only). Every domain row
carries `org_id`; helper fns `my_org_id()`, `is_admin()`, `is_superadmin()` drive every policy.
A superadmin's `my_org_id()` points at their own "Operator" anchor org so org-scoped policies
never widen their reach — cross-org access comes only from dedicated `*_superadmin_*` policies.

### Three Supabase clients — each has one job (don't mix them)

| File                         | Key              | RLS          | Use                                                   |
| ---------------------------- | ---------------- | ------------ | ----------------------------------------------------- |
| `lib/supabase/client.ts`     | anon             | governed     | client components                                     |
| `lib/supabase/server.ts`     | anon + cookies   | governed     | server components/actions/handlers acting AS the user |
| `lib/supabase/admin.ts`      | **service role** | **bypasses** | ONLY the definer RPCs, after our own checks           |
| `lib/supabase/middleware.ts` | anon + cookies   | governed     | session refresh in proxy.ts                           |

`lib/supabase/admin.ts` and `lib/env.server.ts` both `import "server-only"` — the compile-time
half of the secret boundary. Never construct a service-role client outside `admin.ts`.

## Non-negotiable principles (from README/brief)

- **LLM advises, deterministic code decides.** Nothing publishes without explicit admin
  confirmation; all LLM output is schema-validated (`src/lib/content/extraction-schema.ts`).
  Routing reads ONLY the admin-confirmed `posts.content_type` (nullable, no default — `NULL`
  means "unconfirmed", deliberately distinct from the `info` fallback), never the LLM's
  `content_type_suggested` (admin-only column, not granted to members).
- **Privacy by construction.** Raw photos never leave our infra; PII is redacted **locally**
  (worker: Tesseract → Presidio + spaCy + regex, fail-closed) **before any external LLM call**.
  Only redacted text reaches Mistral (EU). Never add a path that sends raw images / unredacted
  PII anywhere. The Mistral key lives on the worker, never in the web app.
- **Deny by default / invite-only.** No public signup. Accounts are operator/admin-provisioned.
  Keep `enable_signup = false`.

## Auth (email + password, invite-only)

`/login` uses `signInWithPassword`. There is no standing magic-link login — links
(`type=recovery`/`invite`) only ESTABLISH a session that lands on `/set-password`, where the
user sets a password via `updateUser`. Invites + forgot-password email a one-time set-password
link via **Resend** (`src/lib/auth-flows.ts` → `sendPasswordSetupLink`), routed through
`/auth/callback`. `/set-password` and `/passwort-vergessen` are in the public allowlist (they
need a link-issued session, not a profile). Login errors are deliberately neutral (no
enumeration). Requires the Supabase dashboard Email provider to have password sign-in enabled.

## The capture → publish pipeline (the core feature)

`/aufnahme` (admin) compresses the photo client-side → uploads raw to the private `raw-photos`
bucket via a signed URL → `finalizeCapture` creates a `processing` post + triggers the VPS
worker (`worker/`, FastAPI) with a short-TTL signed URL → worker OCRs/redacts/blurs/extracts →
POSTs `/api/worker/callback` (shared-secret, constant-time) which writes a draft → admin reviews
on `/review` and publishes (`publish_post` RPC: sets confirmed `content_type`, flips to
`published`, confirms pending events) → members see it on `/feed` etc. **Until the worker is
deployed, captures upload but stay `processing`** (no worker to run) — the web app works without
it, but the core feature is inert.

`content_type` routing (`src/lib/content/types.ts` `ROUTING`): `meal_plan`/`reflection` →
section + `post_details`; `health_notice` → top-of-feed alert by severity; `event_notice` →
`events` table + ICS; `info` → general feed.

## Conventions

- **Next.js 16 is not the version you may know** — read `node_modules/next/dist/docs/` before
  using App Router APIs (per `AGENTS.md`). React 19, Tailwind v4, TypeScript strict.
- Hand-authored DB types in `src/lib/database.types.ts` (a Phase-1 stub covering only what's
  queried; regenerate with `supabase gen types` later). `health_severity` etc. are
  `text`+CHECK, **not** Postgres enums — so a DB `ORDER BY` on them sorts alphabetically, not by
  severity. Order such columns in code, not SQL.
- Input validation is hand-rolled in `src/lib/validation.ts` (minimal deps). `safeNextPath`
  guards open redirects.
- German is the user-facing language; keep UI strings + comments consistent with the codebase.
- Two-org isolation is the headline acceptance test: seed `supabase/fixtures/two_orgs.sql` and
  confirm cross-org reads return zero rows.

## Operational docs

`docs/ARCHITECTURE.md` (system shape + provisioning sequences), `docs/GO_LIVE_CHECKLIST.md`
(Vercel/Hostinger/Supabase setup), `docs/STORE_PRIVACY.md` (Apple/Play privacy mapping),
`SECURITY.md` (adversarial review findings). `supabase/config.toml` mirrors security-critical
auth settings and is the version-controlled source of truth for them.
