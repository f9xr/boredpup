/* BoredPuP — data layer.
   Loads the slim GameMonetize catalog (data/catalog.json) and on-demand
   detail shards (data/details-<n>.json). Falls back to the live
   GameMonetize feed whenever the snapshot is missing. */

export const FEED_URL =
  "https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=html5&popularity=newest&company=All&amount=All";

const DETAIL_SHARDS = 32;
const LOCAL_KEY = "boredpup:catalog:v1";

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
    .replace(/&amp;mdash;/gi, "—")
    .replace(/&mdash;/gi, "—")
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

function normalizeLiveGame(g) {
  return [
    String(g.id ?? ""),
    decodeEntities(g.title) || "Untitled Game",
    decodeEntities(g.category) || "Arcade",
    (g.tags ? decodeEntities(g.tags).split(",").map((t) => t.trim()).filter(Boolean) : []),
    String(g.thumb ?? "").trim(),
    parseInt(g.width, 10) || 800,
    parseInt(g.height, 10) || 600,
    String(g.url ?? "").trim(),
  ];
}

async function loadLiveSnapshot() {
  const games = await fetchJson(FEED_URL, { cache: "no-store" });
  if (!Array.isArray(games)) throw new Error("Unexpected live feed shape");
  return games.map(normalizeLiveGame).filter((g) => g[0]);
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
    const out = entry ? { description: entry[0], instructions: entry[1] } : null;
    detailsCache[id] = out;
    return out;
  } catch {
    return null;
  }
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

export function categoryGames(games, category) {
  return games.filter((g) => g[2] === category);
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