const CACHE="prestamo-ya-v6";
const CORE=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./backup.js",
  "./firebase-config.js",
  "./firebase-cloud.js",
  "./firebase-cloud-core.js",
  "./cloud-repair-v2.js",
  "./ownership-model.js",
  "./session-switch.js",
  "./data-integrity.js",
  "./field-collection-sync.js",
  "./credit-proposal.js",
  "./payment-schedule-fix.js",
  "./history-detail.js",
  "./credit-rules-v3.js",
  "./credit-renewal-v3.js",
  "./renewal-balance-field.js",
  "./cloud-ui-fixes.js",
  "./credit-workflow-v4.js",
  "./credit-share-v2.js",
  "./sync-ui-fix.js",
  "./renewal-buttons-fix.js",
  "./renewal-final-fix.js",
  "./renewal-form-v2.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML siempre se valida contra red primero.
  if (url.pathname.endsWith("/index.html") || url.pathname.endsWith("/")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  // JavaScript: red primero para evitar que una versión rota quede atrapada en caché.
  if (url.pathname.endsWith(".js")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
