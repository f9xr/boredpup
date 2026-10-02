/* BoredPuP - the Mobile Games page.

   Not a category page: js/categories.js folds the provider's category strings
   into 15 canonical genres, and "mobile" is not one of them because it is not a
   genre - it is a device class, and the same game can be both. The list comes
   from data/mobile.json instead, which the build fills with the ids the mobile
   feed returns and the html5 feed does not, so nothing here can duplicate a
   game already reachable from category.html.

   Paging and sorting are the same shape as search.js and category.js rather
   than a shared helper: the three differ in what they put in the query string
   (q, c+sort, sort), and the shared part is smaller than the parameterisation
   would be. */

import { initNav, initFooter, renderGameGrid, renderSkeleton, setCanonical, initPwa } from "./app.js";
import { getMobileGames } from "./data.js";

const PAGE_SIZE = 24;
const PAGE_WINDOW = 2;
/* See the note in category.js: the gap character is U+2026, so comparing it
   against "..." never matched. */
const PAGE_GAP = "…";

const params = new URLSearchParams(window.location.search);
let sortBy = params.get("sort") || "newest";
let page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);

let games = [];
let totalPages = 1;

function applySort(list) {
  if (sortBy === "az") return [...list].sort((a, b) => a[1].localeCompare(b[1]));
  if (sortBy === "za") return [...list].sort((a, b) => b[1].localeCompare(a[1]));
  return list;
}

function updateUrl() {
  const p = new URLSearchParams();
  if (sortBy !== "newest") p.set("sort", sortBy);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  history.replaceState(null, "", `mobile.html${qs ? `?${qs}` : ""}`);
}

function pageUrl(target) {
  const p = new URLSearchParams();
  if (sortBy !== "newest") p.set("sort", sortBy);
  if (target > 1) p.set("page", String(target));
  return `mobile.html?${p.toString()}`;
}

function setCountText() {
  const el = document.getElementById("pageCount");
  if (!el) return;
  el.textContent = `${games.length.toLocaleString()} ${games.length === 1 ? "game" : "games"} built for phones and tablets`;
}

function renderPager() {
  const host = document.getElementById("pager");
  if (!host) return;
  if (totalPages <= 1) {
    host.innerHTML = "";
    return;
  }

  const pages = [];
  const clamp = (n) => Math.min(totalPages, Math.max(1, n));
  for (let i = clamp(page - PAGE_WINDOW); i <= clamp(page + PAGE_WINDOW); i++) pages.push(i);
  if (pages[0] > 1) {
    pages.unshift(1);
    if (pages[1] > 2) pages.splice(1, 0, PAGE_GAP);
  }
  if (pages[pages.length - 1] < totalPages) {
    if (pages[pages.length - 1] < totalPages - 1) pages.push(PAGE_GAP);
    pages.push(totalPages);
  }

  const item = (p, label = String(p), extra = "", disabled = false) => {
    if (disabled) return `<span class="page-btn page-btn-nav disabled" aria-disabled="true">${label}</span>`;
    if (p === PAGE_GAP) return `<span class="page-gap" aria-hidden="true">${label}</span>`;
    const active = p === page ? " active" : "";
    return `<a class="page-btn${active}${extra}" href="${pageUrl(p)}" data-page="${p}"${active ? ' aria-current="page"' : ""}>${label}</a>`;
  };

  const prev = page > 1 ? `<a class="page-btn page-btn-nav" href="${pageUrl(page - 1)}" data-page="${page - 1}" rel="prev" aria-label="Previous page">← Prev</a>` : item(-1, "← Prev", " page-btn-nav", true);
  const next = page < totalPages ? `<a class="page-btn page-btn-nav" href="${pageUrl(page + 1)}" data-page="${page + 1}" rel="next" aria-label="Next page">Next →</a>` : item(-1, "Next →", " page-btn-nav", true);

  host.innerHTML =
    `<span class="page-summary">Page ${page} of ${totalPages}</span>` + prev + pages.map((p) => item(p)).join("") + next;
}

function loadPage() {
  const grid = document.getElementById("grid");
  const sorted = applySort(games);
  totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  page = Math.min(page, totalPages);
  const slice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const flush = () => renderGameGrid(grid, slice);
  if (document.startViewTransition) {
    try { document.startViewTransition(() => { flush(); updateUrl(); }); }
    catch { flush(); updateUrl(); }
  } else {
    flush();
    updateUrl();
  }

  renderPager();
}

function bindPager() {
  const pager = document.getElementById("pager");
  if (!pager) return;
  pager.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-page]");
    if (!link) return;
    e.preventDefault();
    const target = parseInt(link.dataset.page, 10);
    if (!target || target < 1 || target > totalPages || target === page) return;
    page = target;
    const list = document.getElementById("listHead");
    if (list) list.scrollIntoView({ behavior: "smooth", block: "start" });
    loadPage();
  });
}

async function init() {
  initNav();
  setCanonical();
  initPwa();

  const grid = document.getElementById("grid");
  renderSkeleton(grid, PAGE_SIZE);

  try {
    games = await getMobileGames();
  } catch {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="big">Couldn't load the mobile list</div>
        <p>The list is built at deploy time and is briefly unavailable.
           <a class="inline-link" href="category.html">Browse all games</a> in the meantime.</p>
      </div>`;
    setCountText();
    initFooter();
    return;
  }

  if (!games.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="big">No mobile-only games right now</div>
        <p>Every game we carry plays in a phone browser already.
           <a class="inline-link" href="category.html">Browse all games</a>.</p>
      </div>`;
    setCountText();
    initFooter();
    return;
  }

  setCountText();
  loadPage();
  bindPager();

  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) {
    sortSelect.value = sortBy;
    sortSelect.addEventListener("change", () => {
      sortBy = sortSelect.value;
      page = 1;
      loadPage();
    });
  }

  initFooter();
}

init();