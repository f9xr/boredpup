/* BoredPuP - the single definition of the Google Analytics tag.

   scripts/inject-analytics.mjs puts the tag on the hand-written pages and
   scripts/validate.mjs checks it is there and that the id matches the one in
   js/analytics.js. One definition, three consumers, no drift.

   Scope is a decision, not an oversight: the 15 hand-written pages get the tag,
   the 6,704 generated pages under g/ do not. The generated pages carry the
   tighter SITE_CSP with script-src 'self', and tracking every one of them would
   have meant widening that policy across the entire directory. Game pageviews
   are therefore not counted - if that trade is ever revisited, it belongs in
   scripts/csp.mjs and scripts/build-game-pages.mjs, not here.

   The block is delimited by the marker comment because the injector has to be
   able to find and rewrite it: hand-written pages in pages/ need ../js/analytics.js
   while the root pages need js/analytics.js, and a page that moved should be
   corrected rather than skipped. */

export const ANALYTICS_ID = "G-XB845YWJVC";

/* prefix is the relative hop from the page to the site root, "" or "../". */
export function analyticsTags(prefix = "") {
  return [
    `<!-- Google Analytics (${ANALYTICS_ID}) -->`,
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}"></script>`,
    `<script src="${prefix}js/analytics.js"></script>`,
  ].join("\n  ");
}

export function analyticsBlock(prefix = "") {
  return `\n  ${analyticsTags(prefix)}\n`;
}

/* Matches an already-injected block, with or without the js path, so the
   injector can replace rather than duplicate. */
export function analyticsBlockRe() {
  return new RegExp(
    String.raw`\s*<!-- Google Analytics \(${ANALYTICS_ID}\) -->[\s\S]*?js/analytics\.js"></script>`
  );
}