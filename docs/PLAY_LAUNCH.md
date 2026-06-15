# Google Play launch checklist — Aushang (Android first)

**Strategy: ship Android first, then scale to iOS.** Android is the cheaper
account ($25 once vs $99/yr), builds on Windows (no Mac needed), and Play review
is far more forgiving than Apple's "is this a real app" scrutiny. Get the launch
muscle memory on Play, then do iOS.

> Status legend: `[ ]` todo · `[x]` done · `[~]` partly done.
> Most of the **compliance** work is already done in the codebase (privacy page,
> Data Safety answers, account deletion). What's left is mostly **accounts,
> assets, and waiting periods** — see §0, which sets the earliest possible date.

---

## 0. Critical path — start these TODAY (they have unavoidable lead times)

Nothing you build shortens these. Open them in parallel with all code work.

- [ ] **Create the Google Play Developer account** — $25, one-time.
      Decide account type:
  - **Personal** — faster, your name is the seller. ← recommended to start.
  - **Organization** — company name shows, but needs a **D-U-N-S number** +
    verification (can take 1–2 weeks).
- [ ] **Identity verification** for the account (Google now requires it; can take
      a few days). Have ID ready.
- [ ] **Recruit ≥12 testers** with real Google accounts. ⚠️ **This is the
      gating item.** New personal accounts must run a **closed test with ≥12
      testers, opted in, for ≥14 continuous days** before production publishing
      is unlocked. The 14 days run on a wall clock — they cannot be compressed.
      List the 12 people now (staff/parents from the pilot Kita are ideal).

> **Earliest launch ≈ today + (account verification) + 14 days closed test +
> review.** Plan ~3 weeks minimum even if every build is perfect.

---

## 1. The app artifact (the build) — DEFERRED, decided separately

Wrapper choice (Capacitor vs Bubblewrap TWA) is **not yet decided** — see the
launch conversation. Both produce a signed **AAB** (Android App Bundle), which is
what Play requires. Whichever we pick:

- [ ] Produce a signed **AAB** (not an APK) for upload.
- [ ] Enroll in **Play App Signing** (Google holds the app signing key; you keep
      an upload key — back it up, losing it is painful).
- [ ] Target the **minimum Android API level Play currently enforces** (rises
      yearly — check the console at build time).
