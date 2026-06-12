# Architecture

This document describes the Phase 1 (walking skeleton) architecture and how the
later phases attach to it. It is the engineering companion to the Foundation
Brief.

## System shape

```
                         ┌──────────────────────────────────────────┐
   Browser (PWA)         │  Next.js 16 (App Router) on Vercel/FFM    │
   ──────────────        │                                          │
   anon Supabase client  │  proxy.ts  ── deny-by-default gate        │
   (RLS-governed)        │     │                                     │
                         │     ▼                                     │
                         │  Server Components / Server Actions /     │
                         │  Route Handlers                           │
                         │     │            │                        │
                         │     │ (user)     │ (service role)         │
                         │     ▼            ▼                        │
                         └─────┼────────────┼────────────────────────┘
                               │            │
                          RLS-governed   BYPASSES RLS  (only for
                          queries        security-definer RPCs)
                               │            │
                               ▼            ▼
                         ┌──────────────────────────────────────────┐
                         │      Supabase (EU)  —  Postgres + Auth    │
                         │  RLS on every table · security-definer fns │
                         └──────────────────────────────────────────┘

   Phase 2+ (not built yet):
     raw photo → private bucket → VPS FastAPI worker (OCR + Presidio redaction
     + image blur) → Mistral (EU) extraction → schema-validated draft → review
     gate → publish → feed / ICS / email / push.
```

## The three Supabase clients

There are deliberately three distinct clients, each with a single job:

| Client | File | Key | RLS | Use |
| --- | --- | --- | --- | --- |
| Browser | `lib/supabase/client.ts` | anon | governed | client components |
| Server (user) | `lib/supabase/server.ts` | anon + session cookies | governed | server components, actions, handlers acting AS the user |
| Admin | `lib/supabase/admin.ts` | **service role** | **bypasses** | ONLY the security-definer onboarding RPCs, after our own checks |
| Middleware | `lib/supabase/middleware.ts` | anon + cookies | governed | session refresh + `getUser()` in `proxy.ts` |

The admin client and the server-only env that holds the service-role key both
`import "server-only"`, so a build error is raised if either is ever pulled into
a client component. This is the compile-time half of the secret boundary; the
`scripts/check-no-client-secrets.mjs` bundle scan is the runtime/CI half.

## Authorization: defense in depth

Authorization is enforced at **four** independent layers. Any single layer
failing does not breach the system.

1. **Middleware (`proxy.ts`)** — coarse, fail-closed. Everything not on the
   `routes.ts` allowlist requires a validated session (`getUser()`, which checks
   the JWT against the auth server — `getSession()` is never used for authz).
2. **Route-level guards (`lib/auth.ts`)** — `requireSession()` and
   `requireAdmin()` resolve the user + their DB-backed profile (org + role) at
   the top of every protected route. `requireAdmin()` is the authoritative
   admin check; it does not trust any middleware header.
3. **Security-definer RPCs (`0002_functions.sql`)** — the only code that writes
   `profiles.role` or creates orgs/profiles. They pin `search_path`, validate
   inputs, re-check the actor's role against the SAME org, and are granted to
   `service_role` only.
4. **Row Level Security (`0003_rls.sql`)** — the final backstop in the database.
   Even if application code is wrong, RLS prevents cross-org reads/writes and
   keeps members to published/confirmed rows.

## Multi-tenant isolation

Every domain row carries `org_id`. The helper functions `my_org_id()` and
`is_admin()` (security-definer, `search_path`-pinned) drive every policy:

- **Members** read `posts` where `status = 'published'` and events where
  `status = 'confirmed'`, in their own org only, via the `posts_public` view
  (which omits PII columns). No writes.
- **Admins** get full CRUD within their own org via the `*_admin_all` policies —
  never cross-org.
- `profiles.role` / `org_id` are unchangeable from the client: the member UPDATE
  policy's `WITH CHECK` re-asserts both against the existing row.

### Columns vs rows (important for Phase 3)

RLS gates **rows**, not **columns**. The PII columns on `posts` (`ocr_text_raw`,
`ocr_text_redacted`, `redactions`, `source_image_path`) are therefore
**column-level `REVOKE`d** from `authenticated` (migration `0004`) — not merely
hidden behind a view. Consequence: **no anon-key/browser client can read PII
columns, including an admin's.** The Phase 3 review-gate UI must fetch the raw
photo and pre-redaction context through a **server component / route handler
using the service role**, not the browser client. This is by design — admin PII
access is server-only by construction.

### Onboarding intent binding

Magic-link URLs carry no org/invite parameters. The intent is persisted
server-side in `pending_onboarding` (keyed by email) at link-issuance time, and
the `/auth/callback` reads it by the *authenticated* email — closing the
query-param tampering vector found in review. Links are verified with
`verifyOtp({ token_hash, type })` (the correct flow for server-issued links).

## Onboarding sequence (org creation)

```
/start ──(name,type,email)──► server action validates + ALLOW_ORG_SIGNUP gate
   │
   └─► admin.generateLink(magiclink, redirectTo=/auth/callback?intent=org&orgName&orgType)
          │  (Supabase emails the link; user proves email control by clicking)
          ▼
   /auth/callback ── exchangeCodeForSession ── getUser()
          │
          └─► (no profile yet) admin.rpc('create_org_and_admin', {user_id, name, type})
                 │   org created · caller promoted to admin · first invite minted
                 ▼
              redirect /feed
```

Invite redemption and approved-join follow the same shape with
`intent=invite|approved` and the corresponding RPC. The org/profile is never
created until the user clicks their own magic link — there is no drive-by org
creation with someone else's address.

## Data model

See `supabase/migrations/0001_schema.sql`. Five core tables (`orgs`, `profiles`,
`invites`, `join_requests`, `posts`) plus `events`, `audit_log`, and
`ics_tokens`. RLS is `ENABLE`d **and** `FORCE`d on every table, so even the table
owner is subject to policy; `service_role`'s `BYPASSRLS` is the one intentional
exception, used only by the definer flows.

## What is intentionally NOT here yet

Phase 1 is a skeleton. The following are designed but unbuilt, and their absence
is intentional:

- The capture flow, the FastAPI worker, OCR/Presidio redaction, image blur, the
  Mistral extraction call, and the `posts`/`events` write path from the worker.
- The `/api/ics/[token]` route (the allowlist prefix exists in anticipation; no
  handler is wired, so the prefix matches nothing routable yet).
- Email (Resend), web push (VAPID), PWA manifest/service worker.
- GDPR deliverables (AVV PDF, full Datenschutzerklärung), audit purges (pg_cron),
  and the `delete_user_account` HTTP endpoint (the DB function exists; the route
  does not).

Each later phase ends with: `npm run verify` clean, RLS tested with the two-org
fixture, and no secrets in the client bundle.
