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
  for now; an app-level token bucket is a Phase 2+ hardening item.
- **`npm audit`** flags a transitive `postcss` advisory inside Next.js's own
  tree; the "fix" downgrades Next to 9.x and is intentionally not applied (see
  README).
