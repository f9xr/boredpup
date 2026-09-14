/* BoredPuP - data layer.
   Loads the slim GameMonetize catalog (data/catalog.json) and on-demand
   detail shards (data/details-<n>.json). Falls back to the live
   GameMonetize feed whenever the snapshot is missing.

   Catalog rows:  [id, title, category, tags, thumb]
   Detail entry:  { description, instructions, url, width, height }  */

export const FEED_URL =
  "https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=html5&popularity=newest&company=All&amount=All";

const DETAIL_SHARDS = 32;
const LOCAL_KEY = "boredpup:catalog:v2";
export const RECENT_KEY = "boredpup:recent:v1";
export const FAVS_KEY = "boredpup:favs:v1";
const DETAILS_CACHE_MAX = 200;

let liveFull = [];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function shardOf(id) {
  return hashString(id) % DETAIL_SHARDS;
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
  return games.filter((g) => String(g.id ?? "")).map(normalizeLiveGame);
}

export async function getCatalog() {
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    try {
      const local = localStorage.getItem(LOCAL_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        const stale = Date.now() - (parsed.ts || 0) > 6 * 60 * 60 * 1000;
        if (!stale || navigator.onLine === false) {
          return {
            meta: parsed.meta,
            games: parsed.games,
            source: "cache",
          };
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
  return games.find((g) => g[0] === String(id)) || null;
}

export async function getDetails(id) {
  id = String(id);
  if (detailsCache[id]) return detailsCache[id];

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

  const live = liveFull.find((g) => g.id === id);
  if (live) {
    cacheDetails(id, live);
    return live;
  }
  cacheDetails(id, null);
  return null;
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
  return games.filter((g) => {
    const hay = (g[1] + " " + g[2] + " " + (g[3] || []).join(" ")).toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

/* ---------- favorites / recently played (localStorage utilities) ---------- */

export function getFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVS_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function isFavorite(id) {
  return getFavorites().includes(String(id));
}

export function toggleFavorite(id) {
  id = String(id);
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  try {
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
  } catch {
    /* ignore */
  }
  return idx < 0;
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