import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalCategory } from "../js/categories.js";
import { isAllowedEmbedUrl } from "../js/embed.js";
import { DETAIL_SHARDS, shardOf } from "../js/shard.js";

const FALLBACK = {
  ARCHIVE_URL:
    "https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=html5&popularity=newest&company=All&amount=All",
};

const FEED_URL = process.env.BOREDPUP_FEED_URL || FALLBACK.ARCHIVE_URL;
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

async function main() {
  let games;
  if (OFFLINE) {
    games = await loadOfflineFeed();
  } else {
    console.log(`Fetching feed from ${FEED_URL}…`);
    const res = await fetchWithTimeout(FEED_URL);
    if (!res.ok) throw new Error(`Feed request failed: ${res.status} ${res.statusText}`);
    games = await res.json();
  }
  if (!Array.isArray(games)) throw new Error("Unexpected feed shape");

  console.log(`Feed returned ${games.length} games`);

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
  console.log("sitemap.xml written");
  console.log("Done ✓");
}

async function writeSitemap(catalog, categories) {
  const base = (process.env.BOREDPUP_BASE_URL || "https://www.f9xr.org/boredpup/").replace(/\/+$/, "");
  const urls = [
    "",
    "/category.html",
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
    urls.push(`/game.html?id=${encodeURIComponent(g[0])}`);
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