# Native app — remaining work (Capacitor)

The Android shell is scaffolded, branded, and builds in the cloud
(`.github/workflows/android.yml` → produces an AAB artifact). What's below is the
remaining native work, in rough priority order. Each item is independent and
testable on its own; none blocks producing a first (debug) AAB.

See `docs/CAPACITOR.md` for how the shell works (remote-URL mode) and
`docs/PLAY_LAUNCH.md` for the store-submission checklist.

## 1. Build + verify the first AAB (no code) — DO THIS FIRST

- [ ] Run the **Android build** workflow (Actions tab → "Android build" → Run
      workflow). Downloads an `app-debug.aab` artifact — proof the project builds.
- [ ] (For a Play-ready bundle) create an upload keystore and add the four
      `ANDROID_*` repo secrets (see the header of `android.yml`); re-run to get a
      signed `app-release.aab`.

## 2. Native camera (highest-value code change)

Swap the web `<input capture>` in the capture flow for `@capacitor/camera`
(installed, not yet invoked). This is the biggest UX upgrade AND what lifts the
eventual iOS app above Apple's "just a website" bar.

- [ ] In the capture flow (`src/app/(app)/aufnahme/use-capture.ts` /
      `capture-panel.tsx`), detect native (Capacitor) and use `Camera.getPhoto`
      there; keep the web `<input>` path as the browser fallback.
- [ ] Add `CAMERA` to `AndroidManifest.xml` ONLY once the plugin is actually
      used (Play flags unused sensitive permissions).
- [ ] Add the iOS usage strings later (already drafted in
      `docs/STORE_PRIVACY.md §5`).
- [ ] The compressed image still uploads to `raw-photos` exactly as today — the
      privacy pipeline is unchanged; only the capture source differs.

## 3. Deep links / Android App Links

Make invite + set-password links open the APP, not the system browser (fixes the
known issue in `GO_LIVE_CHECKLIST.md`).

- [ ] Host `/.well-known/assetlinks.json` at the live domain (needs the app's
      signing-cert SHA-256 — available after the keystore exists).
- [ ] Configure intent filters + `@capacitor/app` `appUrlOpen` handling to route
      `/auth/callback` and `/set-password` into the WebView.

## 4. Native push (APNs/FCM)

Current push is Web Push/VAPID (`src/lib/push.ts`), which works for the installed
PWA but not a native iOS app. Native needs FCM (Android) / APNs (iOS).

- [ ] Add an FCM/APNs token path: a `device_tokens` table (or a `kind` column on
      `push_subscriptions`) since native gives a token, not a web-push endpoint.
- [ ] `pushToOrg` fans out to BOTH web-push subs and native tokens.
- [ ] `@capacitor/push-notifications` register + permission flow; add
      `POST_NOTIFICATIONS` to the manifest when wired.
- [ ] FCM project + `google-services.json`; APNs key for the iOS phase.

## 5. iOS phase (later, needs a Mac or cloud-Mac)

- [ ] `npx cap add ios` (same project), `apple-app-site-association`, the camera
      usage strings, APNs. Apple Developer account ($99/yr). See
      `docs/STORE_PRIVACY.md` for the already-written Apple privacy label.

## Standing reminders (not native, but gate the launch)

- [ ] **Apply migration `0023`** in the Supabase SQL editor — reflections can't
      publish on prod until then (`docs/PLAY_LAUNCH.md`).
- [ ] **Google Play account + the 14-day / 12-tester closed test** — the launch
      long-pole; start it early (`docs/PLAY_LAUNCH.md §0`).
- [ ] Cover-image feature + the runtime-AI-EU decision remain separate,
      post-launch topics (`docs/COVER_IMAGES_SPEC.md`).
