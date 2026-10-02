/* BoredPuP - build data/catalog.json, the detail shards, data/mobile.json and
   sitemap.xml from the GameMonetize feeds plus the secondary provider caches.

   Two feeds are read. The html5 one is the catalog spine; the mobile one is the
   same provider with type=mobile and contributes the games html5 does not carry.
   They are not disjoint - 3,925 of the mobile feed's 5,001 ids are also in the
   html5 feed - so "mobile" is recorded as a set difference rather than as a
   flag on the catalog row. The catalog row is a 5-tuple that validate.mjs
   enforces and three providers write; growing it to carry a platform would have
   meant touching all of them to say what a sidecar file says once.

   The build is additive, not authoritative. A game that has left every feed
   stays in the catalog with the row and detail it was last seen with, because
   the alternative is that a provider quietly deleting one title 404s a page
   that has been in the sitemap and in people's bookmarks since it launched.
   The cost is that the catalog only grows and a withdrawn game keeps a stale
   description; that is the cheaper of the two failures.

     node scripts/build-feed.mjs             # fetch and rebuild
     node scripts/build-feed.mjs --offline   # rebuild from the committed snapshot */

import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalCategory } from "../js/categories.js";
import { isAllowedEmbedUrl } from "../js/embed.js";
import { DETAIL_SHARDS, shardOf } from "../js/shard.js";

const feedUrl = (type) =>
  `https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=${type}&popularity=newest&company=All&amount=All`;

const FALLBACK = {
  ARCHIVE_URL: feedUrl("html5"),
  MOBILE_URL: feedUrl("mobile"),
};

const FEED_URL = process.env.BOREDPUP_FEED_URL || FALLBACK.ARCHIVE_URL;
const MOBILE_FEED_URL = process.env.BOREDPUP_MOBILE_FEED_URL || FALLBACK.MOBILE_URL;
const FETCH_TIMEOUT_MS = 30000;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");

