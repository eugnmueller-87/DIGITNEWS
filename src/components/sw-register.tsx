"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount (client-only, best-effort).
 *
 * EXCEPTION — the native Android app (Capacitor) must NOT run a service worker:
 * it's a thin WebView over the live site (needs no offline/PWA/push from the SW),
 * and a cached redirect in the SW looped the WebView (ERR_TOO_MANY_REDIRECTS).
 * The native shell marks its User-Agent with "AushangApp" (capacitor.config.ts);
 * when we see that marker we (1) never register the SW and (2) actively
 * unregister any SW already installed + drop its caches, so existing app installs
 * self-heal. Web users have no marker → unchanged (they keep the SW).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const isNativeApp = navigator.userAgent.includes("AushangApp");
    if (isNativeApp) {
      // Self-heal: tear down any SW + caches a prior app version installed.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => keys.forEach((k) => void caches.delete(k)))
          .catch(() => {});
      }
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW registration is best-effort; the app works without it */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
