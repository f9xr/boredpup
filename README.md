# BoredPuP

Bored? Play online games for FREE.

Home of thousands of free online video games that can be played on nearly
every phone, tablet, and PC - with no software downloads necessary. Every
game loads instantly in your browser and embeds directly from the
GameMonetize HTML5 library, with growing secondary libraries from
GameDistribution and yupi.io.

Built with a pure static stack - deploy it anywhere (GitHub Pages, Netlify,
Vercel, any static host). No backend required.

## Pages

| Route                       | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `index.html`                | Home - hero, categories, new games, good picks, continue playing |
| `category.html?c=Racing`    | Browse a category (or all games when no `c`)       |
| `game.html?id=37923`        | Play page - embed, fullscreen, walkthrough, related |
| `search.html?q=snake`       | Search titles, tags, and categories, paginated (noindex) |
| `developers.html`            | Developer tools: embed generator, feed URLs, random finder |
| `my-games.html`             | Per-device favorites + recently played (noindex)   |
| `pages/about.html`          | About us                                           |
| `pages/parents.html`        | Information for parents                            |
| `pages/terms.html`          | Terms of Service                                   |
| `pages/privacy.html`        | Privacy Policy                                     |
| `pages/contact.html`        | Contact - compose-an-email form                    |
| `404.html`                  | Friendly 404 with live search + random picks       |

## How the data works

- `scripts/build-feed.mjs` downloads the GameMonetize JSON feed
  (`https://rss.gamemonetize.com/rssfeed.php?format=json…`) and writes:
  - `data/catalog.json` - very slim catalog as rows
    `[id, title, category, tags, thumb]` for all ~5,600 games (~1 MB;
    `url`/`width`/`height` intentionally live in the detail shards)
  - `data/details-<shard>.json` - 32 shards containing
    `{ description, instructions, url, width, height }`, fetched lazily on
    the play page (keeps the shared catalog small)
  - `data/meta.json` - categories + counts
  - `sitemap.xml` - every game, category, and static page
- `scripts/build-yupi.mjs` scrapes yupi.io's public game sitemaps and
  writes `data/yupi-cache.json` with only frameable games. When present,
  `build-feed.mjs` merges it into the catalog (same 5-element row shape;
  the provider is encoded in the detail `url`).
- `scripts/build-gd.mjs` pulls the GameDistribution wizard RSS API and
  writes `data/gd-cache.json`. Any `data/*-cache.json` file is
  automatically merged by `build-feed.mjs` at catalog time.
- The front end (`js/data.js`) loads `catalog.json`, caches it in
  `localStorage` for 6 hours, and gracefully falls back to the live
  GameMonetize feed if the snapshot is ever missing.
- Games are embedded as an `<iframe>` in `game.html` using the detail
  shard's `url`, `width`, and `height` (preserved as an aspect ratio so the
  player is fully responsive). Only GameMonetize, `yupi.io/embed/`, and
  `html5.gamedistribution.com` URLs are ever allowed into the iframe
  (`safeEmbedUrl`).
- The GameMonetize walkthrough player (`video.js`) is loaded on the play
  page with the game id, wrapped in a code-window shell. Games from other
  providers show a friendly walkthrough-unavailable note instead.

## Per-device utilities

- Favorites: tap the `♡` on any card; saved in `localStorage` only.
- Recently played: tracked per device, surfaced on Home and `my-games.html`.
- Keyboard shortcuts on the play page: `R` restart, `F` fullscreen.

## PWA / offline

- `manifest.webmanifest` + theme color + apple touch icon make the site
  installable (the icons are generated from `assets/icon*.svg`).
- `sw.js` caches the catalog and app shell (Cache API + localStorage), so
  browsing the catalog works offline after a first visit. Bump the
  `CACHE`/`RUNTIME` version in `sw.js` whenever the shell or catalog
  format changes.
- A floating "Install BoredPuP app" button appears in browsers that fire
  `beforeinstallprompt` and dismisses itself after `appinstalled`.

## Refresh the game catalog

```sh
npm run build:feed   # GameMonetize feed + any existing data/*-cache.json
npm run build:all    # refresh yupi + GD caches, then merge (=> build:feed)
```

`build:yupi` curates up to `BOREDPUP_YUPI_COUNT` (default 120) frameable
games from yupi.io; `build:gd` pulls up to `BOREDPUP_GD_COUNT` (default
500) from GameDistribution. To point the generated links elsewhere
(default `https://boredpup.com`):

```sh
BOREDPUP_BASE_URL=https://your-domain.com npm run build:all
```

A GitHub Actions workflow (`.github/workflows/refresh-feed.yml`) runs
`npm run build:all` nightly and commits any data changes.

## Preview locally

```sh
npm run serve
# → http://localhost:8080
```

## Design

The UI follows `DESIGN.md` - a dark, editorial system: pure black canvas,
off-white serif display type, translucent-white hairline borders, and
low-opacity atmospheric glows. No drop shadows anywhere.

## Monetization

- `ads.txt` declares the GameMonetize / Google publishers.
- Walkthrough videos on each play page serve GameMonetize ads
  (`getAds: "true"`), tracked by domain - no publisher ID needed.