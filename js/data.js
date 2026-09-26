/* BoredPuP - data layer.
   Loads the slim GameMonetize catalog (data/catalog.json) and on-demand
   detail shards (data/details-<n>.json). Falls back to the live
   GameMonetize feed whenever the snapshot is missing.

   Catalog rows:  [id, title, category, tags, thumb]
   Detail entry:  { description, instructions, url, width, height }  */

import { shardOf } from "./shard.js";

export const FEED_URL =
  "https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=html5&popularity=newest&company=All&amount=All";

const LOCAL_KEY = "boredpup:catalog:v3";
export const RECENT_KEY = "boredpup:recent:v1";
export const FAVS_KEY = "boredpup:favs:v1";
const DETAILS_CACHE_MAX = 200;
const CATALOG_MAX_AGE = 6 * 60 * 60 * 1000;

let liveFull = [];
let liveById = new Map();

/* Two indexes over the catalog rows, built once per array identity.

   getGame() was a linear scan over 5,621 rows on every play page, and
   searchGames() rebuilt a lowercased haystack for all 5,621 rows on every
   keystroke. Both are now a Map lookup and a precomputed string. */
const indexCache = new WeakMap();

function indexesFor(games) {
  let ix = indexCache.get(games);
  if (!ix) {
    const byId = new Map();
    const hay = new Array(games.length);
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      byId.set(g[0], g);
      hay[i] = (g[1] + " " + g[2] + " " + (g[3] || []).join(" ")).toLowerCase();
    }
    ix = { byId, hay };
    indexCache.set(games, ix);
  }
  return ix;
}

function decodeEntities(str) {
  return String(str ?? "")
    .replace(/&amp;mdash;/gi, "-")
    .replace(/&mdash;/gi, "-")
    .replace(/&amp;ndash;/gi, "–")
    .replace(/&ndash;/gi, "–")
    .replace(/&amp;amp;/gi, "&")
    .replace(/&amp;quot;/gi, '"')
    .replace(/&amp;apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/g, "&")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchJson(url, { cache = "default" } = {}) {
  const res = await fetch(url, { cache });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

let catalogPromise = null;
let detailsCache = {};

function cacheDetails(id, value) {
  const keys = Object.keys(detailsCache);
  if (keys.length >= DETAILS_CACHE_MAX) {
    delete detailsCache[keys[0]];
  }
  detailsCache[id] = value;
}

function normalizeLiveGame(g) {
  return [
    String(g.id ?? ""),
    decodeEntities(g.title) || "Untitled Game",
    decodeEntities(g.category) || "Arcade",
    (g.tags ? decodeEntities(g.tags).split(",").map((t) => t.trim()).filter(Boolean) : []),
    String(g.thumb ?? "").trim(),
  ];
}

function normalizeLiveFull(g) {
  return {
    id: String(g.id ?? ""),
    description: decodeEntities(g.description) || "",
    instructions: g.instructions ? decodeEntities(g.instructions) : "",
    url: String(g.url ?? "").trim(),
    width: parseInt(g.width, 10) || 800,
    height: parseInt(g.height, 10) || 600,
  };
}

async function loadLiveSnapshot() {
  const games = await fetchJson(FEED_URL, { cache: "no-store" });
  if (!Array.isArray(games)) throw new Error("Unexpected live feed shape");
  liveFull = games.map(normalizeLiveFull);
  liveById = new Map(liveFull.map((g) => [g.id, g]));
  return games.filter((g) => String(g.id ?? "")).map(normalizeLiveGame);
}

/* A localStorage entry can be anything: a half-written value, a payload from
   an older build, or a hand-edited "{}". The old code trusted parsed.meta and
   parsed.games blindly, so a valid-JSON-but-wrong-shape cache was served
   straight through and every consumer then dereferenced null. */
function isUsableSnapshot(parsed) {
  return (
    parsed !== null &&
    typeof parsed === "object" &&
    Array.isArray(parsed.games) &&
    parsed.games.length > 0 &&
    parsed.meta !== null &&
    typeof parsed.meta === "object"
  );
}

/* Age of the cached snapshot, measured from when the nightly build produced
   it rather than when this browser happened to write the copy.

   The old check used the local write time, and the write happened on every
   revalidation. So a stale catalog.json - from a failed nightly run, a stale
   CDN edge, or an old offline bundle - got its clock reset to "now" on each
   visit and stayed "fresh" for another six hours, indefinitely. meta.generated
   is the only timestamp that actually describes the data. */
function snapshotAgeMs(parsed) {
  const generated = Date.parse((parsed.meta && parsed.meta.generated) || "");
  if (Number.isFinite(generated)) return Date.now() - generated;
  const ts = Number(parsed.ts) || 0;
  return ts ? Date.now() - ts : Infinity;
}

export async function getCatalog() {
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    try {
      const local = localStorage.getItem(LOCAL_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (isUsableSnapshot(parsed)) {
          const fresh = snapshotAgeMs(parsed) < CATALOG_MAX_AGE;
          if (fresh || navigator.onLine === false) {
            return { meta: parsed.meta, games: parsed.games, source: "cache" };
          }
        }
      }
    } catch {
      /* corrupted cache, refetch */
    }

    try {
      const data = await fetchJson("data/catalog.json");
      try {
        localStorage.setItem(
          LOCAL_KEY,
          JSON.stringify({ ts: Date.now(), meta: data.meta, games: data.games })
        );
      } catch {
        /* quota exceeded, ignore */
      }
      return { ...data, source: "snapshot" };
    } catch {
      const games = await loadLiveSnapshot();
      const meta = {
        count: games.length,
        categories: [],
        generated: new Date().toISOString(),
      };
      return { meta, games, source: "live" };
    }
  })();

  return catalogPromise;
}

