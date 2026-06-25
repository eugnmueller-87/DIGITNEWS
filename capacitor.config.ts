import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config — the native shell for the Android (and later iOS) app.
 *
 * REMOTE-URL MODE (server.url): this app is SERVER-RENDERED (Next.js middleware,
 * server actions, the four auth layers, RLS). It CANNOT be exported to static
 * files inside the APK without stripping the server — so the native shell is a
 * thin WebView that loads the LIVE deployment. App/content changes ship via the
 * normal Vercel deploy; only changes to the native shell (plugins, icons,
 * permissions) need a new store build. See docs/CAPACITOR.md.
 *
 * appId is PERMANENT once published to Play — do not change it.
 */
const config: CapacitorConfig = {
  appId: "app.aushang",
  appName: "Aushang",
  // webDir is required by the CLI even in remote-URL mode; it points at a tiny
  // local fallback shell (public/cap-shell) used only if the live URL can't load.
  webDir: "public/cap-shell",
  server: {
    // The live production app. The WebView loads this; everything renders
    // server-side exactly as on the web.
    url: "https://kita-connect.cloud",
    // Only allow our own origin to be treated as the app (no arbitrary nav).
    allowNavigation: ["kita-connect.cloud"],
  },
  android: {
    // Mark the native WebView's User-Agent so the SAME web code can detect "this
    // is the native app" (window.Capacitor is NOT injected on remote-URL pages,
    // so the UA string is the only reliable signal). The app uses this to SKIP
    // the service worker entirely — a native shell over a live site needs no SW,
    // and a cached redirect in the SW was looping the WebView. Web users are
    // unaffected (their UA has no marker, so they keep the SW). Changing this is
    // a native-shell change → requires `cap sync` + a new AAB.
    appendUserAgent: "AushangApp",
  },
};

export default config;
