/* BoredPuP - generate a static page per game under g/.

   C8. game.html?id=12345 is a JavaScript shell: the title, description, social
   image and JSON-LD are all written by js/game.js at runtime. Googlebot renders
   JavaScript, so search mostly survived. Social crawlers do not - Twitter,
   Facebook, Slack, Discord, LinkedIn and iMessage read the raw response - so
   every shared game link unfurled as the generic "Play free online games"
   card with the site-wide image, and a reader without JavaScript got
   "Loading…" forever.

   This writes one small page per game carrying its real metadata, a real
   no-JS description with a direct provider link, and a hand-off to the same
   js/game.js that the shell uses. Both URL forms work:
   g/12345.html and the legacy game.html?id=12345, and game.js points the
   canonical at the g/ URL in both cases so the shell never becomes a second
   indexable URL for the same game.

   The pages are deliberately lean: a compact footer with no category list, no
   footer category fetch, no duplicated search form. Detail content comes from
   the shards, so the page can be static and still say what the game is.

     node scripts/build-game-pages.mjs            # generate
     node scripts/build-game-pages.mjs --check    # fail if any page is missing

   Rewrites only the pages whose content actually changed, so a nightly data
   refresh does not churn 5,621 files, and deletes pages for games that have
   left the catalog. */

import { readFile, readdir, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CSP_TAG } from "./csp.mjs";
import { canonicalCategory } from "../js/categories.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "g");
const BASE = (process.env.BOREDPUP_BASE_URL || "https://www.f9xr.org/boredpup").replace(/\/+$/, "");
const checkOnly = process.argv.includes("--check");
const BATCH = 250;

const escapeHtml = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/* Only the characters a provider can hand us that are actually unsafe in an
   attribute or text position. The catalog is build output from three upstream
   feeds, so it is treated as untrusted. */