- [ ] Host **`/.well-known/assetlinks.json`** at
      `https://kita-connect.cloud/.well-known/assetlinks.json`.
      ⚠️ **Does not exist yet** — no `public/.well-known/` dir in the repo. - **Required** for a TWA (Digital Asset Links verification, or the app
      shows a browser address bar). - Needed for Android **deep links** either way (fixes the magic-link →
      external-browser issue noted in `GO_LIVE_CHECKLIST.md`). - Contains the app's package name + signing-cert SHA-256 fingerprint
      (you get the fingerprint after step 1's signing setup).

---

## 2. Store listing assets (you create these — often the slowest creative part)

- [ ] **App name** (Play allows up to 30 chars) — e.g. "Aushang".
- [ ] **Short description** — max 80 chars (German).
- [ ] **Full description** — up to 4000 chars (German).
- [ ] **App icon** — 512×512 PNG (32-bit, with alpha). Derive from
      `public/icons/master.svg`.
- [ ] **Feature graphic** — 1024×500 PNG/JPG (shown atop the listing).
- [ ] **Phone screenshots** — min 2, max 8 (recommend the feed, capture,
      calendar, review screens).
- [ ] **Tablet screenshots** — optional but recommended (better placement).
- [ ] **App category** — "Productivity" or "Education" (manifest already tags
      both: see `src/app/manifest.ts`).
- [ ] **Contact email** — `hallo@kita-connect.cloud` (`brand.supportEmail`).
- [ ] **Privacy policy URL** — `https://kita-connect.cloud/datenschutz`.
      ✅ Page is live & public (`src/app/datenschutz/page.tsx`, allowlisted in
      `src/lib/routes.ts` as `LEGAL_PATHS.privacy`).

---

## 3. Compliance forms (mostly already answered — see `docs/STORE_PRIVACY.md`)

- [x] **Privacy policy** — `/datenschutz` live and public.
- [x] **Data Safety form answers** — fully drafted in
      `docs/STORE_PRIVACY.md §4`. Transcribe into the console:
  - Collects data: **yes**. Shares with third parties: **no** (sub-processors
    are processors, not independent recipients).
  - Encrypted in transit: **yes** (HTTPS/TLS, HSTS).
  - Users can request deletion: **yes** (in-app + `/datenschutz` contact).
  - Personal info (email, name): collected, app functionality, Supabase EU.
  - Photos: collected, app functionality; raw image stays in our infra.
  - App activity / location / contacts / financial: **not collected**.
- [x] **In-app account deletion** — implemented for every role
      (`einstellungen/delete-account-panel.tsx` → `delete_own_account` RPC).
      Reference: `docs/STORE_PRIVACY.md §6`.
- [ ] **Declare the deletion method in the Data Safety form** — point to the
      in-app path; a public web deletion URL is optional but Google likes one.
- [ ] **Content rating** — complete the IARC questionnaire (expect "Everyone").
- [ ] **Target audience & content** — ⚠️ **declare the audience as ADULTS**
      (parents/staff). The app is _used by_ Kitas but the _users are adults_;
      do **not** declare it child-directed, or you trigger Families Policy
      obligations (it processes no children's data — see `/datenschutz` copy).
- [ ] **Ads** — declare **"No ads"** (app runs none; no analytics/tracking SDKs,
      `poweredByHeader` off — see `next.config.ts`).
- [ ] **Government / financial / health app** declarations — all **N/A**.
- [ ] **News app** declaration — **N/A** (despite the repo name, this is not a
      news/RSS reader; it's an org-internal board — say so if asked).

---

## 4. Reviewer access — the invite-only trap ⚠️

The app has **no public signup** (deny-by-default, invite-only — see
`src/lib/routes.ts`). A Play reviewer who can't log in will reject the app.

- [ ] **Create a seeded demo org** with realistic published content (use the
      capture→publish pipeline, or seed via `supabase/fixtures/`).
- [ ] **Create a demo member account** (email + password) inside it.
- [ ] **Put the demo credentials + a one-line "how to log in" note** in the
      Play Console testing instructions / review notes. Do the same for the
      eventual closed-test track so your 12 testers can get in.

---

## 5. Submit → test → release sequence

- [ ] Upload the signed **AAB** to a **closed testing** track.
- [ ] Add the 12+ testers (email list or Google Group), send them the opt-in URL.
- [ ] **Run the closed test ≥14 continuous days** (§0). Testers must actually
      install and stay opted in.
- [ ] Fill in the full store listing (§2), Data Safety (§3), content rating (§3).
- [ ] After 14 days, **promote to Production** and submit for review.
- [ ] Production review is typically a few days; first submissions and
      privacy-adjacent apps can bounce once — keep the demo account fresh.

---

## What's already done vs. blocking

**Done (in the codebase):** public privacy page, Data Safety answers, in-app
account deletion, no-ads / no-tracking posture, German UI, live production URL,
PWA manifest with categories + icons to derive store assets from.

**Blocking, not started:** Play account ($25) + verification, the 14-day /
12-tester closed test, the app wrapper + signed AAB, `assetlinks.json`, store
listing assets (icon 512², feature graphic, screenshots), demo org + reviewer
credentials.

**Highest-leverage action today:** open the Play account and line up the 12
testers — the 14-day closed test is the longest pole and starts the clock.

---

## Then: scaling to iOS

iOS reuses most of this doc (listing copy, screenshots at Apple sizes, the
already-written Apple "Nutrition Label" in `docs/STORE_PRIVACY.md §3`, the same
demo account). The new requirements iOS adds: Apple Developer account ($99/yr,
slower enrollment), a **Mac or cloud-Mac** for Xcode builds, native camera/push
(APNs) if we go Capacitor, and an `apple-app-site-association` file. Track that
in a separate `docs/IOS_LAUNCH.md` when we get there.
