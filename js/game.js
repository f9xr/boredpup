import { initNav, initFooter, escapeHtml, renderGameGrid, renderSkeleton, toast, sample, setCanonical, initPwa, safeEmbedUrl, providerOf } from "./app.js";
import { getGame, getDetails, getAllGames, markRecent } from "./data.js";

const params = new URLSearchParams(window.location.search);
const gameId = params.get("id");

const playerFrame = document.getElementById("playerFrame");
const iframeSlot = document.getElementById("iframeSlot");
const activeGameUrl = { current: null };

const PROVIDER_LABELS = {
  gamemonetize: "GameMonetize",
  yupi: "yupi.io",
  gamedistribution: "GameDistribution",
};

function buildIframe(slot, url, w, h) {
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.title = currentGame ? `${currentGame[1]} - play free online` : "Game";
  iframe.setAttribute("width", "100%");
  iframe.setAttribute("height", "100%");
  iframe.setAttribute("allow", "autoplay; fullscreen; encrypted-media; accelerometer; gyroscope; picture-in-picture; clipboard-write; gamepad");
  iframe.setAttribute("allowfullscreen", "");
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock allow-presentation allow-downloads"
  );
  iframe.style.aspectRatio = `${w} / ${h}`;
  iframe.style.background = "#000";
  slot.innerHTML = "";
  slot.style.aspectRatio = `${w} / ${h}`;
  slot.appendChild(iframe);
  activeGameUrl.current = url;
  return iframe;
}

let currentGame = null;
let currentDetails = null;

function restartGame() {
  if (!activeGameUrl.current || !currentDetails) return;
  buildIframe(iframeSlot, activeGameUrl.current, currentDetails.width, currentDetails.height);
  toast("Game restarted");
}

function toggleFullscreen() {
  const fsEl = document.fullscreenElement;
  if (fsEl) {
    if (document.exitFullscreen) document.exitFullscreen();
    playerFrame.classList.remove("fullscreen-mode");
    return;
  }
  if (playerFrame.requestFullscreen) {
    playerFrame.requestFullscreen().catch(() => playerFrame.classList.add("fullscreen-mode"));
  } else {
    playerFrame.classList.add("fullscreen-mode");
  }
}

function bindShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    // Do not steal keys from a text field, a contenteditable region, or the
    // user's own browser/OS shortcuts. Ctrl+R is reload; ⌘R is reload; Alt+F
    // moves focus between frames. Plain "r" alone is the only safe trigger.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const key = e.key.toLowerCase();
    if (key === "r") {
      e.preventDefault();
      restartGame();
    } else if (key === "f") {
      e.preventDefault();
      toggleFullscreen();
    }
  });
}

function injectVideoJsonLd({ id, title, category, tags, thumb, url, description }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: title,
    description: description || `Play ${title} - a free ${category} game, online instantly on BoredPuP.`,
    genre: category,
    url: window.location.href,
    image: thumb || undefined,
    keywords: Array.isArray(tags) ? tags.slice(0, 10) : [],
    applicationCategory: "Game",
    inLanguage: "en",
    browserRequirements: "Any modern browser with HTML5 support",
    publisher: {
      "@type": "Organization",
      name: "BoredPuP",
      url: new URL("index.html", window.location.href).href,
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
  if (url) ld.embedUrl = url;
  const block = document.createElement("script");
  block.type = "application/ld+json";
  block.id = "gameLd";
  block.textContent = JSON.stringify(ld);
  document.head.appendChild(block);
}

async function shareLink() {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied to clipboard");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("Link copied to clipboard");
  }
}

/* The GameMonetize walkthrough widget used to be injected straight into this
   document, which required shipping a jQuery-compatible `$(...).append()`
   shim with a hand-rolled HTML sanitizer as a guard.

   That guard was not a guard. The sanitizer regex was /(?:on\w+=|<\s*script|
   <object|<\s*embed)/i, and \w does not match whitespace, so "onerror\n=",
   "onerror =" and "javascript:" URLs all passed it. More fundamentally, the
   injected api.gamemonetize.com/video.js ran in *our* origin, so it could
   bypass our own shim whenever it liked - sanitizing the output of a script
   that already has full DOM access is not a boundary.

   The widget now lives in walkthrough.html, loaded into an iframe sandboxed
   WITHOUT allow-same-origin, so it gets an opaque origin and cannot reach this
   document, our storage, or our cookies. A separate file rather than srcdoc
   also means the frame has its own CSP instead of inheriting and being unable
   to loosen ours. */
const WALKTHROUGH_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

function injectWalkthrough(title) {
  const host = document.getElementById("walkthroughSlot");
  if (!host) return;

  const frame = document.createElement("iframe");
  frame.title = "Game walkthrough";
  frame.className = "walkthrough-frame";
  frame.setAttribute("sandbox", WALKTHROUGH_SANDBOX);
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.setAttribute("loading", "lazy");
  frame.setAttribute("allow", "autoplay; fullscreen; encrypted-media; picture-in-picture");
  frame.src = `walkthrough.html?id=${encodeURIComponent(gameId || "")}`;

  host.innerHTML = "";
  host.appendChild(frame);

  // If the widget never produces a player, say so instead of leaving a gap.
  let settled = false;
  setTimeout(() => {
    if (settled) return;
    settled = true;
    showWalkthroughMessage(title);
  }, 9000);
}

