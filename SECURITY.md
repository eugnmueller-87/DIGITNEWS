# Security

This file records the security posture of the Phase 1 walking skeleton and the
adversarial review it passed before first commit. Update it each phase.

## Reporting

Found a vulnerability? Email **hallo@aushang.app** (placeholder until the final
domain is set). Please do not open a public issue for security reports.

## Phase 1 adversarial review

Before the first commit, the auth flows, RLS policies, middleware, secret
boundary, and multi-tenant isolation were reviewed by a multi-agent harness:
independent reviewers per attack surface, each finding then **adversarially
verified** by a separate skeptic agent instructed to refute it against the real
code. 22 findings were raised; 13 survived verification; 9 were rejected as
non-issues (e.g. claims that misread the code). The confirmed findings below were
fixed in this same skeleton.

### Confirmed & fixed

| Sev      | Finding                                                                                                                                                                   | Fix                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical | RLS gates rows, not columns — members could `select ocr_text_raw, redactions, source_image_path` straight from the base `posts` table, bypassing the `posts_public` view. | Column-level `REVOKE` on `posts`; re-`GRANT` only non-PII columns to `authenticated` (`0004`).                                                                          |
| Critical | Onboarding intent was carried in **editable** magic-link query params — an attacker could rewrite them to redeem another org's invite or create an org.                   | Intent moved server-side to `pending_onboarding` (keyed by email); callback dispatches by the **authenticated** email and ignores URL params (`0004`, `auth/callback`). |
| High     | A plain login link could be "upgraded" to org-create, bypassing the `ALLOW_ORG_SIGNUP` waitlist.                                                                          | Same intent-binding fix **plus** the callback re-checks `allowOrgSignup` before `create_org_and_admin`.                                                                 |
| High     | `ics_tokens` UPDATE policy omitted `org_id` in `WITH CHECK`, letting a user move a token to another org (cross-tenant).                                                   | Pin `org_id = my_org_id()` in both `USING` and `WITH CHECK` (`0004`).                                                                                                   |
| High     | Magic links were verified with `exchangeCodeForSession` (PKCE), which cannot work for **server-issued** `generateLink` links — onboarding would never complete.           | Verify with `verifyOtp({ token_hash, type })`; email template delivers `token_hash` (documented in README + `config.toml`).                                             |
| Medium   | A generated invite code could exceed the join validator's length cap for long org names, 404-ing the join link.                                                           | Cap the slug to 40 chars before minting the code (`0004`); widen `parseInviteCode` bound to 96.                                                                         |
| Medium   | `pgcrypto`/`extensions` dependency was undeclared (migrations would fail on a fresh/self-hosted DB).                                                                      | `create extension if not exists pgcrypto with schema extensions` (`0004`).                                                                                              |
| Medium   | `/join` leaked invite **state** (not-found vs expired vs exhausted) and the org name — an enumeration oracle.                                                             | Single generic message for all invalid states; invite code entropy raised to 48 bits (`gen_random_bytes(6)`).                                                           |
| Low      | No Content-Security-Policy.                                                                                                                                               | CSP added in **report-only** mode (`next.config.ts`); promote to enforcing once the script inventory is final.                                                          |
| Info     | Middleware `getUser()` had no `try/catch`.                                                                                                                                | Wrapped; fails **closed** (treats errors as unauthenticated).                                                                                                           |
| Info     | Misleading `slugify` comment.                                                                                                                                             | Corrected.                                                                                                                                                              |

### Verified-correct (no change needed)

- Security-definer RPCs are `service_role`-only, `search_path`-pinned, and are
  the sole writers of `profiles.role`/`org_id`.
- `profiles_update_self` `WITH CHECK` blocks role/org escalation.
- `safeNextPath` / `parseInviteCode` resist open-redirect and injection.
- The deny-by-default proxy gate is **active at runtime** (verified by hitting
  protected routes on a production build: `/feed` → 307 → `/login`). An empty
  `middleware-manifest.json` under Turbopack is a manifest quirk, not an inactive
  gate — confirmed empirically, not from the manifest.

## Operator-model refactor review

When the project moved from self-service onboarding to the **operator-provisioned
three-role model** (superadmin / admin / member), the changed surfaces —
provisioning RPCs, the new RLS, privilege escalation, cross-org isolation — were
put through a second adversarial review (12 raised, 9 confirmed, 3 rejected).
None were live exploits; all were latent footguns or robustness gaps, and all
were fixed in migration `0007` + app code.