const cleanText = (v) =>
  String(v ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

/* Descriptions and instructions are published once each, in the noscript
   block, and summarised in the JSON-LD. Carrying them at full length in three
   places is what pushed the average page to 10KB across 5,621 files; a no-JS
   visitor wants the gist and a play link, and a truncated structured
   description is what search engines read anyway. */
function clip(v, max) {
  const s = cleanText(v);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, "")}…`;
}

/* A game id becomes a filename. Anything that is not a plain token falls back
   to the legacy query-string URL rather than producing a surprising path. */
function safeId(id) {
  return /^[A-Za-z0-9._-]{1,64}$/.test(id) ? id : null;
}

function page(game, detail) {
  const id = game[0];
  const title = cleanText(game[1]) || "Untitled Game";
  const category = canonicalCategory(cleanText(game[2])) || "Arcade";
  const tags = Array.isArray(game[3]) ? game[3].map(cleanText).filter(Boolean).slice(0, 8) : [];
  const thumb = String(game[4] || "").trim();

  const description = cleanText(detail?.description) || "";
  const instructions = cleanText(detail?.instructions) || "";
  const embedUrl = String(detail?.url || "").trim();

  const pageTitle = `${title} - Play Free Online on BoredPuP`;
  const metaDesc = `Play ${title} - a free ${category} game, online instantly on BoredPuP. No downloads, no sign-ups.`;
  const socialDesc = `Play ${title}, a free ${category} game, in your browser right now on BoredPuP.`;
  const canonical = `${BASE}/g/${id}.html`;
  const url = `${BASE}/g/${id}.html`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: title,
    description: clip(description, 300) || metaDesc,
    genre: category,
    url,
    image: thumb || undefined,
    keywords: tags,
    applicationCategory: "Game",
    inLanguage: "en",
    browserRequirements: "Any modern browser with HTML5 support",
    publisher: { "@type": "Organization", name: "BoredPuP", url: `${BASE}/index.html` },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
  if (embedUrl) ld.embedUrl = embedUrl;

  // noscript carries the real game information, not just "enable JavaScript".
  const noJs = [
    `<h1 class="heading-md" style="margin-top:var(--space-lg)">${escapeHtml(title)}</h1>`,
    tags.length
      ? `<div class="tag-row" style="margin-top:var(--space-md)">${tags
          .map((t) => `<span class="badge-pill">${escapeHtml(t)}</span>`)
          .join("")}</div>`
      : "",
    description
      ? `<div class="info-card" style="margin-top:var(--space-xl)"><h2>About this game</h2><p>${escapeHtml(clip(description, 600))}</p></div>`
      : "",
    instructions
      ? `<div class="info-card" style="margin-top:var(--space-xl)"><h2>How to play</h2><p>${escapeHtml(clip(instructions, 400))}</p></div>`
      : "",
    embedUrl
      ? `<p style="margin-top:var(--space-xl)"><a class="btn btn-primary" href="${escapeHtml(embedUrl)}" rel="noopener noreferrer">Play ${escapeHtml(title)} directly</a></p>`
      : "",
    `<p style="margin-top:var(--space-xl)" class="mute">Or <a class="inline-link" href="index.html">browse all games on BoredPuP</a>.</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  ${CSP_TAG}
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BoredPuP">
  <meta id="ogTitle" property="og:title" content="${escapeHtml(pageTitle)}">
  <meta id="ogDesc" property="og:description" content="${escapeHtml(socialDesc)}">
  <meta id="ogUrl" property="og:url" content="${escapeHtml(url)}">
  <meta id="ogImage" property="og:image" content="${escapeHtml(thumb || `${BASE}/assets/og-image.png`)}">
  <meta id="ogImageW" property="og:image:width" content="${thumb ? "512" : "1200"}">
  <meta id="ogImageH" property="og:image:height" content="${thumb ? "384" : "630"}">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta id="twCard" name="twitter:card" content="summary_large_image">
  <meta id="twTitle" name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta id="twDesc" name="twitter:description" content="${escapeHtml(socialDesc)}">
  <meta id="twImg" name="twitter:image" content="${escapeHtml(thumb || `${BASE}/assets/og-image.png`)}">
  <meta name="theme-color" content="#000000">
  <meta name="robots" content="index,follow">
  <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <base href="../">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="nav"><div class="nav-inner">
    <a class="nav-logo" href="index.html" aria-label="BoredPuP home"><span class="logo-mark"><img src="assets/logo.svg" alt="" width="26" height="26"></span>Bored<span class="logo-muted">PuP</span></a>
    <nav class="nav-links" aria-label="Primary">
      <a href="index.html">Home</a>
      <a href="category.html">All games</a>
      <a href="category.html?c=${encodeURIComponent(category)}">${escapeHtml(category)}</a>
    </nav>
  </div></header>
  <main id="main" class="glow-section glow-blue">
    <div class="container-narrow" style="max-width:1040px">
      <div style="padding-top:var(--space-xxl)">
        <nav class="crumbs" aria-label="Breadcrumb" id="crumbs">
          <a href="index.html">Home</a><span aria-hidden="true">/</span>
          <a href="category.html?c=${encodeURIComponent(category)}">${escapeHtml(category)}</a><span aria-hidden="true">/</span>
          <span>${escapeHtml(title)}</span>
        </nav>
        <noscript><style>#playerShell{display:none!important}#nogo{display:block!important}</style>
        <div class="info-card" id="nogo" style="display:none;margin-top:var(--space-xl)">
        ${noJs}
        </div></noscript>
        <div class="empty-state" id="notFound" style="display:none;margin-top:var(--space-xxl)">
          <div class="big">Game not found</div>
          <p>This game is no longer in the catalog. <a class="inline-link" href="search.html">Search again</a> or <a class="inline-link" href="category.html">browse all games</a>.</p>
        </div>
        <div class="player-shell" id="playerShell">
          <div class="player-frame" id="playerFrame">
            <div id="iframeSlot" style="background:var(--surface-deep);aspect-ratio:4 / 3">
              <div class="skeleton" style="border:0;border-radius:0;height:100%"></div>
            </div>
            <div class="player-toolbar">
              <span class="play-hint">Loading ${escapeHtml(title)}…</span>
              <span class="spacer"></span>
              <button class="btn btn-outline btn-sm" id="refreshBtn" type="button">Restart</button>
              <button class="btn btn-outline btn-sm" id="fullBtn" type="button">Fullscreen</button>
              <button class="btn btn-outline btn-sm" id="shareBtn" type="button">Share</button>
            </div>
          </div>
          <h1 class="heading-md" id="gameTitle" style="margin-top:var(--space-xxxl);letter-spacing:-0.02em">${escapeHtml(title)} - free ${escapeHtml(category)} game</h1>
          <div class="tag-row" id="tagRow" style="margin-top:var(--space-md)">${tags
            .map((t) => `<a class="badge-pill" href="search.html?q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`)
            .join("")}</div>
          <div class="info-card" id="howToCard" style="display:none">
            <h2>How to play</h2><p id="instructions"></p>
          </div>
          <div class="info-card" id="aboutCard" style="display:none">
            <h2>About this game</h2><p id="description"></p>
          </div>
          <section id="relatedSection" style="margin-top:var(--space-xxxl)">
            <div class="sec-head" style="margin-bottom:var(--space-xl)">
              <div><h2 class="display-lg" id="relatedTitle">More to play</h2><p class="sub mute">Hand-picked from the same family</p></div>
            </div>
            <div class="game-grid" id="relatedGrid"></div>
          </section>
        </div>
      </div>
    </div>
  </main>
  <footer class="footer"><div class="container">
    <div class="footer-bottom">
      <span>© 2026 BoredPuP - free online games for the bored.</span>
      <a href="index.html">All games</a>
      <a href="search.html">Search</a>
      <a href="pages/about.html">About</a>
      <a href="pages/contact.html">Contact</a>
      <a href="pages/terms.html">Terms</a>
      <a href="pages/privacy.html">Privacy</a>
    </div>
  </div></footer>
  <script type="module" src="js/game.js"></script>
