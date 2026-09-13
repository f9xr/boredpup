# BoredPuP

Bored? Play online games for FREE.

Home of thousands of free online video games that can be played on nearly
every phone, tablet, and PC - with no software downloads necessary. Every
game loads instantly in your browser and embeds directly from the
GameMonetize HTML5 library.

Built with a pure static stack - deploy it anywhere (GitHub Pages, Netlify,
Vercel, any static host). No backend required.

## Pages

| Route                       | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `index.html`                | Home - hero, categories, new games, good picks, continue playing |
| `category.html?c=Racing`    | Browse a category (or all games when no `c`)       |
| `game.html?id=37923`        | Play page - embed, fullscreen, walkthrough, related |
| `search.html?q=snake`       | Search titles, tags, and categories (noindex)      |
| `tools.html`                | Webmaster tools: embed generator, feed URLs, random finder |
| `my-games.html`             | Per-device favorites + recently played (noindex)   |
| `pages/about.html`          | About us                                           |
| `pages/parents.html`        | Information for parents                            |
| `pages/terms.html`          | Terms of Service                                   |
| `pages/privacy.html`        | Privacy Policy                                     |
| `pages/contact.html`        | Contact - compose-an-email form                    |

## How the data works

- `scripts/build-feed.mjs` downloads the GameMonetize JSON feed
  (`https://rss.gamemonetize.com/rssfeed.php?format=json…`) and writes:
  - `data/catalog.json` - very slim catalog as rows
    `[id, title, category, tags, thumb]` for all ~5,000 games (~880 KB;
    `url`/`width`/`height` intentionally live in the detail shards)
  - `data/details-<shard>.json` - 32 shards containing
    `{ description, instructions, url, width, height }`, fetched lazily on
    the play page (keeps the shared catalog small)
  - `data/meta.json` - categories + counts
  - `sitemap.xml` - every game, category, and static page
- The front end (`js/data.js`) loads `catalog.json`, caches it in
  `localStorage` for 6 hours, and gracefully falls back to the live
  GameMonetize feed if the snapshot is ever missing.
- Games are embedded as an `<iframe>` in `game.html` using the detail
  shard's `url`, `width`, and `height` (preserved as an aspect ratio so the
  player is fully responsive).
- The GameMonetize walkthrough player (`video.js`) is loaded on the play
  page with the game id, wrapped in a code-window shell.

## Per-device utilities

- Favorites: tap the `♡` on any card; saved in `localStorage` only.
- Recently played: tracked per device, surfaced on Home and `my-games.html`.
- Keyboard shortcuts on the play page: `R` restart, `F` fullscreen.

## PWA / offline

- `manifest.webmanifest` + theme color + apple touch icon make the site
  installable (the icons are generated from `assets/icon*.svg`).
- `sw.js` caches the catalog and app shell (Cache API + localStorage), so
  browsing the catalog works offline after a first visit.

## Refresh the game catalog

```sh
npm run build:feed
```

To point the generated links elsewhere (default `https://boredpup.com`):

```sh
BOREDPUP_BASE_URL=https://your-domain.com npm run build:feed
```

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