async function fetchWithTimeout(url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(str) {
  return String(str ?? "")
    .replace(/&amp;mdash;/gi, " - ")
    .replace(/&mdash;/gi, " - ")
    .replace(/&amp;ndash;/gi, " - ")
    .replace(/&ndash;/gi, " - ")
    .replace(/[\u2014\u2013]/g, " - ")
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
    .replace(/^[\s-]+|[\s-]+$/g, "")
    .trim();
}

function toInt(value) {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 800;
}

function formatBytes(b) {
  return `${(b / 1024).toFixed(1)} KB`;
}

/* `--offline` rebuilds the emitted artifacts from the data already on disk
   (data/catalog.json plus the existing detail shards) instead of re-fetching
   the provider. That is how the shard-hash change was re-cut without a network
   round trip: the same collect/emit code path runs, so the result is identical
   to what the nightly build would have produced. */
const OFFLINE = process.argv.includes("--offline");

/* Reconstructs a provider-shaped feed from the committed snapshot. */
async function loadOfflineFeed() {
  const catalog = JSON.parse(await readFile(join(dataDir, "catalog.json"), "utf8"));
  const details = {};
  for (const file of (await readdir(dataDir)).filter((f) => /^details-\d+\.json$/.test(f))) {
    Object.assign(details, JSON.parse(await readFile(join(dataDir, file), "utf8")));
  }
  console.log(`Offline rebuild from snapshot (${catalog.games.length} games, ${Object.keys(details).length} details)`);
  return catalog.games
    .map(([id, title, category, tags, thumb]) => {
      const d = details[id];
      if (!d) return null;
      return {
        id,
        title,
        category,
        tags: (tags || []).join(","),
        thumb,
        description: d[0],
        instructions: d[1],
        url: d[2],
        width: d[3],
        height: d[4],
      };
    })
    .filter(Boolean);
}

/* The catalog as it stands on disk, so the additive build can carry forward
   every game the feeds no longer return. Read before the feeds so a feed row
   always wins over the preserved copy of the same id. */
async function loadPreserved() {
  const rows = new Map();
  const details = new Map();
  let catalog;
  try {
    catalog = JSON.parse(await readFile(join(dataDir, "catalog.json"), "utf8"));
  } catch {
    return { rows, details };
  }
  for (const row of catalog.games || []) {
    if (Array.isArray(row) && row[0]) rows.set(String(row[0]), row);
  }
  for (const file of (await readdir(dataDir)).filter((f) => /^details-\d+/.test(f))) {
    const shard = JSON.parse(await readFile(join(dataDir, file), "utf8"));
    for (const [id, entry] of Object.entries(shard)) details.set(id, entry);
  }
  return { rows, details };
}

async function main() {
  const preserved = await loadPreserved();

  const primaryIds = new Set();
  const mobileIds = new Set();
  let games;

  if (OFFLINE) {
    games = await loadOfflineFeed();
    // No live feed means no mobile list to recompute. Rewriting it as empty
    // would wipe a page that is otherwise perfectly serviceable, so the
    // committed data/mobile.json is left alone.
  } else {
    console.log(`Fetching ${FEED_URL}`);
    console.log(`Fetching ${MOBILE_FEED_URL}`);
    const [primary, mobile] = await Promise.all([fetchWithTimeout(FEED_URL), fetchWithTimeout(MOBILE_FEED_URL)]);
    if (!primary.ok) throw new Error(`Feed request failed: ${primary.status} ${primary.statusText}`);
    if (!mobile.ok) throw new Error(`Mobile feed request failed: ${mobile.status} ${mobile.statusText}`);
    const [primaryGames, mobileGames] = await Promise.all([primary.json(), mobile.json()]);
    if (!Array.isArray(primaryGames)) throw new Error("Unexpected feed shape");
    if (!Array.isArray(mobileGames)) throw new Error("Unexpected mobile feed shape");
    for (const g of primaryGames) primaryIds.add(String(g.id ?? "").trim());
    for (const g of mobileGames) mobileIds.add(String(g.id ?? "").trim());
    // Concatenated rather than merged row by row: the loop below de-dupes by id
    // and keeps the first occurrence, so the html5 feed's version of a game
    // wins over the mobile feed's copy of the same id.
    games = [...primaryGames, ...mobileGames];
  }

  console.log(`Feed returned ${games.length} rows`);

  const catalog = [];
  const shards = {};
  const counts = new Map();
  const seen = new Set();
  let skipped = 0;

  for (const g of games) {
    const id = String(g.id ?? "").trim();
    if (!id || seen.has(id)) {
      skipped++;
      continue;
    }
    seen.add(id);

    const url = String(g.url ?? "").trim();
    if (!isAllowedEmbedUrl(url)) {
      skipped++;
      continue;
    }

    const category = canonicalCategory(decodeEntities(g.category));
    counts.set(category, (counts.get(category) || 0) + 1);

    catalog.push([
      id,
      decodeEntities(g.title) || "Untitled Game",
      category,
      (g.tags ? decodeEntities(g.tags).split(",").map((t) => t.trim()).filter(Boolean) : []),
      String(g.thumb ?? "").trim(),
    ]);

    const shard = shardOf(id);
    (shards[shard] ??= {})[id] = [
      decodeEntities(g.description) || "",
      g.instructions ? decodeEntities(g.instructions) : "",
      url,
      toInt(g.width),
      toInt(g.height),
    ];
  }

  // Merge secondary providers (data/*-cache.json), if present.
  const secondary = new Map();
  let cacheFiles = [];
  try {
    cacheFiles = (await readdir(dataDir))
      .filter((f) => /-cache\.json$/.test(f))
      .sort();
  } catch {
    /* no data dir yet */
  }
  for (const file of cacheFiles) {
    try {
      const merge = JSON.parse(await readFile(join(dataDir, file), "utf8"));
      if (merge && Array.isArray(merge.rows)) {
        let merged = 0;
        for (const row of merge.rows) {
          const sid = Array.isArray(row) ? String(row[0]) : "";
          if (!sid || seen.has(sid)) continue;
          const [, title, , , thumb] = row;

          // Normalise exactly as the primary path does, and hold the merged
          // detail URL to the same allowlist. This path used to push the raw
          // cache category (no entity decoding, no Arcade fallback) and the raw
          // detail URL, so a bad provider payload could create an "" category
          // and reach the sitemap unfiltered.
          const d = merge.details && merge.details[sid];
          const mergedUrl = Array.isArray(d) ? String(d[2] ?? "").trim() : "";
          if (!isAllowedEmbedUrl(mergedUrl)) continue;

          seen.add(sid);
          const category = canonicalCategory(decodeEntities(row[2]));
          counts.set(category, (counts.get(category) || 0) + 1);
          catalog.push([
            sid,
            decodeEntities(title) || "Untitled Game",
            category,
            Array.isArray(row[3])
              ? row[3].map((t) => decodeEntities(String(t))).filter(Boolean)
              : [],
            String(thumb ?? "").trim(),
          ]);
          if (Array.isArray(d)) {
            const shard = shardOf(sid);
            (shards[shard] ??= {})[sid] = [
              decodeEntities(d[0]) || "",
              d[1] ? decodeEntities(d[1]) : "",
              mergedUrl,
              toInt(d[3]),
              toInt(d[4]),
            ];
          }
          merged++;
        }
        secondary.set(file, merged);
      }
    } catch {
      /* unreadable cache - skip */
    }
  }

  // Carry forward everything the feeds and the caches no longer return. Without
  // this the build is authoritative and a single title the provider drops
  // 404s, because build-game-pages.mjs deletes the g/ page for any id that
  // leaves the catalog. Appended last so the provider's newest-first ordering
  // still drives the "new games" row on the home page.
  let keptFromCatalog = 0;
  let keptWithoutDetail = 0;
  for (const [id, row] of preserved.rows) {
    if (seen.has(id)) continue;
    seen.add(id);
    const category = canonicalCategory(decodeEntities(row[2]));
    counts.set(category, (counts.get(category) || 0) + 1);
    catalog.push([id, decodeEntities(row[1]) || "Untitled Game", category, Array.isArray(row[3]) ? row[3].map((t) => decodeEntities(String(t))).filter(Boolean) : [], String(row[4] ?? "").trim()]);

    const detail = preserved.details.get(id);
    if (Array.isArray(detail) && detail.length === 5 && isAllowedEmbedUrl(String(detail[2] ?? "").trim())) {
      const shard = shardOf(id);
      (shards[shard] ??= {})[id] = [
        decodeEntities(detail[0]) || "",
        detail[1] ? decodeEntities(detail[1]) : "",
        String(detail[2]).trim(),
        toInt(detail[3]),
        toInt(detail[4]),
      ];
    } else {
      // A row with no usable detail renders a game page whose player cannot
      // load, so it is counted here rather than discovered in production.
      keptWithoutDetail++;
    }
    keptFromCatalog++;
  }

  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  await mkdir(dataDir, { recursive: true });

  const builtMeta = { generated: new Date().toISOString(), count: catalog.length, shards: DETAIL_SHARDS, categories };
  await writeFile(join(dataDir, "meta.json"), JSON.stringify(builtMeta));

  await writeFile(join(dataDir, "catalog.json"), JSON.stringify({ meta: builtMeta, games: catalog }));

  for (const shard of Object.keys(shards)) {
    await writeFile(join(dataDir, `details-${shard}.json`), JSON.stringify(shards[shard]));
  }

  // Drop shards the current build did not produce. A shrinking feed would
  // otherwise leave orphaned details-N.json files on disk that nothing reads,
  // but which still ship to clients and count against the precache budget.
  for (const file of await readdir(dataDir)) {
    const m = /^details-(\d+)\.json$/.exec(file);
    if (m && !(m[1] in shards)) {
      await unlink(join(dataDir, file));
      console.log(`removed stale ${file}`);
    }
  }

  // The mobile list is a set difference, not a flag: the mobile feed repeats
  // 3,925 of the html5 feed's games, and listing those again would put a
  // near-duplicate of category.html in the index under a second URL. Only ids
  // that reached the catalog are listed, so the page can never link a game the
  // catalog does not have.
  let mobileWritten = 0;
  if (OFFLINE) {
    console.log("mobile.json: left as committed (no live feed to recompute it from)");
  } else {
    const mobileOnly = [...mobileIds].filter((id) => !primaryIds.has(id) && seen.has(id)).sort((a, b) => Number(b) - Number(a) || a.localeCompare(b));
    const payload = { generated: builtMeta.generated, count: mobileOnly.length, ids: mobileOnly };
    await writeFile(join(dataDir, "mobile.json"), JSON.stringify(payload));
    mobileWritten = mobileOnly.length;
  }

  const catSize = (await stat(join(dataDir, "catalog.json"))).size;
  const metaSize = (await stat(join(dataDir, "meta.json"))).size;
  let detailTotal = 0;
  let detailMax = 0;
  for (const shard of Object.keys(shards)) {
    const size = (await stat(join(dataDir, `details-${shard}.json`))).size;
    detailTotal += size;
    detailMax = Math.max(detailMax, size);
  }

  await writeSitemap(catalog, categories);

  console.log(`catalog.json:      ${formatBytes(catSize)}`);
  console.log(`meta.json:         ${formatBytes(metaSize)}`);
  console.log(`details (${Object.keys(shards).length} shards): total ${formatBytes(detailTotal)}, max ${formatBytes(detailMax)}`);
  console.log(`categories: ${categories.length}, games: ${catalog.length}, skipped: ${skipped}, secondary: ${cacheFiles.length ? [...secondary].map(([f, n]) => `${f}=${n}`).join(", ") : "none"}`);
  console.log(`kept from the previous catalog: ${keptFromCatalog}${keptWithoutDetail ? ` (${keptWithoutDetail} without a usable detail)` : ""}`);
  if (!OFFLINE) console.log(`mobile-only games: ${mobileWritten}`);
  console.log("sitemap.xml written");
  console.log("Done ✓");
}

async function writeSitemap(catalog, categories) {
  const base = (process.env.BOREDPUP_BASE_URL || "https://www.f9xr.org/boredpup/").replace(/\/+$/, "");
  const urls = [
    "",
    "/category.html",
    "/mobile.html",
    "/developers.html",
    "/tools.html",
    "/my-games.html",
    "/pages/about.html",
    "/pages/contact.html",
    "/pages/parents.html",
    "/pages/privacy.html",
    "/pages/terms.html",
  ];
  for (const c of categories) {
    urls.push(`/category.html?c=${encodeURIComponent(c.name)}`);
  }
  for (const g of catalog) {
    // The prerendered page is the canonical URL for each game; game.html?id= is
  // kept working for existing links but points its canonical here too, so the
  // shell never becomes a second indexable URL for the same game.
  urls.push(`/g/${encodeURIComponent(g[0])}.html`);
  }

  // No <lastmod>. The previous build stamped every one of the 5,671 URLs with
  // today's date on every nightly run, which tells crawlers all 5,621 game
  // pages changed when most did not - the opposite of the signal lastmod is
  // meant to carry. We have no per-page modification time, so we say nothing
  // rather than fabricate it; crawlers then recheck on their own schedule.
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`;

  await writeFile(join(root, "sitemap.xml"), xml, "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});