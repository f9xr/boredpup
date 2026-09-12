import { initNav, initFooter, escapeHtml, renderGameGrid, renderSkeleton, toast, sample } from "./app.js";
import { getGame, getDetails, getAllGames } from "./data.js";

const params = new URLSearchParams(window.location.search);
const gameId = params.get("id");

const playerFrame = document.getElementById("playerFrame");
const iframeSlot = document.getElementById("iframeSlot");
const activeGameUrl = { current: null };

function safeEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (!/^(html5\.)?gamemonetize\.(co|com)$/i.test(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

function buildIframe(slot, url, w, h) {
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.title = "Game";
  iframe.setAttribute("width", "100%");
  iframe.setAttribute("height", "100%");
  iframe.setAttribute("allow", "autoplay; fullscreen; encrypted-media; accelerometer; gyroscope; picture-in-picture");
  iframe.setAttribute("allowfullscreen", "");
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.style.aspectRatio = `${w} / ${h}`;
  iframe.style.background = "#000";
  slot.innerHTML = "";
  slot.style.aspectRatio = `${w} / ${h}`;
  slot.appendChild(iframe);
  activeGameUrl.current = url;
  return iframe;
}

function restartGame() {
  if (!activeGameUrl.current) return;
  buildIframe(iframeSlot, activeGameUrl.current, currentGame[5], currentGame[6]);
  toast("Game restarted");
}

let currentGame = null;

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

function injectWalkthrough(title) {
  const host = document.getElementById("walkthroughSlot");
  if (!host) return;

  ensureJqueryShim();

  window.VIDEO_OPTIONS = {
    gameid: gameId,
    width: "100%",
    height: "480px",
    color: "#3b9eff",
    getAds: "true",
  };

  const script = document.createElement("script");
  script.src = "https://api.gamemonetize.com/video.js";
  script.id = "gamemonetize-video-api";
  script.async = true;
  script.onerror = () => {
    showWalkthroughMessage(title);
  };
  document.head.appendChild(script);

  setTimeout(() => {
    const box = document.getElementById("gamemonetize-video");
    if (box && !box.querySelector("iframe") && !box.querySelector("video") && box.childElementCount === 0) {
      showWalkthroughMessage(title);
    }
  }, 4500);
}

function ensureJqueryShim() {
  if (window.$) return;
  window.$ = (selector) => {
    const el = document.querySelector(selector);
    const api = {
      el,
      append(html) {
        if (el) el.insertAdjacentHTML("beforeend", html);
        return api;
      },
      remove() {
        if (el) el.remove();
        return api;
      },
    };
    return api;
  };
}

function showWalkthroughMessage(title) {
  const slot = document.getElementById("walkthroughSlot");
  if (!slot) return;
  slot.innerHTML = `
    <div class="walkthrough-empty">
      No walkthrough yet for this game — but ${escapeHtml(title)} is ready to play above.
      New walkthroughs are added by our editors daily.
    </div>`;
}

async function renderRelated() {
  const grid = document.getElementById("relatedGrid");
  renderSkeleton(grid, 10);
  const all = await getAllGames();
  const sameCat = all.filter((g) => g[2] === currentGame[2] && g[0] !== currentGame[0]);
  const rest = all.filter((g) => g[2] !== currentGame[2] && g[0] !== currentGame[0]);
  const picks = [...sample(sameCat, 10), ...sample(rest, 10)].slice(0, 10);
  const title = document.getElementById("relatedTitle");
  title.textContent = sameCat.length ? `More ${currentGame[2]} games` : "More to play";
  renderGameGrid(grid, picks);
}

async function render() {
  const titleEl = document.title;
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
  const w = game[5];
  const h = game[6];
  const rawUrl = game[7];

  const url = safeEmbedUrl(rawUrl);
  if (!url) {
    fail();
    return;
  }

  document.querySelector('meta[name="description"]').setAttribute("content", `Play ${title} — a free ${category} game, online instantly on BoredPuP. No downloads, no sign-ups.`);
  document.querySelector("#ogTitle").setAttribute("content", `${title} — Play free online`);
  document.querySelector("#ogDesc").setAttribute("content", `Play ${title}, a free ${category} game, in your browser right now on BoredPuP.`);
  if (thumb) document.querySelector("#ogImage").setAttribute("content", thumb);
  document.title = `${title} — Play Free Online on BoredPuP`;

  crumbs.innerHTML = `
    <a href="index.html">Home</a>
    <span aria-hidden="true">/</span>
    <a href="category.html?c=${encodeURIComponent(category)}">${escapeHtml(category)}</a>
    <span aria-hidden="true">/</span>
    <span>${escapeHtml(title)}</span>`;

  document.getElementById("gameTitle").textContent = `${title} — free ${category} game`;
  document.getElementById("tagRow").innerHTML = tags
    .slice(0, 8)
    .map((t) => `<a class="badge-pill" href="search.html?q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`)
    .join("");

  buildIframe(iframeSlot, url, w, h);

  const hint = document.querySelector(".play-hint");
  hint.textContent = `Playing ${title} · ${w}×${h} · loaded from GameMonetize`;

  const details = await getDetails(id);
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

  injectWalkthrough(title);
  renderRelated();
  void titleEl;
}

function fail() {
  document.getElementById("notFound").style.display = "";
  document.getElementById("playerShell").style.display = "none";
  document.title = "Game not found — BoredPuP";
}

function bindToolbar() {
  document.getElementById("refreshBtn").addEventListener("click", restartGame);
  document.getElementById("fullBtn").addEventListener("click", toggleFullscreen);
  document.getElementById("shareBtn").addEventListener("click", shareLink);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) playerFrame.classList.remove("fullscreen-mode");
  });
}

initNav();
bindToolbar();
render();
initFooter();