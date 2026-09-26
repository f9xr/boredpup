/* BoredPuP - detail shard addressing.
   Imported by BOTH the browser (js/data.js) and the build
   (scripts/build-feed.mjs) so the two can never drift apart. If they did, every
   detail lookup would miss and every game page would fail - silently, with no
   test guarding it. scripts/validate.mjs asserts they agree. */

export const DETAIL_SHARDS = 32;

/* FNV-1a, 32-bit.
   The previous hash was the classic h*31 Java string hash, which is very
   nearly linear over the short, mostly-sequential numeric ids GameMonetize
   hands out. `id % 32` was therefore effectively `id % 32`, and the shards came
   out 21x unbalanced: 18 entries in the smallest, 379 in the largest, so a
   single unlucky game meant a 216KB download before the iframe could appear.
   FNV-1a avalanches, so sequential ids spread evenly. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function shardOf(id) {
  return hashString(String(id)) % DETAIL_SHARDS;
}
