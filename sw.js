/* BoredPuP service worker - offline shell + runtime caching.
   Scope: the directory containing this file (repo root).

   Caching strategy by request type:
     - HTML navigations : network-first, fall back to cache, then to 404.html
     - /data/*.json      : stale-while-revalidate into a single DATA cache
     - other same-origin : cache-first with background revalidation

   Note: data/catalog.json and the detail shards are deliberately NOT precached.
   They change every night; precaching them into a versioned cache is what used
   to pin returning visitors to a snapshot taken at install time. They are now
   cached on first use in DATA and refreshed in the background on every hit. */

const VERSION = "v6";
const CACHE = `boredpup-static-${VERSION}`;
const DATA = `boredpup-data-${VERSION}`;
const RUNTIME = `boredpup-runtime-${VERSION}`;

const CACHES = [CACHE, DATA, RUNTIME];

const PRECACHE = [
  "./",
  "./index.html",
  "./category.html",
  "./mobile.html",
  "./game.html",
  "./search.html",
  "./my-games.html",
  "./developers.html",
  "./tools.html",
  "./404.html",
  "./pages/about.html",
  "./pages/contact.html",
  "./pages/parents.html",
  "./pages/privacy.html",
  "./pages/terms.html",
  "./css/style.css",
  "./js/app.js",
  "./js/data.js",
  "./js/shard.js",
  "./js/embed.js",
  "./js/categories.js",
  "./js/home.js",
  "./js/category.js",
  "./js/mobile.js",
  "./js/search.js",
  "./js/game.js",
  "./js/tools.js",
  "./js/mygames.js",
  "./js/pages.js",
  "./js/notfound.js",
  "./js/contact.js",
  "./js/walkthrough.js",
  "./walkthrough.html",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./assets/logo.svg",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/og-image.png",
];

// Detail shards are large; keep the DATA cache from growing without bound.
const DATA_MAX_ENTRIES = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Individually, so one missing file cannot abort the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !CACHES.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.headers.has("range")) return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(handleNavigate(req));
    return;
  }

  if (isDataRequest(url)) {
    event.respondWith(staleWhileRevalidate(req, DATA));
    return;
  }

  event.respondWith(cacheFirst(req));
});

function isDataRequest(url) {
  return url.pathname.includes("/data/") && url.pathname.endsWith(".json");
}

async function handleNavigate(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      putIn(CACHE, req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req, { cacheName: CACHE });
    if (cached) return cached;

    // A prerendered game page (g/<id>.html) has no cached copy of its own
    // offline - 5,621 of them are not precached. game.js reads the id out of the
    // path, so the cached shell hydrates the same game. Its <base href="../">
    // is not present in the shell, so the relative asset URLs resolve from the
    // root, which is where they live.
    const path = new URL(req.url).pathname;
    if (/\/g\/[^/]+\.html$/.test(path)) {
      const shell = await caches.match("./game.html", { cacheName: CACHE });
      if (shell) return shell;
    }

    const fallback =
      (await caches.match("./404.html", { cacheName: CACHE })) ||
      (await caches.match("./index.html", { cacheName: CACHE }));
    return (
      fallback ||
      new Response("<h1>Offline</h1>", { headers: { "Content-Type": "text/html" } })
    );
  }
}

/* Serves the cached copy immediately, then writes the fresh copy into the SAME
   cache it was read from. Reading and writing the same cache is what guarantees
   the next visit sees the refreshed payload. */
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) {
        cache.put(req, res.clone()).then(() => trimCache(cacheName, DATA_MAX_ENTRIES));
      }
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function cacheFirst(req) {
  const cached = await caches.match(req, { cacheName: CACHE });
  if (cached) {
    caches
      .open(CACHE)
      .then((c) => fetch(req))
      .then((res) => {
        if (res && res.ok) return c.put(req, res);
      })
      .catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      putIn(CACHE, req, res.clone());
    }
    return res;
  } catch {
    return Response.error();
  }
}

function putIn(cacheName, req, res) {
  caches
    .open(cacheName)
    .then((c) => c.put(req, res))
    .catch(() => {});
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  // Cache.keys() yields insertion order, so the oldest entries come first.
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}
