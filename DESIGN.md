# BoredPuP - Design System

A dark, editorial theme for a free-games portal. BoredPuP sits on a pure
black canvas with off-white text, a serif display voice, translucent-white
hairlines, and low-opacity atmospheric glows. There are no drop shadows and
no solid accent surfaces - the canvas is the brand, and every game is the
hero.

This file is the single source of truth for `css/style.css`. The stylesheet
header references it; keep the two in sync when tokens change.

---

## Tokens

All tokens live on `:root` in `css/style.css`.

### Colors

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#000000` | Page background. True black, never near-black. |
| `--primary` | `#fcfdff` | Whiitest color; selection + bright CTA labels. |
| `--primary-on` | `#000000` | Label color on top of `--primary`. |
| `--ink` | `#fcfdff` | Primary text; headings, links, chrome. |
| `--body` | `rgba(252,253,255,0.86)` | Long-form body text. |
| `--charcoal` | `rgba(252,253,255,0.7)` | Secondary labels, captions. |
| `--mute` | `#a1a4a5` | Supporting text, placeholders, inactive labels. |
| `--ash` | `#888e90` | Tertiary text, footer copy. |
| `--stone` | `#85898c` | Disabled foreground, play-hint. |
| `--surface-card` | `#0a0a0c` | Standard card surface. |
| `--surface-elevated` | `#101012` | One step up (ghost buttons, pills). |
| `--surface-deep` | `#06060a` | Code windows, player loading well. |
| `--surface-light` | `#f1f7fe` | Pressed primary-button tint. |
| `--hairline` | `rgba(255,255,255,0.06)` | Soft dividers. |
| `--hairline-strong` | `rgba(255,255,255,0.14)` | Structural card/input borders. |
| `--divider-soft` | `rgba(255,255,255,0.04)` | Footer column dividers. |
| `--link` / `--accent-blue` | `#3b9eff` | Inline links, focus ring. |
| `--accent-orange` | `#ff801f` | Warm highlights + `--glow-orange`. |
| `--accent-yellow` | `#ffc53d` | Highlight strokes + `--glow-yellow`. |
| `--accent-green` | `#11ff99` | Status dots + `--glow-green`. |
| `--accent-red` | `#ff2047` | Attention color + `--glow-red`. |

The four glows (`--glow-orange`, `--glow-blue`, `--glow-green`,
`--glow-red`, `--glow-yellow`) are low-opacity radial washes anchored to the
top of select sections. They are backdrop-only - accents are never used as
solid surfaces.

### Typography

Four families loaded from Google Fonts:

- **Instrument Serif** (`--font-display`) - the serif display voice, used for
  hero and section headlines (`display-xxl`/`display-xl`).
- **Inter Tight** (`--font-body`) - marketing body, buttons, subtitles.
- **Inter** (`--font-ui`) - UI labels, captions, headings.
- **Geist Mono** (`--font-mono`) - code wells, embed snippets.

| Token | Style | Use |
|---|---|---|
| `--text-display-xxl` | 400 96px/1 | Home hero headline. |
| `--text-display-xl` | 400 76.8px/1 | Page/section openers. |
| `--text-display-lg` | 400 56px/1.2 Inter Tight | Section titles, stats. |
| `--text-heading-md` | 500 24px/1.5 Inter | Card titles, game titles. |
| `--text-heading-sm` | 500 20px/1.3 Inter | List headers. |
| `--text-subtitle` | 400 20px/1.3 Inter Tight | Hero/page subtitles. |
| `--text-body-lg` | 400 18px/1.5 Inter | Larger prose. |
| `--text-body-md` | 400 16px/1.5 Inter Tight | Default body. |
| `--text-body` | 400 16px/1.6 Inter Tight | Body + form controls. |
| `--text-body-sm` | 400 14px/1.43 Inter | Captions, metadata. |
| `--text-button-md` | 500 14px/1.43 Inter | Button labels. |
| `--text-button-sm` | 500 14px/1.43 Inter Tight | Inline links, pill labels. |
| `--text-caption` | 400 12px/1.5 Inter | Footer, disclosure text. |
| `--text-code-md` | 400 13px/1.6 Geist Mono | Code and embed output. |

### Radii & Spacing

- Radii: `--radius-xs` 4px, `--radius-sm` 6px, `--radius-md` 8px (buttons,
  inputs, code tabs), `--radius-lg` 12px (cards, code windows, player),
  `--radius-xl` 16px, `--radius-full` 9999px (pills, dots).
- Spacing: `--space-xxs` 2px through `--space-xxxl` 48px on a 4/8/16 rhythm,
  plus `--space-section` 96px and `--space-band` 128px for section bands.
- Layout: `--layout-max` 1200px max content width; `--nav-height` 64px.

---

## Surfaces & Elevation

Elevation is expressed with temperature and luminance, never blur:

- Level 0: `--canvas`, full-bleed bands. No border.
- Level 1: `--surface-card` + 1px `--hairline-strong` (game cards, info
  cards, tool panels).
- Level 2: `--surface-elevated` + 1px `--hairline-strong` (buttons,
  pills, code tabs).
- Level 3: `--surface-deep` + 1px `--hairline-strong` (code windows,
  player loading well).
- Level 4: atmospheric glow - one radial wash per `.glow-section`.

Focus visibility is a 3px `--accent-blue` ring via `:focus-visible`.
Form controls drop `outline` and rely on a thickened `--ink`/blue border on
focus. A `.skip-link` sits off-canvas until tabbed to, landing at the top
left of the viewport. Every `<main>` carries `id="main"` as its target.

---

## Components