function showWalkthroughMessage(title) {
  const slot = document.getElementById("walkthroughSlot");
  if (!slot) return;
  slot.innerHTML = `
    <div class="walkthrough-empty">
      No walkthrough yet for this game - but ${escapeHtml(title)} is ready to play above.
      New walkthroughs are added by our editors daily.
    </div>`;
}

async function renderRelated() {
  const grid = document.getElementById("relatedGrid");
  if (!grid) return;
  renderSkeleton(grid, 10);
  const all = await getAllGames();
  if (!currentGame) return;
  // One pass, not two. This used to run two full filters over all 5,621 rows
  // on every play-page view, then concatenated two samples and sliced to 10 -
  // which meant the "rest" sample was discarded outright whenever the
  // same-category sample was already full, so the second half was wasted work.
  const sameCat = [];
  const rest = [];
  for (const g of all) {
    if (g[0] === currentGame[0]) continue;
    (g[2] === currentGame[2] ? sameCat : rest).push(g);
  }
  const picks = [...sample(sameCat, 8), ...sample(rest, 8)].slice(0, 10);
  const title = document.getElementById("relatedTitle");
  if (title) title.textContent = sameCat.length ? `More ${currentGame[2]} games` : "More to play";
  renderGameGrid(grid, picks);
}

function setMeta(selector, content) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute("content", content);
}

async function render() {
  const crumbs = document.querySelector(".crumbs");

  if (!gameId) {
    fail();
    return;
  }

  const game = await getGame(gameId);
  if (!game) {
    fail();
    return;
  }
  currentGame = game;

  const id = game[0];
  const title = game[1];
  const category = game[2];
  const tags = Array.isArray(game[3]) ? game[3] : [];
  const thumb = game[4];

  const details = await getDetails(id);
  currentDetails = details;
  const url = details ? safeEmbedUrl(details.url) : null;
  const provider = url ? providerOf(url) : null;
  const w = details ? details.width : 800;
  const h = details ? details.height : 600;
  if (!url) {
    fail();
    return;
  }

  markRecent(id, title);

  setMeta('meta[name="description"]', `Play ${title} - a free ${category} game, online instantly on BoredPuP. No downloads, no sign-ups.`);
  setMeta("#ogTitle", `${title} - Play free online`);
  setMeta("#ogDesc", `Play ${title}, a free ${category} game, in your browser right now on BoredPuP.`);
  setMeta("#ogImage", thumb);
  setMeta("#ogUrl", window.location.href);
  setMeta("#twCard", "summary_large_image");
  setMeta("#twTitle", `${title} - Play free online`);
  setMeta("#twDesc", `Play ${title}, a free ${category} game, right now on BoredPuP.`);
  setMeta("#twImg", thumb);
  // game.html ships og:image:width/height as 1200x630 for the default card, but
  // the provider thumbnail swapped in above is 512x384. Leaving the declared
  // dimensions stale on every single game page is a lie the unfurlers read.
  setMeta("#ogImageW", "512");
  setMeta("#ogImageH", "384");
  setMeta("#twImageW", "512");
  setMeta("#twImageH", "384");
  document.title = `${title} - Play Free Online on BoredPuP`;
  setCanonical();

  crumbs.innerHTML = `
    <a href="index.html">Home</a>
    <span aria-hidden="true">/</span>
    <a href="category.html?c=${encodeURIComponent(category)}">${escapeHtml(category)}</a>
    <span aria-hidden="true">/</span>
    <span>${escapeHtml(title)}</span>`;

  document.getElementById("gameTitle").textContent = `${title} - free ${category} game`;
  document.getElementById("tagRow").innerHTML = tags
    .slice(0, 8)
    .map((t) => `<a class="badge-pill" href="search.html?q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`)
    .join("");

  buildIframe(iframeSlot, url, w, h);

  const hint = document.querySelector(".play-hint");
  hint.textContent = `Playing ${title} · ${w}×${h} · loaded from ${PROVIDER_LABELS[provider] || "GameMonetize"}`;

  const instrEl = document.getElementById("instructions");
  const aboutEl = document.getElementById("description");
  if (details && details.instructions) {
    document.getElementById("howToCard").style.display = "";
    instrEl.textContent = details.instructions;
  } else {
    document.getElementById("howToCard").style.display = "none";
  }
  if (details && details.description) {
    document.getElementById("aboutCard").style.display = "";
    aboutEl.textContent = details.description;
  } else {
    document.getElementById("aboutCard").style.display = "none";
  }

  injectVideoJsonLd({
    id,
    title,
    category,
    tags,
    thumb,
    url,
    description: details ? details.description : "",
  });

  if (provider === "gamemonetize") {
    injectWalkthrough(title);
  } else {
    showWalkthroughMessage(title);
  }
  renderRelated();
}

function fail() {
  document.getElementById("notFound").style.display = "";
  document.getElementById("playerShell").style.display = "none";
  document.title = "Game not found - BoredPuP";
}

function bindToolbar() {
  const refresh = document.getElementById("refreshBtn");
  const full = document.getElementById("fullBtn");
  const share = document.getElementById("shareBtn");
  if (refresh) refresh.addEventListener("click", restartGame);
  if (full) full.addEventListener("click", toggleFullscreen);
  if (share) share.addEventListener("click", shareLink);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) playerFrame.classList.remove("fullscreen-mode");
  });
}

initNav();
bindToolbar();
bindShortcuts();
initPwa();
render();
initFooter();