</body>
</html>
`;
}

/* Leading indentation is readability in the template above and pure weight in
   5,621 output files. Nothing here spans lines inside a tag or an attribute
   value, so dropping it cannot change the parse. */
function minify(html) {
  return html
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim() + "\n";
}

async function loadDetails() {
  const out = new Map();
  for (const f of await readdir(join(root, "data"))) {
    const m = /^details-(\d+)\.json$/.exec(f);
    if (!m) continue;
    const shard = JSON.parse(await readFile(join(root, "data", f), "utf8"));
    for (const [id, entry] of Object.entries(shard)) {
      out.set(id, {
        description: entry?.[0] ?? "",
        instructions: entry?.[1] ?? "",
        url: entry?.[2] ?? "",
        width: entry?.[3] ?? 800,
        height: entry?.[4] ?? 600,
      });
    }
  }
  return out;
}

async function main() {
  const catalog = JSON.parse(await readFile(join(root, "data/catalog.json"), "utf8"));
  const details = await loadDetails();
  await mkdir(outDir, { recursive: true });

  const wanted = new Map();
  for (const game of catalog.games) {
    const id = safeId(String(game[0]));
    if (id) wanted.set(id, game);
  }

  const existing = new Set(
    (await readdir(outDir).catch(() => [])).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5))
  );

  if (checkOnly) {
    const missing = [];
    for (const id of wanted.keys()) {
      const f = join(outDir, `${id}.html`);
      const html = await readFile(f, "utf8").catch(() => null);
      if (html === null) missing.push(`${id}.html (absent)`);
      else if (!html.includes(`<title>`)) missing.push(`${id}.html (no title)`);
    }
    if (missing.length) {
      console.error(`Missing or malformed game pages: ${missing.length}`);
      for (const m of missing.slice(0, 20)) console.error(`  x g/${m}`);
      process.exit(1);
    }
    console.log(`All ${wanted.size} game pages present ✓`);
    return;
  }

  let written = 0;
  let unchanged = 0;
  let bytes = 0;
  const ids = [...wanted.keys()];

  for (let i = 0; i < ids.length; i += BATCH) {
    await Promise.all(
      ids.slice(i, i + BATCH).map(async (id) => {
        const html = minify(page(wanted.get(id), details.get(id)));
        const p = join(outDir, `${id}.html`);
        const before = await readFile(p, "utf8").catch(() => null);
        if (before === html) {
          unchanged++;
          return;
        }
        await writeFile(p, html, "utf8");
        written++;
        bytes += Buffer.byteLength(html);
      })
    );
  }

  // Games that left the catalog must not keep a page, or they stay indexable
  // and 404 for a visitor.
  let removed = 0;
  for (const id of existing) {
    if (!wanted.has(id)) {
      await rm(join(outDir, `${id}.html`), { force: true });
      removed++;
    }
  }

  const avg = written ? Math.round(bytes / written) : 0;
  console.log(`Game pages: ${wanted.size} games -> ${written} written, ${unchanged} unchanged, ${removed} removed`);
  console.log(`Average page size: ${(avg / 1024).toFixed(1)}KB (approx ${((avg * wanted.size) / 1024 / 1024).toFixed(1)}MB total)`);
  if (removed) console.log(`Stale pages removed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