### Navigation
- `.nav` - 64px bar, `--canvas`, `--hairline` bottom border. Left: wordmark
  (`Bored<span class="logo-muted">PuP</span>`). Center: `<nav class="nav-links">`.
  Right: inline search + primary CTA.
- `.search` - pill input with a leading search icon. Focus thickens the
  border and keeps the focus ring.
- `.nav-burger` - toggles `.mobile-nav`, which is a real `<nav>` with an
  `aria-label`. Mobile nav text fits the 44px minimum touch target on phones.
- The wordmark in the header is a link with `aria-label="BoredPuP home"`; the
  footer logo is the same mark with the same label.

### Buttons (`--radius-md`, 36px tall)
- `.btn-primary` - the one solid bright surface (`--primary`/`--primary-on`).
- `.btn-ghost` - `--surface-elevated` with hairline border.
- `.btn-outline` - `--canvas` with hairline-strong border.
- Sizes: `.btn-lg` for hero CTAs, `.btn-sm` for toolbar actions.
- On phones (`≤425px`) interactive controls (`.fav-btn`) grow to 44×44px.

### Hero
- `.hero` - full-bleed opening band on `--canvas`. `.hero-title` uses
  `--text-display-xxl` (clamps down the breakpoint ladder).
- `.hero-kicker` pairs a green `.status-dot` with a `.badge-pill`.
- No glow inside the hero - the glow opens the sections that follow.

### Game discovery
- `.category-grid` - responsive category cards + `.pill-row` of filter pills
  on the category page.
- `.game-grid` - 5-up game cards at desktop, collapsing to fewer columns
  until 1-up on mobile.
- `.game-card` - `--surface-card` + hairline-strong; `.game-thumb` keeps a
  4:3 ratio. Missing thumbs fall back to `.game-thumb.no-img` placeholder
  plates (no emoji). `.game-badge` shows the top tag; `.fav-btn` is the
  ♡/♥ toggle with `aria-pressed`.
- Skeletons: `.skeleton` shimmering blocks (e.g. `.cat-skel` at 64px) while
  the catalog streams in.

### Player page
- `.player-frame` - responsive game iframe using an inline aspect ratio from
  the detail shards. `.player-toolbar` holds Restart / Fullscreen / Share and
  a live `.play-hint`. `.fullscreen-mode` pins the frame to the viewport.
- Game iframes only ever point at an approved provider URL
  (`safeEmbedUrl` - GameMonetize, `yupi.io/embed/`, `html5.gamedistribution.com`).
- `.info-card` - "How to play" / "About this game" panels (h2 heads).
- `.code-window` - walkthrough shell: `--surface-deep`, traffic-light dots,
  Geist Mono. `#gamemonetize-video` loads the provider walkthrough; a
  timeout + error path swaps in `.walkthrough-empty`.

### Tool page (`developers.html`)
- `.tool-tabs` - ARIA tablist (`role="tab"`, `aria-controls`,
  `aria-selected`), activated by click, Arrow/Home/End keys, and roving
  `tabIndex`.
- `.tool-section` - panels with `role="tabpanel"` linked by
  `aria-labelledby`.
- `.embed-output` - Geist Mono code blocks with copy buttons.
- `.random-slot` - random-finder output.

### Info & prose pages
- `.info-grid` / `.info-card` - 3-up card grid for feature/parenting content
  (2-up at tablet, 1-up at mobile).
- `.prose` - article typography for about/terms/privacy.
- `.contact-row` / `.row-value` - contact and tool list rows.
- `.my-tabs` - Favorites/Recent toggle on `my-games.html`.

### Footer
- `.footer` - `--canvas`, multi-column `.footer-grid` (`Play`, `Categories`
  rendered from the catalog, `About`) then a `.footer-bottom` row with the
  © line, credit, and a green "Game catalog live" status.
- Footer column heads are `h3` to keep the heading hierarchy flat
  (h1 → h2 → h3).

---

## Page rhythm

`hero` → `glow-section` (category/new rows) → `band` feature grid →
`stat-band` (`--space-band` padding) → "Good picks" glow section →
"Continue playing" glow section → `marquee` (featured-on badges) →
`divider` → `footer`.

Each `glow-section` carries exactly one glow color. Sections never stack two
glows; the alternating colors (orange → blue → green → orange → …) give the
page its rhythm.

---

## Responsive behavior

Work from the token ladder, collapsing at coarse breakpoints:

- Tablets `≤1024px`: feature grids 2-up, nav collapses to burger, code-story
  splits stack.
- Mobile `≤767px`: game grids 2-up then 1-up, display sizes clamp
  (96px → 48px), `--space-section` collapses, `.band` stays 128px but
  feature grids go 1-up.
- Phones `≤425px`: all grids 1-up, interactive targets scale to 44px, hero
  `--text-display-xxl` clamps lowest.

```
`prefers-reduced-motion` is honored globally: smooth scroll is disabled and
all transitions/animations (including the `.marquee`) are dropped, while
layout and fade state changes remain intact.
```

---

## Do's and Don'ts

### Do
- Keep the canvas `#000000`. Never drift to near-black.
- Build depth from hairlines + one glow per section, never drop shadows.
- Let the serif display voice carry hero/opening headlines at `line-height: 1`.
- Reserve white solid surfaces for the primary CTA and selection.
- Escape every provider/dynamic string before it touches the DOM.
- Keep iframe URLs on the provider allowlist (`safeEmbedUrl`).

### Don't
- Don't use accent colors as solid button or band surfaces - glows only.
- Don't introduce a second solid brand accent.
- Don't render code outside `.code-window` / `.embed-output`.
- Don't add new heading levels that skip (h1 → h3) on the player page.
- Don't shadow. The system has no drop-shadow language.