export async function getMeta() {
  const { meta } = await getCatalog();
  return meta;
}

export async function getCategories() {
  const { meta } = await getCatalog();
  if (Array.isArray(meta.categories) && meta.categories.length) return meta.categories;

  const games = await getAllGames();
  const counts = new Map();
  for (const g of games) {
    counts.set(g.category, (counts.get(g.category) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getAllGames() {
  const { games } = await getCatalog();
  return games;
}

export async function getGame(id) {
  const games = await getAllGames();
  return indexesFor(games).byId.get(String(id)) || null;
}

export async function getDetails(id) {
  id = String(id);
  // hasOwnProperty, not truthiness: a miss is cached as null, and `if
  // (detailsCache[id])` never matched that, so every game with no detail entry
  // re-downloaded its entire ~100KB shard on every single visit.
  if (Object.prototype.hasOwnProperty.call(detailsCache, id)) {
    return detailsCache[id];
  }

  try {
    const shard = await fetchJson(`data/details-${shardOf(id)}.json`);
    const entry = shard[id];
    if (entry) {
      const out = {
        description: entry[0],
        instructions: entry[1],
        url: entry[2],
        width: entry[3],
        height: entry[4],
      };
      cacheDetails(id, out);
      return out;
    }
  } catch {
    /* shard missing, fall through */
  }

  const live = liveById.get(id);
  cacheDetails(id, live || null);
  return live || null;
}

export async function randomGame(excludeId) {
  const games = await getAllGames();
  if (!games.length) return null;
  let g = games[Math.floor(Math.random() * games.length)];
  let guard = 0;
  while (excludeId && g[0] === excludeId && guard++ < 50) {
    g = games[Math.floor(Math.random() * games.length)];
  }
  return g;
}

export function searchGames(games, query) {
  const q = query.trim().toLowerCase();
  if (!q) return games;
  const terms = q.split(/\s+/).filter(Boolean);
  // Precomputed haystacks: the old version rebuilt all 5,621 of them per
  // keystroke, which is the whole cost of typing in the search box.
  const hay = indexesFor(games).hay;
  const out = [];
  for (let i = 0; i < games.length; i++) {
    const h = hay[i];
    let ok = true;
    for (let t = 0; t < terms.length; t++) {
      if (!h.includes(terms[t])) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(games[i]);
  }
  return out;
}

/* ---------- favorites / recently played (localStorage utilities) ---------- */

/* Favorites are read once per card, so a 24-card grid ran 24 JSON.parse calls
   over the same string. Parsed once, kept in memory, and invalidated on write
   or when another tab changes it. */
let favsMemo = null;

function readFavorites() {
  if (favsMemo) return favsMemo;
  try {
    const raw = JSON.parse(localStorage.getItem(FAVS_KEY) || "[]");
    favsMemo = Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    favsMemo = [];
  }
  return favsMemo;
}

export function getFavorites() {
  return readFavorites();
}

export function isFavorite(id) {
  return readFavorites().includes(String(id));
}

export function toggleFavorite(id) {
  id = String(id);
  const favs = readFavorites().slice();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  favsMemo = favs;
  try {
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
  } catch {
    /* ignore */
  }
  return idx < 0;
}

if (typeof window !== "undefined") {
  // Keep the memo honest if the same site is open in two tabs.
  window.addEventListener("storage", (e) => {
    if (e.key === FAVS_KEY) favsMemo = null;
  });
}

export function getRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function markRecent(id, title) {
  id = String(id);
  const recent = getRecent().filter((r) => r.id !== id);
  recent.unshift({ id, title, at: Date.now() });
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 12)));
  } catch {
    /* ignore */
  }
}