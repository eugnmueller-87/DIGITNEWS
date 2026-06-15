# Capacitor — the native app shell (Android first)

This wraps the live web app in a native shell so it can ship to the stores.
Android is set up now; iOS is added later from the **same** project
(`npx cap add ios`, needs a Mac) — that's why we chose Capacitor over a TWA.

## How it works: REMOTE-URL mode (important)

This app is **server-rendered** (Next.js middleware `proxy.ts`, server actions,
the four auth layers, RLS). It **cannot** be exported to static files inside the
APK without stripping the server — so the native shell is a thin WebView that
loads the **live deployment**:

```
capacitor.config.ts → server.url = https://kita-connect.cloud
```

Consequences:

- **App/content changes ship via the normal Vercel deploy** — no new store build
  needed. You only rebuild + resubmit the app for **native-shell** changes
  (plugins, icons, permissions, the appId).
- The app **needs connectivity** to load. `public/cap-shell/index.html` is a tiny
  fallback shown only when the live URL can't be reached at launch.
- For **Google Play** this is fine. (For the eventual iOS app, native camera/push
  is what lifts it above Apple's 4.2 "just a website" bar — see the iOS phase.)

## Permanent identifiers (do not change after publishing)

- **applicationId / namespace:** `app.aushang` (in `android/app/build.gradle`).
  This is permanent once published to Play.
- **appName:** `Aushang` (`capacitor.config.ts` + `android/.../strings.xml`).

## Plugins installed (registered, wired incrementally)

`@capacitor/app` (deep links), `@capacitor/camera` (native capture — the
capture-flow upgrade), `@capacitor/push-notifications` (native push later).
They're installed and registered but **not yet invoked**, so their permissions
(`CAMERA`, `POST_NOTIFICATIONS`) are intentionally **not** in the manifest yet —
Play flags unused sensitive permissions. Declare them when the plugin is actually
used.

## Build workflow

```bash
npm run cap:sync     # cap sync android — copy config + plugins into android/
npm run cap:open     # open the project in Android Studio
```

To produce a release **AAB** (what Play requires):

1. Open in Android Studio (`npm run cap:open`).
2. Build → Generate Signed Bundle / APK → **Android App Bundle**.
3. Create/keep an **upload keystore** (back it up — losing it is painful) and
   enroll in **Play App Signing** (Google holds the app key; you keep the upload
   key).
4. The resulting `.aab` uploads to the Play Console (closed-testing track first —
   see `docs/PLAY_LAUNCH.md` §0 for the 14-day / 12-tester requirement).

> Building the AAB needs the Android SDK + Android Studio (works on Windows). No
> Mac is needed for Android — only for the later iOS phase.

## What's NOT done yet (incremental follow-ups)

- **Native camera** wiring (swap the web `<input capture>` for `@capacitor/camera`
  in the capture flow). The single biggest UX upgrade and the iOS-review unlocker.
- **Native push** (APNs/FCM) — the current push is Web Push/VAPID
  (`src/lib/push.ts`); native needs FCM token plumbing + a `device_tokens` path.
- **Deep links / App Links** — host `/.well-known/assetlinks.json` so links open
  the app, not the system browser (fixes the magic-link issue in
  `GO_LIVE_CHECKLIST.md`). Needs the signing-cert SHA-256 (available after the
  keystore exists).
- **App icons / splash** from `public/icons/master.svg`.

These are deliberately staged: the remote-URL shell is a working, submittable
Android app on its own; each native capability is added and tested in isolation.
