/* BoredPuP service worker - offline shell + runtime caching.
   Scope: the directory containing this file (repo root). */

const CACHE = "boredpup-static-v3";
const RUNTIME = "boredpup-runtime-v3";
const PRECACHE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/data.js",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./assets/logo.svg",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./data/catalog.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            cachePut(CACHE, req, copy);
          }
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (url.pathname.includes("/data/") || url.pathname.endsWith(".json")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            cachePut(RUNTIME, req, copy);
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

function cachePut(cacheName, req, res) {
  caches.open(cacheName).then((c) => c.put(req, res)).catch(() => {});
}

function cacheFirst(req) {
  return caches.match(req).then((cached) => {
    if (cached) {
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            cachePut(RUNTIME, req, copy);
          }
        })
        .catch(() => {});
      return cached;
    }
    return fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          cachePut(RUNTIME, req, copy);
        }
        return res;
      })
      .catch(() => cached);
  });
}