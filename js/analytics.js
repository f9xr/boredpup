/* BoredPuP - Google Analytics bootstrap.

   gtag.js itself is loaded from Google's host by the tag block in
   scripts/analytics.mjs; this file is only the dataLayer queue and the config
   call. It is a plain classic script, not a module, so the top-level function
   below is window.gtag the way gtag.js expects to find it.

   The reason it is a file and not the inline <script> block from Google's own
   installation instructions is the Content-Security-Policy. Inline would have
   forced 'unsafe-inline' into script-src across these pages, or a sha256 hash
   of the snippet - and a hash breaks silently the moment anyone reformats the
   block, leaving a page that reports no traffic and gives no error. Two extra
   tags pointing at a file we control is the cheaper deal.

   The measurement id is repeated in scripts/analytics.mjs; scripts/validate.mjs
   fails the build if the two ever disagree, so this stays a checked duplicate
   rather than an unchecked one. */

window.dataLayer = window.dataLayer || [];

function gtag() {
  window.dataLayer.push(arguments);
}

gtag("js", new Date());
gtag("config", "G-XB845YWJVC");