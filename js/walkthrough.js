/* BoredPuP - the GameMonetize walkthrough widget, hosted as its own document.

   This page is loaded into a sandboxed iframe WITHOUT allow-same-origin, so it
   runs on an opaque origin and cannot touch the parent document, its storage,
   or its cookies. That is the whole point: api.gamemonetize.com/video.js is
   third-party code and previously ran directly in our page, which meant the
   hand-rolled HTML sanitizer in the old `$(...).append()` shim was no boundary
   at all - the script could simply bypass it.

   The policy that governs this document is the meta CSP in walkthrough.html,
   injected from scripts/csp.mjs (PAGE_CSP): it must allow
   api.gamemonetize.com in script-src and gamemonetize.video in frame-src, or
   the widget below never even loads. */

const params = new URLSearchParams(window.location.search);

window.VIDEO_OPTIONS = {
  gameid: params.get("id") || "",
  width: "100%",
  height: "640px",
  color: "#3b9eff",
  getAds: "true",
};

/* Minimal shim, scoped to this opaque-origin document. Nothing here can reach
   the parent page, so the weak sanitizing the old shim relied on is gone. */
window.$ = (selector) => {
  const el = document.querySelector(selector);
  const api = {
    append(html) {
      if (el) el.insertAdjacentHTML("beforeend", String(html));
      return api;
    },
    remove() {
      if (el) el.remove();
      return api;
    },
  };
  return api;
};

const script = document.createElement("script");
script.src = "https://api.gamemonetize.com/video.js";
script.async = true;
document.head.appendChild(script);

/* video.js appends its own <iframe> into #gamemonetize-video. Tell the parent
   once that has happened, so it stops its timeout instead of replacing a
   working widget with the "no walkthrough" message. The message is posted to
   the embedding origin; e.source checks on the receiving side scope it to this
   frame even though the sandbox gives us an opaque origin. */
let announced = false;
const started = Date.now();
const poll = setInterval(() => {
  if (document.querySelector("#gamemonetize-video iframe")) {
    if (!announced) {
      announced = true;
      window.parent && window.parent.postMessage({ type: "walkthrough-ready" }, "*");
    }
    if (Date.now() - started > 60000) clearInterval(poll);
  } else if (Date.now() - started > 15000) {
    // The script never produced a player; stop polling and let the parent's
    // own timeout render the fallback message.
    clearInterval(poll);
  }
}, 400);
