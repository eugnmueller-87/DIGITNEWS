# Go-live checklist — Aushang on kita-connect.cloud

**Setup:** domain registered at **Hostinger** · app runs on **Vercel** (free) ·
DB/auth on **Supabase** · email via **Resend**. The bare domain
`https://kita-connect.cloud` is the production URL.

> Status legend: `[ ]` todo · `[x]` done. The code change (brand.productionHost
> = kita-connect.cloud) is already committed on the `pwa-capture-flow` branch
> (PR #12). Everything below is dashboard/DNS config I can't do for you.

---

## 1. Vercel — connect & add domain

- [ ] Confirm the Vercel project is connected to the GitHub repo
      `eugnmueller-87/DIGITNEWS` and deploys from `main`
      (Vercel → Settings → Git). If not, "Import Project" from GitHub once.
- [ ] Vercel → project → Settings → **Domains → Add** → `kita-connect.cloud`.
- [ ] Add `www.kita-connect.cloud` too (Vercel sets it to redirect to bare).
- [ ] Note the **exact A-record value Vercel shows** for the apex domain
      (usually `76.76.21.21`, but TRUST the dashboard value).

## 2. Hostinger DNS — point the domain at Vercel

- [ ] **Edit** `A  @  → 2.57.91.91` → change content to the IP from step 1
      (keep name `@`).
- [ ] **Add** `CNAME  www  → cname.vercel-dns.com` (or the value Vercel shows).
- [ ] **Leave alone:** `resend._domainkey`, `MX send`, the `app` CNAME, and the
      Hostinger mail records (`@` MX, `@` SPF, `autoconfig`).

## 3. Vercel — environment variables (Production)

- [ ] `NEXT_PUBLIC_SITE_URL` = `https://kita-connect.cloud`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = (Supabase project URL)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (anon key)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = (service-role key — server-only)
- [ ] `SUPERADMIN_EMAILS` = `eugnmueller@googlemail.com` (so first login = operator)
- [ ] `RESEND_API_KEY` = (Resend key)
- [ ] `EMAIL_FROM` = `Aushang <hallo@kita-connect.cloud>`
- [ ] (optional, push) `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
      `VAPID_SUBJECT=mailto:hallo@kita-connect.cloud`

## 4. Supabase — auth URLs (the magic-link gotcha)

- [ ] Authentication → URL Configuration → **Site URL** =
      `https://kita-connect.cloud`
- [ ] Add to **Redirect Allow List**: `https://kita-connect.cloud/auth/callback`
      (exact match)
- [ ] Authentication → Email Templates → **Magic Link** link is:
      `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink`
      (NOT the default `{{ .ConfirmationURL }}`)
- [ ] Authentication → Providers → Email: password auth **off**, magic link **on**
- [ ] Authentication → Settings: "Allow new users to sign up" = **OFF**

## 5. Supabase — migrations applied (if not already)

- [ ] All migrations in `supabase/migrations/` applied in order (0001 → 0015).
- [ ] Confirm with the two-org fixture that cross-org reads return zero rows.

## 6. Deploy & verify

- [ ] Merge **PR #12** to `main` → Vercel auto-deploys.
- [ ] Wait for DNS propagation (minutes–hours); Vercel issues HTTPS automatically.
- [ ] Open `https://kita-connect.cloud` → redirects to `/login`.
- [ ] Request a magic link → lands on `/feed` and elevates you to operator.

## 7. Smoke test on a real phone (PWA — PR #12 work)

- [ ] Install to home screen (iOS Safari + Android Chrome); icon = sun mark, not cropped.
- [ ] App shell clears the notch (top) and home indicator (bottom) in standalone.
- [ ] Bottom nav reachable by thumb; hidden on desktop.
- [ ] Capture: "Foto aufnehmen" opens camera; "Aus Galerie wählen" opens album/files.
- [ ] Slow network shows skeletons, not a blank screen.
- [ ] Einstellungen → "Konto löschen" completes for a member.

---

## Open follow-ups (not blocking launch)

- [ ] Merge **PR #11** (test harness) — disjoint from #12, no conflict.
- [ ] Deploy the **OCR/redaction worker** (needs a VPS — Hostinger VPS or other).
      Until then, captures upload but stay `processing` (no worker to run).
      Then set `WORKER_URL` + `WORKER_SHARED_SECRET` in Vercel.
- [ ] Verify Resend domain is still valid for `kita-connect.cloud` (DKIM/SPF
      records are present in DNS).
- [ ] Update `docs/STORE_PRIVACY.md` support email if it still says aushang.app.
- [ ] Known iOS limitation: magic link may open Safari instead of the installed
      PWA. Robust fix (Universal Links) needs the native phase.
