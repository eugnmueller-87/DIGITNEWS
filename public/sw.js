/* Aushang service worker — offline shell + stale-while-revalidate for GETs.
 * Intentionally conservative: never caches API/auth responses, only same-origin
 * navigations and static assets. Auth-gated pages still hit the network first so
 * a logged-out user never sees stale private content from the cache. */

const CACHE = "aushang-v1";
const SHELL = ["/feed", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API, auth, or worker callbacks — always network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // Navigations: network-first (so private content is fresh), fall back to the
  // cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(request, copy))
            .catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match("/offline")),
        ),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(request, copy))
            .catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

/* Web Push: show a notification when the app pushes one (Phase 4d). */
self.addEventListener("push", (event) => {
  let data = { title: "Aushang", body: "Es gibt etwas Neues." };
  try {
    if (event.data) data = event.data.json();
  } catch {
    /* keep default */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/feed" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || "/feed";
  event.waitUntil(self.clients.openWindow(target));
});
