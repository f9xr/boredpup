/* BoredPuP - the single definition of the site Content-Security-Policy.

   Imported by scripts/inject-csp.mjs (which injects it into the hand-written
   pages) and by scripts/build-game-pages.mjs (which bakes it into the 5,621
   generated game pages). Keeping one definition is the point: a generated page
   with a different policy from a hand-written one would be invisible in review
   and would break in a way that looks like a third-party bug.

   Host lists are precise rather than wildcarded, which is what makes a CSP
   worth having. Thumbnails come from exactly three hosts; every badge host is
   named.

   It is delivered as <meta http-equiv> because the static host gives no header
   control. Two consequences are spec, not choice, and are documented in
   inject-csp.mjs: frame-ancestors and report-uri are ignored in meta-delivered
   CSP, so clickjacking protection and violation reporting both have to come
   from a real header if the host ever supports one. */

export const SITE_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // No 'unsafe-inline': the inline <script type="module"> blocks were extracted
  // to js/notfound.js and js/contact.js, and the generated inline onerror
  // attribute was replaced with a delegated listener, so every executable
  // script is same-origin and external.
  "script-src 'self'",
  // The markup carries inline style="" attributes, so this one stays loose.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://img.gamemonetize.com https://img.gamedistribution.com https://yupi.io https://shipthing.com https://1000tools.best https://smolsaas.com https://smolhunt.com https://api.producthunt.com https://racoondr.com https://launchstag.com",
  // The live-feed fallback in js/data.js.
  "connect-src 'self' https://rss.gamemonetize.com",
  "frame-src 'self' https://html5.gamemonetize.com https://gamemonetize.co https://gamemonetize.com https://yupi.io https://html5.gamedistribution.com",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export const CSP_TAG = `<meta http-equiv="Content-Security-Policy" content="${SITE_CSP}">`;
