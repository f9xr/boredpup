import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* BoredPuP - secondary game provider: yupi.io.
   Downloads the yupi.io game sitemaps, inspects each game page for the
   metadata we need (title, category, thumbnail, description, how-to-play)
   and whether the game can actually be framed (some publishers force an
   offsite / new-tab link), then writes data/yupi-cache.json.

   The merge into data/catalog.json + detail shards + sitemap.xml happens
   inside build-feed.mjs, so the full pipeline is:
     npm run build:yupi   (refresh the yupi cache)
     npm run build:feed   (merge + write catalog/details/sitemap)
   or just: npm run build:all
*/

const YUPI_SITEMAPS = [
  "https://yupi.io/sitemap-games-1.xml",
  "https://yupi.io/sitemap-games-2.xml",
  "https://yupi.io/sitemap-games-3.xml",
  "https://yupi.io/sitemap-games-4.xml",
];

const MAX_GAMES = parseInt(process.env.BOREDPUP_YUPI_COUNT || "120", 10);
const CONCURRENCY = 6;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const OUT = join(dataDir, "yupi-cache.json");

function decodeEntities(str) {
  return String(str ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function titleCase(str) {
  const stop = new Set(["of", "the", "and", "&"]);
  return String(str ?? "")
    .split(" ")
    .filter(Boolean)
    .map((w) => (stop.has(w.toLowerCase()) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

async function getSlugs() {
  const slugs = new Set();
  for (const url of YUPI_SITEMAPS) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 BoredPuP" } });
      if (!res.ok) continue;
      const xml = await res.text();
      const found = [...xml.matchAll(/https:\/\/yupi\.io\/game\/([a-z0-9-]+)/g)].map((m) => m[1]);
      for (const s of found) if (s) slugs.add(s);
    } catch {
      /* skip unreachable sitemap */
    }
  }
  return [...slugs];
}

async function fetchPage(slug) {
  try {
    const res = await fetch(`https://yupi.io/game/${slug}`, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; BoredPuP/1.0; +https://boredpup.com)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseGame(slug, html) {
  if (!html) return null;
  if (html.includes("game-poster--offsite")) return null; // publisher forbids framing

  const match = (re) => {
    const m = html.match(re);
    return m ? m[1].trim() : "";
  };

  const title = decodeEntities(
    match(/<h1 class="game-details__title">([^<]+)<\/h1>/) || match(/meta property="og:title" content="([^"]+)"/)
  );
  if (!title) return null;

  const category = titleCase(
    decodeEntities(match(/<li><a href="\/category\/[^"]+">([^<]+)<\/a>/i))
  );
  const thumb =
    match(/meta property="og:image" content="([^"]+)"/) ||
    match(/class="game-poster[^"]*"[\s\S]*?<img src="([^"]+)"/);
  const description = decodeEntities(
    match(/<meta name="description" content="([^"]+)"/) ||
      match(/"@type":"VideoGame"[^{]*"description":"((?:[^"\\]|\\.)*)"/)
  );
  const instructions = decodeEntities(
    match(/<h2>How to Play<\/h2>\s*<p>((?:[^<]|<br\s*\/?>)*?)<\/p>/)
  );
  const tagMatch = [...html.matchAll(/<a class="tag" href="\/category\/[^"]+">#([^<]+)<\/a>/g)].map((m) => m[1]);

  if (!category || !thumb) return null;
  const absThumb = thumb.startsWith("http") ? thumb : `https://yupi.io${thumb}`;

  return {
    id: `yupi-${slug}`,
    title,
    category,
    tags: (tagMatch.length ? tagMatch : [category]).map(titleCase),
    thumb: absThumb,
    description,
    instructions,
    url: `https://yupi.io/embed/${slug}`,
    width: 960,
    height: 540,
  };
}

async function main() {
  console.log("Fetching yupi.io sitemaps…");
  const slugs = await getSlugs();
  console.log(`Found ${slugs.length} yupi.io game slugs`);

  const picked = slugs.slice(0, MAX_GAMES);
  const games = [];
  let cursor = 0;
  async function worker() {
    while (cursor < picked.length) {
      const slug = picked[cursor++];
      const html = await fetchPage(slug);
      const g = parseGame(slug, html);
      if (g) games.push(g);
      process.stdout.write(`  ${games.length} ok / ${cursor}/${picked.length}\r`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log("");

  const rows = games.map((g) => [g.id, g.title, g.category, g.tags, g.thumb]);
  const details = {};
  for (const g of games) {
    details[g.id] = [g.description || "", g.instructions || "", g.url, g.width, g.height];
  }

  const payload = { generated: new Date().toISOString(), count: rows.length, rows, details };
  await mkdir(dataDir, { recursive: true });
  await writeFile(OUT, JSON.stringify(payload));
  console.log(`yupi-cache.json written (${rows.length} frameable games)`);
  console.log("Now run `npm run build:feed` to merge these into the catalog.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});