| Sev    | Finding                                                                                                                                                                                                                  | Fix                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High   | The old `delete_user_account()` survived the refactor — a service-role-callable function that deletes a whole org when its last admin leaves (it predates the three-role model and the "never orphan an org" invariant). | Dropped in `0007`. Deliberate teardown is now `delete_org` (superadmin-only, refuses the operator's own org).                                                                |
| Medium | Cross-tenant email enumeration: "already belongs to an org" gave admins an oracle for whether any email existed platform-wide.                                                                                           | `provisionPerson` returns a neutral outcome; the add-person action shows the **same** message whether or not the email already existed.                                      |
| Medium | `ensureAuthUser` used un-paginated `listUsers()` (broke past 50 users) and could leave an orphan org if admin provisioning failed after org creation.                                                                    | Replaced with a single `generateLink` call (creates-or-finds + emails). `createOrgWithAdmin` now rolls back the org via `delete_org` if the admin can't be provisioned.      |
| Low    | `profiles_update_self` didn't pin the new `membership_status` column — a member could self-forge their invited/active badge.                                                                                             | Pinned in `0007` (mirrors the role/org_id pins).                                                                                                                             |
| Low    | `generateLink` could silently send no email (misconfigured template) while the UI reported success.                                                                                                                      | Errors no longer swallowed in the provisioning path; the magic-link email-template requirement is documented in README + `config.toml`.                                      |
| Low    | Stale doc comment in `admin.ts` listed deleted RPCs.                                                                                                                                                                     | Updated to the live flow list.                                                                                                                                               |
| Info   | Provisioning RPCs authorize on a caller-supplied `p_actor_id`.                                                                                                                                                           | Added an `auth.uid()` backstop in `0007`: if a user JWT is present it must match `p_actor_id`, so an accidental future grant-to-`authenticated` can't become self-elevation. |

## Standing invariants (must hold every phase)

- A user in org A can never read or write any row of org B (superadmins are the
  one intended cross-org exception, via explicit `*_superadmin_*` policies).
- A `member` never sees non-published posts, non-confirmed events, or PII columns.
  (PII **columns** stay unreadable; the photo-consent feature is the one place a
  raw image is delivered to a member — only via a server-minted signed URL, never
  a column read — see "Photo consent" below.)
- A `member` can never become `admin`/`superadmin`; an `admin` can never become
  `superadmin`, act cross-org, or add/remove admins. Role/org_id/membership_status
  are written only by security-definer flows; never client-settable.
- The first `superadmin` is bootstrapped only from `SUPERADMIN_EMAILS` (matched
  against the validated JWT email), or the documented SQL fallback.
- No public surface beyond the `routes.ts` allowlist; no public signup or self-join.
- No server secret in the client bundle (`npm run check:secrets` enforces this).
- `npm run verify` (typecheck + lint + build + secret scan) is green before push.

## Known deferrals

- **CSP is report-only.** It does not block yet; promote to enforcing with a
  script nonce once the Supabase/font inventory is finalized.
- **Rate limiting** on magic-link / login requests relies on Supabase built-ins
  for now; an app-level token bucket is a Phase 2+ hardening item. (The QR apply
  submit has its own per-code DB rate limit — see below.)
- **`npm audit`** flags a transitive `postcss` advisory inside Next.js's own
  tree; the "fix" downgrades Next to 9.x and is intentionally not applied (see
  README).

## Photo consent — releasing the clear original to members (migration 0020)

By default members only ever see the **blurred** (`redacted_image_path`) image;
the raw original (`source_image_path`, `raw-photos` bucket) is admin/worker-only
and its column is `REVOKE`'d from `authenticated` (`0004`). `0020` adds a
**double-gated** path to show the original to a member, never a silent default:

- `profiles.photo_consent` (member opt-in, default false) — self-set via the RLS
  client, exactly like `email_digest_opt_in`; a member can set only their own.
- `posts.clear_photo_allowed` (admin per-post release, default false) — written
  **only** by `publish_post` (security-definer, re-checks admin+org). A member can
  never set it.

Design properties:

- The visibility decision is a **server-side AND** of the two flags
  (`src/lib/photo.ts` → `signPostImages`). The client never chooses which image it
  gets; it only renders the URL the server hands it.
- The original is delivered **exclusively via a short-TTL (10 min) signed URL**
  minted by the **service role**. `source_image_path` stays REVOKE'd — no member
  client ever reads the column; neither column enters `posts_public`.
- The service-role read of `source_image_path` + `clear_photo_allowed` is
  **org-scoped** (`.eq("org_id", session.orgId)`) — mandatory, since the service
  role bypasses RLS — so a consenting member in org B can never reach org A's
  originals.
- Both defaults are false ⇒ every pre-`0020` published post is safe with zero
  backfill, and a post is exposed only after two deliberate opt-ins.
- Operationally: the raw originals of **published** posts are now retained by
  design (the purge in `0014` only deletes `failed` posts), since a released
  clear-photo post depends on its original existing.

## QR self-apply — public surface (migration 0009)

The QR apply flow (`/apply/[code]`, submit, `/apply/verify`) is the app's first
**public unauthenticated write surface**. Design properties:

- **No anon RLS.** `join_codes` and `applications` have admin/superadmin policies
  only. The public submit/verify run exclusively through security-definer RPCs
  granted to `service_role`; an admin sees only their own org's queue.
- **Verification token hashed at rest.** 256-bit random token; only its sha256 is
  stored; single-use (cleared on verify) + 24h expiry. A DB leak yields no usable
  tokens. The plaintext exists only in the emailed link.
- **Child data is purpose-limited + purged.** `parent_name` / `child_group` /
  `child_name` live only on the pending application, are visible only to that
  org's admin, and are NULLed on approve **and** reject. `purge_stale_applications`
  clears abandoned rows (pending/verified >14d, decided >30d). The audit log
  records the application id + action only — never the names. _This is a
  deliberate, conscious collection of child data for the admission decision; the
  product otherwise avoids child profiles._
- **Enumeration / flood resistance.** Join codes are ~144-bit random; submit and
  verify return neutral messages; per-code rate limit (30 new applications/hour)
  caps queue/child-data flooding; per-email+code dedupe collapses resubmits.
- **Admission stays admin-approved** — verification proves email ownership but
  never grants membership; an admin must approve, which then provisions the
  member via the existing `provisionPerson` flow.

> **Email delivery:** the verification email is sent via Resend
> (`src/lib/email/`). When `RESEND_API_KEY` is unset, the send **no-ops** (logged,
> non-fatal) — the application row still exists but no link is delivered. Set the
> key + a verified `EMAIL_FROM` domain to enable delivery (see README "Email").
