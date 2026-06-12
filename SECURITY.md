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

| Sev | Finding | Fix |
| --- | --- | --- |
| Critical | RLS gates rows, not columns — members could `select ocr_text_raw, redactions, source_image_path` straight from the base `posts` table, bypassing the `posts_public` view. | Column-level `REVOKE` on `posts`; re-`GRANT` only non-PII columns to `authenticated` (`0004`). |
| Critical | Onboarding intent was carried in **editable** magic-link query params — an attacker could rewrite them to redeem another org's invite or create an org. | Intent moved server-side to `pending_onboarding` (keyed by email); callback dispatches by the **authenticated** email and ignores URL params (`0004`, `auth/callback`). |
| High | A plain login link could be "upgraded" to org-create, bypassing the `ALLOW_ORG_SIGNUP` waitlist. | Same intent-binding fix **plus** the callback re-checks `allowOrgSignup` before `create_org_and_admin`. |
| High | `ics_tokens` UPDATE policy omitted `org_id` in `WITH CHECK`, letting a user move a token to another org (cross-tenant). | Pin `org_id = my_org_id()` in both `USING` and `WITH CHECK` (`0004`). |
| High | Magic links were verified with `exchangeCodeForSession` (PKCE), which cannot work for **server-issued** `generateLink` links — onboarding would never complete. | Verify with `verifyOtp({ token_hash, type })`; email template delivers `token_hash` (documented in README + `config.toml`). |
| Medium | A generated invite code could exceed the join validator's length cap for long org names, 404-ing the join link. | Cap the slug to 40 chars before minting the code (`0004`); widen `parseInviteCode` bound to 96. |
| Medium | `pgcrypto`/`extensions` dependency was undeclared (migrations would fail on a fresh/self-hosted DB). | `create extension if not exists pgcrypto with schema extensions` (`0004`). |
| Medium | `/join` leaked invite **state** (not-found vs expired vs exhausted) and the org name — an enumeration oracle. | Single generic message for all invalid states; invite code entropy raised to 48 bits (`gen_random_bytes(6)`). |
| Low | No Content-Security-Policy. | CSP added in **report-only** mode (`next.config.ts`); promote to enforcing once the script inventory is final. |
| Info | Middleware `getUser()` had no `try/catch`. | Wrapped; fails **closed** (treats errors as unauthenticated). |
| Info | Misleading `slugify` comment. | Corrected. |

### Verified-correct (no change needed)

- Security-definer RPCs are `service_role`-only, `search_path`-pinned, and are
  the sole writers of `profiles.role`/`org_id`.
- `profiles_update_self` `WITH CHECK` blocks role/org escalation.
- `safeNextPath` / `parseInviteCode` resist open-redirect and injection.
- The deny-by-default proxy gate is **active at runtime** (verified by hitting
  protected routes on a production build: `/feed` → 307 → `/login`). An empty
  `middleware-manifest.json` under Turbopack is a manifest quirk, not an inactive
  gate — confirmed empirically, not from the manifest.

## Standing invariants (must hold every phase)

- A user in org A can never read or write any row of org B.
- A `member` never sees non-published posts, non-confirmed events, or PII columns.
- `profiles.role` is written only by security-definer flows; never client-settable.
- No public surface beyond the `routes.ts` allowlist.
- No server secret in the client bundle (`npm run check:secrets` enforces this).
- `npm run verify` (typecheck + lint + build + secret scan) is green before push.

## Known deferrals

- **CSP is report-only.** It does not block yet; promote to enforcing with a
  script nonce once the Supabase/font inventory is finalized.
- **Rate limiting** on `/join` and magic-link requests relies on Supabase
  built-ins for now; an app-level token bucket is a Phase 2+ hardening item.
- **`npm audit`** flags a transitive `postcss` advisory inside Next.js's own
  tree; the "fix" downgrades Next to 9.x and is intentionally not applied (see
  README).
