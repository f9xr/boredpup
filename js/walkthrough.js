/* BoredPuP - the GameMonetize walkthrough widget, hosted as its own document.

   This page is loaded into a sandboxed iframe WITHOUT allow-same-origin, so it
   runs on an opaque origin and cannot touch the parent document, its storage,
   or its cookies. That is the whole point: api.gamemonetize.com/video.js is
   third-party code and previously ran directly in our page, which meant the
   hand-rolled HTML sanitizer in the old `$(...).append()` shim was no boundary
   at all - the script could simply bypass it.

   Its own CSP below is deliberately scoped: it allows the GameMonetize script
   and nothing else. */

import { initNav, initFooter } from "./app.js";

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

/* The parent polls for an iframe/video to know the widget produced something. */
if (document.getElementById("navBurger")) {
  initNav();
  initFooter();
}
