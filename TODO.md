# TODO — what's next

The single, prioritized list of what's left. Detailed specs live in `docs/`; this
is the index. Updated 2026-06-15.

Status: `[ ]` todo · `[x]` done · `[~]` in progress.

---

## ✅ Just done (this work)

- [x] Reflection originals **deleted at publish** + clear-photo lockout (migration
      `0023` — **applied to production**).
- [x] AI cover images built (FLUX text-to-image) — **dormant** until the worker +
      an EU image endpoint are configured (`docs/COVER_IMAGES_SPEC.md`).
- [x] `/datenschutz` + README AI-residency claim corrected to be truthful.
- [x] Native **Android** app (Capacitor): remote-URL shell, brand icons, **native
      camera**, cloud AAB build workflow (`docs/CAPACITOR.md`).

---

## 🔜 Next steps — do these in order

### 1. Android build ← DONE

- [x] Cloud AAB build works (`.github/workflows/android.yml`); a green run
      produces `app-debug.apk` + the AABs as artifacts. Re-runnable any time via
      **Run workflow** on `main`.
- [ ] Native-camera device test rolls into the **closed test** (step 3) — the 12
      testers are the device fleet. No personal Android needed to ship. (If an
      Android turns up, do a 30-sec camera sanity-check then.)

### 2. Verify the reflection-delete works on prod (5 min, no code)

- [ ] Publish a **test reflection** on `kita-connect.cloud` and confirm its
      original disappears from the `raw-photos` bucket. Real proof the 0023 chain
      works against the live app + DB.

### 3. Open the Google Play account — the launch long-pole

The 14-day / 12-tester closed test cannot be compressed, so start it early.
Process: `docs/PLAY_LAUNCH.md`. **Paste-ready listing copy, Data Safety answers,
reviewer demo-account plan, and screenshot shot-list: `docs/PLAY_LISTING.md`.**

- [ ] Create the Play Developer account ($25) + identity verification.
- [ ] Recruit **≥12 testers** with real Google accounts (pilot-Kita staff/parents).
- [ ] Decide account type (personal = faster; org = needs D-U-N-S).
- [ ] Set up the **reviewer demo org + member login** (`docs/PLAY_LISTING.md §3`)
      — required because the app is invite-only.

### 4. Sign + ship the AAB to Play

- [ ] Create an upload keystore; add the four `ANDROID_*` repo secrets (see
      `.github/workflows/android.yml` header) → the workflow then builds a signed
      release AAB.
- [ ] Upload to a **closed testing** track; run the 14-day test; then promote to
      production.
- [ ] Create a **demo org + member login** and put it in the review notes
      (invite-only app → reviewers must be able to log in). `docs/PLAY_LAUNCH.md §4`.
- [ ] Listing assets: icon 512², feature graphic 1024×500, screenshots, German
      descriptions. Data Safety answers are pre-written in `docs/STORE_PRIVACY.md`.

---

## 🛠 Native follow-ups (after the first AAB) — `docs/NATIVE_TODO.md`

- [ ] **Deep links / `assetlinks.json`** — make invite + set-password links open
      the app, not the system browser. (Recommended next code task.)
- [ ] **Native push** (APNs/FCM) — current push is Web Push/VAPID; native needs a
      token path (`device_tokens`) + dual fan-out in `push.ts`.
- [ ] **iOS phase** — `npx cap add ios` (same project), needs a Mac + Apple
      Developer account ($99/yr) + `apple-app-site-association`. Apple privacy
      label already written (`docs/STORE_PRIVACY.md §3`).

---

## 🌍 Production decisions (separate "going-live" topic, not blocking the build)

- [ ] **Move the structure-extraction LLM into the EU.** The redacted-text call
      currently goes to Anthropic (US); `/datenschutz` honestly says "moving it
      in". Options: Mistral EU, or Claude via Bedrock/Vertex EU. (Note: your
      Anthropic Max subscription is for _building_ — it's unrelated to this
      runtime call.)
- [ ] **AI cost model** for production: vendor-owned key + per-org metering + cap,
      priced into the subscription (industry default). BYOK only as an optional
      escape hatch. Needed before the cover feature (images are ~3–10× the text
      cost) and before many orgs onboard.
- [ ] **Wire the AI cover feature** once an EU image endpoint is chosen: set
      `IMAGE_API_URL`/`IMAGE_API_KEY` on the worker; decide cover-vs-photo display
      in the member feed (`photo.ts`). `docs/COVER_IMAGES_SPEC.md`.

---

## 🧹 Smaller housekeeping (non-blocking)

- [ ] Worker behind HTTPS (Caddy/Traefik on a `worker.` subdomain).
- [ ] Regenerate `src/lib/database.types.ts` from the live schema (currently a
      hand-authored stub) — now that prod has `0023`.
- [ ] Finalize the privacy policy legally + add an **Impressum** (German legal
      requirement) and the signed **AVV/DPA** for org customers.
