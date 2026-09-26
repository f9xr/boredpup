/* BoredPuP - category taxonomy.

   The upstream providers emit 42 distinct category strings, many of which are
   near-duplicates of each other: Puzzles (1569) vs Puzzle (116), Racing (312)
   vs Racing & Driving (24), Shooting (315) vs Shooter (4), Board (1) vs
   Boardgames (11). Every one of those was its own crawlable, indexable
   category page, so they cannibalised each other in search results.

   This module folds them into 15 canonical categories. Imported by the build
   (scripts/build-feed.mjs) and by the client (js/category.js) so the two agree. */

/* Canonical name -> every provider string that maps onto it.
   Keys are lower-cased; the provider's exact casing is normalised away. */
const ALIASES = {
  Puzzles: ["puzzles", "puzzle", "jigsaw", "bejeweled", "quiz", "mahjong & connect", "educational"],
  Hypercasual: ["hypercasual", "casual", "clicker", ".io", "art"],
  Arcade: ["arcade", "2 player", "battle", "fighting", "strategy"],
  Adventure: ["adventure"],
  Shooting: ["shooting", "shooter"],
  Racing: ["racing", "racing & driving"],
  Sports: ["sports", "soccer", "football", "basketball"],
  Girls: ["girls", "dress-up", "care"],
  Boys: ["boys"],
  Action: ["action", "agility"],
  "Match-3": ["match-3", "match 3", "merge", "bubble shooter"],
  Cards: ["cards", "card", "board", "boardgames"],
  Multiplayer: ["multiplayer"],
  "3D": ["3d", "simulation"],
  Cooking: ["cooking"],
};

const LOOKUP = new Map();
for (const [canonical, aliases] of Object.entries(ALIASES)) {
  LOOKUP.set(canonical.toLowerCase(), canonical);
  for (const alias of aliases) LOOKUP.set(alias.toLowerCase(), canonical);
}

export const FALLBACK_CATEGORY = "Arcade";

/* The canonical categories, most-used first for presentation. */
export const CANONICAL_CATEGORIES = Object.keys(ALIASES);

export function canonicalCategory(name) {
  const key = String(name ?? "").trim().toLowerCase();
  if (!key) return FALLBACK_CATEGORY;
  return LOOKUP.get(key) || FALLBACK_CATEGORY;
}

/* True when the string is already one of the canonical names, so callers can
   avoid redirect loops. */
export function isCanonical(name) {
  const key = String(name ?? "").trim().toLowerCase();
  return CANONICAL_CATEGORIES.some((c) => c.toLowerCase() === key);
}
