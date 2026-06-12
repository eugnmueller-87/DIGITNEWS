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
2. **Route-level guards (`lib/auth.ts`)** — `requireSession()`, `requireAdmin()`
   (admin-or-superadmin), and `requireSuperadmin()` resolve the user + their
   DB-backed profile (org + role) at the top of every protected route. These are
   the authoritative role checks; they do not trust any middleware header.
3. **Security-definer RPCs (`0002`, `0005`, `0007`)** — the only code that writes
   `profiles.role` or creates orgs/profiles (`create_org`, `add_person`,
   `remove_person`, `set_admin`, `ensure_superadmin`, `delete_org`,
   `activate_profile`). They pin `search_path`, validate inputs, re-check the
   actor's role/scope, carry an `auth.uid()` backstop, and are granted to
   `service_role` only.
4. **Row Level Security (`0003`, `0006`)** — the final backstop in the database.
   Even if application code is wrong, RLS prevents cross-org reads/writes and
   keeps members to published/confirmed rows.

## Roles & multi-tenant isolation

Three roles: **superadmin** (operator, cross-org), **admin** (own org),
**member** (read-only). Every domain row carries `org_id`. Helper functions
`my_org_id()`, `is_admin()` (true for admin **and** superadmin), and
`is_superadmin()` (security-definer, `search_path`-pinned) drive every policy:

- **Members** read `posts` where `status = 'published'` and events where
  `status = 'confirmed'`, in their own org only, via the `posts_public` view
  (which omits PII columns). No writes.
- **Admins** get full CRUD within their own org via the `*_admin_all` policies —
  never cross-org. They add/remove **members** (not admins) via the provisioning
  RPCs.
- **Superadmins** get cross-org read/write via explicit `*_superadmin_*` policies
  (the one intended cross-tenant exception). They create orgs and grant/revoke
  admin. A superadmin's `my_org_id()` points at their own "Operator" anchor org,
  so the org-scoped `*_admin_all` policies never accidentally widen their reach —
  cross-org access comes only from the dedicated superadmin policies.
- `profiles.role` / `org_id` / `membership_status` are unchangeable from the
  client: the member UPDATE policy's `WITH CHECK` re-asserts all three against the
  existing row.

### Columns vs rows (important for Phase 3)

RLS gates **rows**, not **columns**. The PII columns on `posts` (`ocr_text_raw`,
`ocr_text_redacted`, `redactions`, `source_image_path`) are therefore
**column-level `REVOKE`d** from `authenticated` (migration `0004`) — not merely
hidden behind a view. Consequence: **no anon-key/browser client can read PII
columns, including an admin's.** The Phase 3 review-gate UI must fetch the raw
photo and pre-redaction context through a **server component / route handler
using the service role**, not the browser client. This is by design — admin PII
access is server-only by construction.

### No onboarding intent in URLs

Magic links carry no org/role parameters — they only log a (pre-provisioned)
user in. Account + role assignment happen entirely server-side when an
operator/admin provisions someone, so there is nothing escalatable to tamper
with in the link. Links are verified with `verifyOtp({ token_hash, type })` (the
correct flow for server-issued links).

## Provisioning sequences

**Operator bootstrap (first login of an allowlisted email):**

```
/login ──(email)──► generateLink(magiclink) ──► Supabase emails token_hash link
   │
   └─► /auth/callback ── verifyOtp(token_hash) ── getUser()
          │  isSuperadminEmail(user.email) ?  ── yes ──► ensure_superadmin(uid,email)
          │                                              (creates Operator org + superadmin)
          ▼
       redirect /feed   (Operator nav now visible)
```

**Operator creates an org + first admin (`/operator`):**

```
create_org(actor, name, type) ──► orgId
   └─► provisionPerson(actor, orgId, adminEmail, role:'admin')
          │  generateLink creates-or-finds the auth user + emails the link
          └─► add_person(actor, userId, orgId, 'admin')   (status 'invited')
   (on failure: delete_org rolls back the just-created org — no orphan)
```

**Admin adds a member (`/admin/mitglieder`):** same `provisionPerson` shape with
`role:'member'`, scoped to the admin's own org by `add_person`. The added person
shows as *invited* until their first login flips them to *active*
(`activate_profile` in the callback).

## Data model

See `supabase/migrations/`. Core tables: `orgs`, `profiles` (with `role` ∈
{superadmin, admin, member} and `membership_status` ∈ {invited, active}),
`posts`, `events`, `audit_log`, `ics_tokens`. The original self-service
`invites` / `join_requests` / `pending_onboarding` tables were **removed** in
`0005` when the model became operator-provisioned. RLS is `ENABLE`d **and**
`FORCE`d on every table; `service_role`'s `BYPASSRLS` is the one intentional
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
  and the per-user self-deletion endpoint. Org-level erasure exists at the DB
  layer (`delete_org`, superadmin-only); a UI/route for it is a later phase.

Each later phase ends with: `npm run verify` clean, RLS tested with the two-org
fixture, and no secrets in the client bundle.
