/* BoredPuP - data and link validation.
   Zero dependencies, no test framework. Run with `npm run validate`.

   This is the guard the data-refresh workflow lacked. Previously a provider
   returning an empty or malformed feed, a duplicate id creeping in, or a shard
   mapping drifting out of sync would all be committed straight to main with no
   error and no alert - and a shard mismatch breaks every game page at once,
   silently. */

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_CATEGORIES, isCanonical } from "../js/categories.js";
import { DETAIL_SHARDS, shardOf } from "../js/shard.js";
import { isAllowedEmbedUrl } from "../js/embed.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const readJson = async (p) => JSON.parse(await readFile(join(root, p), "utf8"));

async function validateCatalog() {
  const catalog = await readJson("data/catalog.json");
  const meta = catalog.meta;
  const games = catalog.games;

  if (!Array.isArray(games)) throw new Error("catalog.json: games is not an array");
  if (!games.length) throw new Error("catalog.json: games is empty - refusing to pass");

  if (meta.count !== games.length) {
    fail(`meta.count is ${meta.count} but catalog has ${games.length} rows`);
  }

  const ids = new Set();
  const seenTitles = new Map();
  for (const [i, g] of games.entries()) {
    if (!Array.isArray(g) || g.length !== 5) {
      fail(`row ${i} is not a 5-tuple: ${JSON.stringify(g).slice(0, 80)}`);
      continue;
    }
    const [id, title, category, tags, thumb] = g;
    if (!id || typeof id !== "string") fail(`row ${i} has an empty id`);
    if (ids.has(id)) fail(`duplicate id: ${id}`);
    ids.add(id);

    if (!title || !String(title).trim()) fail(`game ${id} has a blank title`);
    if (!category || !String(category).trim()) {
      fail(`game ${id} has a blank category`);
    } else if (!isCanonical(category)) {
      fail(`game ${id} has non-canonical category "${category}"`);
    }
    if (!Array.isArray(tags)) fail(`game ${id} has non-array tags`);
    if (typeof thumb !== "string" || !/^https:\/\//.test(thumb)) {
      warn(`game ${id} has a non-https or missing thumbnail`);
    }
    if (title && category) {
      const key = `${title.toLowerCase().slice(0, 60)}|${category.toLowerCase()}`;
      seenTitles.set(key, (seenTitles.get(key) || 0) + 1);
    }
  }

  const dupes = [...seenTitles.entries()].filter(([, n]) => n > 1);
  if (dupes.length) {
    warn(`${dupes.length} title+category pairs appear more than once (top: ${dupes[0][0]} x${dupes[0][1]})`);
  }

  // Categories present in the data must match meta.
  const counted = new Map();
  for (const g of games) counted.set(g[2], (counted.get(g[2]) || 0) + 1);
  const metaCounted = new Map(meta.categories.map((c) => [c.name, c.count]));
  for (const [name, n] of counted) {
    if (metaCounted.get(name) !== n) {
      fail(`category "${name}": meta says ${metaCounted.get(name)}, rows say ${n}`);
    }
  }
  if (metaCounted.size !== counted.size) {
    fail(`meta lists ${metaCounted.size} categories, data has ${counted.size}`);
  }
  const stray = [...metaCounted.keys()].filter((n) => !CANONICAL_CATEGORIES.includes(n));
  if (stray.length) fail(`meta has non-canonical categories: ${stray.join(", ")}`);

  return { games, ids, meta };
}

