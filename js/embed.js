/* BoredPuP - embed provider allowlist.
   Single source of truth for which hosts may be framed. Imported by the
   runtime (js/app.js, js/game.js) AND by the build (scripts/build-feed.mjs),
   so a provider can never be framed at runtime but unvalidated in the data,
   or the reverse. */

export function isAllowedProvider(hostname, pathname) {
  const host = String(hostname).toLowerCase();
  if (/^(html5\.)?gamemonetize\.(co|com)$/i.test(host)) return true;
  if (host === "yupi.io" && /^\/embed\//i.test(pathname || "")) return true;
  if (host === "html5.gamedistribution.com") return true;
  return false;
}

/* Boolean form, for validating untrusted rows at build time. */
export function isAllowedEmbedUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && isAllowedProvider(u.hostname, u.pathname);
  } catch {
    return false;
  }
}

/* Returns a normalised href, or null if the URL must not be framed. */
export function safeEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (!isAllowedProvider(u.hostname, u.pathname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

export function providerOf(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (/^(html5\.)?gamemonetize\.(co|com)$/i.test(host)) return "gamemonetize";
    if (host === "yupi.io") return "yupi";
    if (host === "html5.gamedistribution.com") return "gamedistribution";
  } catch {
    /* ignore */
  }
  return null;
}
