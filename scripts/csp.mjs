/* BoredPuP - the single definition of the site Content-Security-Policy.

   Imported by scripts/inject-csp.mjs (which injects it into the hand-written
   pages) and by scripts/build-game-pages.mjs (which bakes it into the 6,704
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
   from a real header if the host ever supports one.

   There are now two outputs. The Grow.me faves widget is loaded by the 15
   hand-written pages only, so those need 'unsafe-inline' and a handful of
   third-party hosts, while the 6,704 generated game pages do not and keep the
   tighter policy. Both are built from the one list below, and WIDGET_HOSTS is
   the only difference between them, so the delta stays reviewable in one place
   rather than drifting across two copies of a policy. */

const DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // On a generated game page every executable script is same-origin and
  // external: the inline <script type="module"> blocks were extracted to
  // js/notfound.js and js/contact.js, and the generated inline onerror
  // attribute was replaced with a delegated listener. The hand-written pages
  // give this up, and only these, because Grow.me ships its loader as an inline
  // snippet - see WIDGET_HOSTS.
  // googletagmanager.com is gtag.js, loaded by the tag in scripts/analytics.mjs
  // on the hand-written pages. The generated pages under g/ never load it; the
  // host is in the base policy because keeping a third shared list for one host
  // would be more confusing than the unused entry.
  "script-src 'self' https://www.googletagmanager.com",
  // The markup carries inline style="" attributes, so this one stays loose.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // google-analytics.com is in img-src as well as connect-src: GA4 keeps a
  // display-pixel fallback for browsers where sendBeacon/fetch are blocked.
  "img-src 'self' data: https://img.gamemonetize.com https://img.gamedistribution.com https://yupi.io https://shipthing.com https://1000tools.best https://smolsaas.com https://smolhunt.com https://api.producthunt.com https://racoondr.com https://launchstag.com https://www.google-analytics.com",
  // The live-feed fallback in js/data.js, then Google's two collection
  // endpoints: region1.google-analytics.com is where GA4 actually sends hits
  // for most of the world, and www.googletagmanager.com answers its own config
  // and signal requests made by gtag.js.
  "connect-src 'self' https://rss.gamemonetize.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com",
  "frame-src 'self' https://html5.gamemonetize.com https://gamemonetize.co https://gamemonetize.com https://yupi.io https://html5.gamedistribution.com",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "upgrade-insecure-requests",
];

/* Appended to the directives above for the pages carrying the Grow.me widget.
   Every host here was read out of the widget's own bundle
   (faves.grow.me/main.js -> app.<version>.js) rather than guessed, and each one
   is load-bearing:

     faves.grow.me         main.js and app.<version>.js, plus the relative
                           chunks the app imports dynamically
     cdn.prod.euid.eu      the EUID identity SDK, loaded as a script, and the
                           API it talks to
     api.grow.me           site config, widget version, location privacy info,
                           refresh token and interaction data
     some.growplow.events  the Snowplow behavioural analytics collector
     urls.grow.me          grow.me short links
     img.grow.me           image proxy, avatars and print-page artwork
     app.grow.me           the login iframe
     print.grow.me         the print/PDF frame

   'unsafe-inline' is the price of accepting the vendor snippet verbatim, and it
   is scoped to this delta rather than the base policy. If it stops being worth
   it, move the snippet to js/grow-faves.js, drop 'unsafe-inline' and allow a
   hash instead - do not leave the loader inline and the policy strict, which
   fails silently with no widget and no console error worth reading. */
const WIDGET_HOSTS = {
  "script-src": ["'unsafe-inline'", "https://faves.grow.me", "https://cdn.prod.euid.eu"],
  "connect-src": [
    "https://api.grow.me",
    "https://cdn.prod.euid.eu",
    "https://some.growplow.events",
    "https://urls.grow.me",
  ],
  "img-src": ["https://img.grow.me"],
  "frame-src": ["https://app.grow.me", "https://print.grow.me"],
};

export const SITE_CSP = DIRECTIVES.join("; ");

export const PAGE_CSP = DIRECTIVES.map((d) => {
  const extra = WIDGET_HOSTS[d.split(" ")[0]];
  return extra ? `${d} ${extra.join(" ")}` : d;
}).join("; ");

export const CSP_TAG = `<meta http-equiv="Content-Security-Policy" content="${SITE_CSP}">`;
export const PAGE_CSP_TAG = `<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">`;