async function validateShards(ids) {
  const files = (await readdir(dataDir)).filter((f) => /^details-\d+\.json$/.test(f));
  if (!files.length) throw new Error("no detail shards found");

  const expected = new Map();
  for (const id of ids) expected.set(shardOf(id), id);

  const found = new Set();
  const sizes = [];
  const perShard = new Map();

  for (const f of files) {
    const n = Number(/^details-(\d+)\.json$/.exec(f)[1]);
    if (n >= DETAIL_SHARDS) fail(`${f} has an out-of-range shard number`);
    const raw = await readFile(join(dataDir, f), "utf8");
    sizes.push([f, Buffer.byteLength(raw)]);
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      fail(`${f} is not valid JSON: ${e.message}`);
      continue;
    }
    for (const [id, entry] of Object.entries(obj)) {
      found.add(id);
      perShard.set(n, (perShard.get(n) || 0) + 1);

      if (!Array.isArray(entry) || entry.length !== 5) {
        fail(`${f}: entry ${id} is not a 5-tuple`);
        continue;
      }
      if (!isAllowedEmbedUrl(entry[2])) {
        fail(`${f}: entry ${id} has a non-allowlisted or non-https url: ${String(entry[2]).slice(0, 60)}`);
      }
      // THE parity check: this id must live in the shard the client will ask for.
      if (shardOf(id) !== n) {
        fail(`${f}: entry ${id} belongs in details-${shardOf(id)}.json (shard mapping is out of sync)`);
      }
    }
  }

  for (const id of ids) {
    if (!found.has(id)) fail(`catalog id ${id} has no detail entry`);
  }
  for (const id of found) {
    if (!ids.has(id)) fail(`detail entry ${id} is not in the catalog (orphan)`);
  }

  // Balance. A bad hash makes this explode, which is how the 21x skew shipped.
  const counts = [...perShard.values()];
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const worst = Math.max(...counts) / mean;
  if (worst > 1.5) {
    fail(`shard distribution is skewed: worst shard is ${worst.toFixed(2)}x the mean (want < 1.5x)`);
  }

  sizes.sort((a, b) => b[1] - a[1]);
  const kb = (b) => `${(b / 1024).toFixed(1)}KB`;
  return {
    shards: files.length,
    entries: found.size,
    largest: `${sizes[0][0]} ${kb(sizes[0][1])}`,
    skew: `${worst.toFixed(2)}x`,
  };
}

/* data/mobile.json is the Mobile Games page's whole index, and the page has no
   other source: a stale entry here is a dead card, and an id the catalog does
   not have is a card that links to a game page which does not exist. Cheap to
   check because the file is a flat id list. */
async function validateMobileList(ids) {
  let list;
  try {
    list = JSON.parse(await readFile(join(dataDir, "mobile.json"), "utf8"));
  } catch (e) {
    fail(`mobile.json is missing or not valid JSON (run npm run build:feed): ${e.message}`);
    return 0;
  }

  const entries = Array.isArray(list.ids) ? list.ids.map(String) : null;
  if (!entries) {
    fail("mobile.json has no ids array");
    return 0;
  }
  if (list.count !== entries.length) {
    fail(`mobile.json: count is ${list.count} but the ids array has ${entries.length}`);
  }

  const seen = new Set();
  for (const id of entries) {
    if (seen.has(id)) {
      fail(`mobile.json: id ${id} listed twice`);
      continue;
    }
    seen.add(id);
    if (!ids.has(id)) fail(`mobile.json: id ${id} is not in the catalog`);
  }

  return seen.size;
}

async function validateHtml() {
  const pages = [];
  for (const f of (await readdir(root)).filter((f) => f.endsWith(".html"))) pages.push(f);
  for (const f of await readdir(join(root, "pages"))) {
    if (f.endsWith(".html")) pages.push(`pages/${f}`);
  }

  for (const page of pages) {
    const html = await readFile(join(root, page), "utf8");

    // A malformed base URL was shipped in 54 places; catch the class of it.
    for (const m of html.matchAll(/(?:rel="canonical"[^>]*href=|property="og:url"[^>]*content=)"([^"]*)"/g)) {
      const url = m[1];
      if (url.startsWith("http://")) fail(`${page}: plaintext http URL "${url}"`);
      if (/\/\/[^/]*\/[^/]*\/\//.test(url)) fail(`${page}: double slash in "${url}"`);
    }

    // Internal hrefs must resolve to a real file.
    for (const m of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
      const ref = m[1];
      if (/^(https?:|mailto:|data:|\/\/)/.test(ref)) continue;
      const [path] = ref.split(/[?#]/);
      if (!path) continue;
      try {
        // Resolve relative to the page's own directory, not the repo root:
        // pages/*.html legitimately reference ../css/style.css.
        await stat(join(dirname(join(root, page)), path));
      } catch {
        fail(`${page}: references missing file "${path}"`);
      }
    }
  }
  return pages.length;
}

async function validateRobotsAndSitemap() {
  const robots = await readFile(join(root, "robots.txt"), "utf8");
  if (/Sitemap:\s*http:\/\//i.test(robots)) fail("robots.txt advertises an http:// sitemap");
  const m = /Sitemap:\s*(\S+)/i.exec(robots);
  if (!m) fail("robots.txt has no Sitemap: directive");
  else if (m[1].startsWith("http://")) fail(`robots.txt sitemap is http://: ${m[1]}`);

  const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
  if (locs.some((u) => u.startsWith("http://"))) fail("sitemap.xml contains http:// URLs");
  if (/t=/.test(sitemap)) fail("sitemap.xml contains the unread t= parameter");
  if (/<lastmod>/.test(sitemap)) {
    warn("sitemap.xml has <lastmod> values; these are stamped with the build date, not real per-page change times");
  }
  return locs.length;
}

/* ads.txt is a declaration of ad-account ownership. A malformed or duplicated
   record gets inventory withheld, and a record that contradicts another is
   worse than a missing one. What we can check mechanically is the shape and
   the uniqueness; ownership itself is unverifiable from the source tree. */
async function validateAdsTxt() {
  const text = await readFile(join(root, "ads.txt"), "utf8");
  const seen = new Map();
  let records = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    records++;

    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 3 || parts.length > 4) {
      fail(`ads.txt record has ${parts.length} fields, expected 3 or 4: ${line}`);
      continue;
    }
    const [exchange, publisher, relationship, cert] = parts;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(exchange)) {
      fail(`ads.txt exchange is not a domain: ${line}`);
    }
    if (relationship !== "DIRECT" && relationship !== "RESELLER") {
      fail(`ads.txt relationship must be DIRECT or RESELLER, got "${relationship}": ${line}`);
    }
    // A RESELLER line should carry the reselling party, not our own seller ID.
    if (relationship === "RESELLER" && cert) {
      const key = `${exchange}|${publisher}|${cert}`;
      if (seen.has(key)) {
        fail(`ads.txt duplicate record for ${publisher} on ${exchange} (${relationship})`);
      }
      seen.set(key, true);
    }
    const key = `${exchange}|${publisher}`;
    if (seen.has(`DUP:${key}`)) {
      fail(`ads.txt publisher ${publisher} is declared twice on ${exchange}; the second declaration is ignored by some exchanges`);
    }
    seen.set(`DUP:${key}`, true);
  }

  if (!records) fail("ads.txt declares no records");
  return records;
}

