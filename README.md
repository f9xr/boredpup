# BoredPuP

Bored? Play online games for FREE.

Home of thousands of free online video games that can be played on nearly
every phone, tablet, and PC — with no software downloads necessary. Every
game loads instantly in your browser and embeds directly from the
GameMonetize HTML5 library.

Built with a pure static stack — deploy it anywhere (GitHub Pages, Netlify,
Vercel, any static host). No backend required.

## Pages

| Route                    | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `index.html`             | Home — hero, categories, new games, good picks     |
| `category.html?c=Racing` | Browse a category (or all games when no `c`)       |
| `game.html?id=37923`     | Play page — embed, fullscreen, walkthrough, related|
| `search.html?q=snake`    | Search titles, tags, and categories                |

## How the data works

- `scripts/build-feed.mjs` downloads the GameMonetize JSON feed
  (`https://rss.gamemonetize.com/rssfeed.php?format=json…`) and writes:
  - `data/catalog.json` — slim catalog (id, title, category, tags, thumb,
    width, height, embed URL) for all ~5,000 games
  - `data/details-<shard>.json` — 32 shards of descriptions/instructions,
    fetched lazily on the play page
  - `data/meta.json` — categories + counts
  - `sitemap.xml` — every game, category, and static page
- The front end (`js/data.js`) loads `catalog.json`, caches it in
  `localStorage` for 6 hours, and gracefully falls back to the live
  GameMonetize feed if the snapshot is ever missing.
- Games are embedded as an `<iframe>` in `game.html` using the feed's
  `url`, `width`, and `height` (preserved as an aspect ratio so the player
  is fully responsive).
- The GameMonetize walkthrough player (`video.js`) is loaded on the play
  page with the game id, wrapped in a code-window shell.

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

The UI follows `DESIGN.md` — a dark, editorial system: pure black canvas,
off-white serif display type, translucent-white hairline borders, and
low-opacity atmospheric glows. No drop shadows anywhere.

## Monetization

- `ads.txt` declares the GameMonetize / Google publishers.
- Walkthrough videos on each play page serve GameMonetize ads
  (`getAds: "true"`), tracked by domain — no publisher ID needed.