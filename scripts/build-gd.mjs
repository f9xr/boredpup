import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* BoredPuP - secondary game provider: GameDistribution.
   Pulls the GameDistribution wizard RSS API (paginated, 1000/page), normalises
   each hit into the shared catalog row shape and writes data/gd-cache.json.

   build-feed.mjs merges every data/*-cache.json into the catalog, so the full
   pipeline is:
     npm run build:gd    (refresh the GameDistribution cache)
     npm run build:feed  (merge + write catalog/details/sitemap)
   or just: npm run build:all
*/

const API = "https://gd-website-api.gamedistribution.com/wizard/rss";
const PAGE_SIZE = 1000;
const MAX_GAMES = parseInt(process.env.BOREDPUP_GD_COUNT || "500", 10);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const OUT = join(dataDir, "gd-cache.json");

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

async function main() {
  const games = [];
  let page = 0;
  let pages = Infinity;

  while (games.length < MAX_GAMES && page < pages) {
    console.log(`Fetching GameDistribution page ${page}…`);
    const url = `${API}?page=${page}&pageSize=${PAGE_SIZE}`;
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 BoredPuP" } });
    if (!res.ok) throw new Error(`GD request failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const segment = data && data.segments && data.segments[0];
    const hits = (segment && segment.hits) || [];
    if (segment && segment.paging) pages = segment.paging.pages || Infinity;

    for (const hit of hits) {
      if (games.length >= MAX_GAMES) break;
      const id = String(hit["Id"] ?? "").trim();
      const title = decodeEntities(hit["Title"]) || "";
      const embedUrl = String(hit["Game URL"] ?? "").trim();
      if (!id || !title || !/^https:\/\/html5\.gamedistribution\.com\//i.test(embedUrl)) continue;

      const genres = Array.isArray(hit["Genres"]) ? hit["Genres"] : [];
      const tags = Array.isArray(hit["Tags"]) ? hit["Tags"] : [];
      const assets = Array.isArray(hit["Assets"]) ? hit["Assets"] : [];
      const thumb = String(assets[0] || "").trim();

      games.push({
        id: `gd-${id}`,
        title,
        category: decodeEntities(genres[0]) || "Arcade",
        tags: tags.map((t) => titleCase(decodeEntities(String(t)))).filter(Boolean).slice(0, 10),
        thumb,
        description: decodeEntities(hit["Description"]) || "",
        instructions: decodeEntities(hit["Instructions"]) || "",
        url: embedUrl,
        width: parseInt(hit["Width"], 10) || 800,
        height: parseInt(hit["Height"], 10) || 600,
      });
    }

    if (hits.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`Collected ${games.length} GameDistribution games`);

  const rows = games.map((g) => [g.id, g.title, g.category, g.tags, g.thumb]);
  const details = {};
  for (const g of games) {
    details[g.id] = [g.description, g.instructions, g.url, g.width, g.height];
  }

  const payload = { generated: new Date().toISOString(), count: rows.length, rows, details };
  await mkdir(dataDir, { recursive: true });
  await writeFile(OUT, JSON.stringify(payload));
  console.log(`gd-cache.json written (${rows.length} games)`);
  console.log("Now run `npm run build:feed` to merge these into the catalog.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});