/* The prerendered game pages are the URLs the sitemap advertises, so a missing
   or stale one is an indexable 404. Checking 5,621 files has to stay cheap, so
   this verifies existence, a real title, and the canonical/game.js contract
   rather than doing a full parse of each. */
async function validateGamePages(ids) {
  const dir = join(root, "g");
  let checked = 0;
  const missing = [];

  for (const id of ids) {
    const name = /^[A-Za-z0-9._-]{1,64}$/.test(id) ? `${id}.html` : null;
    if (!name) {
      // Not filename-safe, so it is served through game.html?id= by design.
      continue;
    }
    const html = await readFile(join(dir, name), "utf8").catch(() => null);
    if (html === null) {
      missing.push(`g/${name} (absent)`);
    } else if (!/<title>[^<]+<\/title>/.test(html)) {
      missing.push(`g/${name} (no title)`);
    } else if (!html.includes('<base href="../">')) {
      missing.push(`g/${name} (missing <base>, relative assets would break)`);
    }
    checked++;
  }

  if (missing.length) {
    fail(`${missing.length} prerendered game page(s) missing or malformed; run npm run build:pages`);
    for (const m of missing.slice(0, 10)) fail(`  ${m}`);
  }
  return checked;
}

async function main() {
  console.log("Validating BoredPuP data and links…\n");
  const { games, ids } = await validateCatalog();
  const shard = await validateShards(ids);
  const mobile = await validateMobileList(ids);
  const pages = await validateHtml();
  const ads = await validateAdsTxt();
  const urls = await validateRobotsAndSitemap();
  const gamePages = await validateGamePages(ids);

  console.log(`  games          ${games.length}`);
  console.log(`  categories     ${CANONICAL_CATEGORIES.length} canonical`);
  console.log(`  detail shards  ${shard.shards} (${shard.entries} entries, skew ${shard.skew})`);
  console.log(`  largest shard  ${shard.largest}`);
  console.log(`  mobile list    ${mobile} games`);
  console.log(`  html pages     ${pages}`);
  console.log(`  game pages     ${gamePages} prerendered`);
  console.log(`  ads.txt        ${ads} records`);
  console.log(`  sitemap urls   ${urls}\n`);

  if (warnings.length) {
    console.log("Warnings:");
    for (const w of warnings) console.log(`  ! ${w}`);
    console.log("");
  }

  if (errors.length) {
    console.error(`FAILED with ${errors.length} error(s):`);
    for (const e of errors.slice(0, 40)) console.error(`  x ${e}`);
    if (errors.length > 40) console.error(`  … and ${errors.length - 40} more`);
    process.exit(1);
  }
  console.log("All checks passed ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
