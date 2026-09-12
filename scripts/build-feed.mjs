import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FALLBACK = {
  ARCHIVE_URL:
    "https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=html5&popularity=newest&company=All&amount=All",
};

const FEED_URL = process.env.BOREDPUP_FEED_URL || FALLBACK.ARCHIVE_URL;
const DETAIL_SHARDS = 32;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");

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
    .replace(/^[\s-]+|[\s-]+$/g, "")
    .trim();
}

function toInt(value) {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 800;
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function formatBytes(b) {
  return `${(b / 1024).toFixed(1)} KB`;
}

async function main() {
  console.log(`Fetching feed from ${FEED_URL}…`);
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Feed request failed: ${res.status} ${res.statusText}`);
  const games = await res.json();
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
    if (!/^https:\/\/(html5\.)?gamemonetize(\.co|\.com)\//i.test(url)) {
      skipped++;
      continue;
    }

    const category = decodeEntities(g.category) || "Arcade";
    counts.set(category, (counts.get(category) || 0) + 1);

    catalog.push([
      id,
      decodeEntities(g.title) || "Untitled Game",
      category,
      (g.tags ? decodeEntities(g.tags).split(",").map((t) => t.trim()).filter(Boolean) : []),
      String(g.thumb ?? "").trim(),
      toInt(g.width),
      toInt(g.height),
      url,
    ]);

    const shard = hashString(id) % DETAIL_SHARDS;
    (shards[shard] ??= {})[id] = [
      decodeEntities(g.description) || "",
      g.instructions ? decodeEntities(g.instructions) : "",
    ];
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
  console.log(`categories: ${categories.length}, games: ${catalog.length}, skipped: ${skipped}`);
  console.log("sitemap.xml written");
  console.log("Done ✓");
}

async function writeSitemap(catalog, categories) {
  const base = process.env.BOREDPUP_BASE_URL || "https://boredpup.com";
  const urls = [
    "",
    "/category.html",
    "/search.html",
  ];
  for (const c of categories) {
    urls.push(`/category.html?c=${encodeURIComponent(c.name)}`);
  }
  for (const g of catalog) {
    urls.push(`/game.html?id=${encodeURIComponent(g[0])}`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`;

  await writeFile(join(root, "sitemap.xml"), xml, "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});