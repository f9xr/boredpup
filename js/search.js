import { initNav, initFooter, escapeHtml, renderGameGrid, renderSkeleton, setCanonical, initPwa } from "./app.js";
import { getAllGames, searchGames } from "./data.js";

const PAGE_SIZE = 24;
const PAGE_WINDOW = 2;
const params = new URLSearchParams(window.location.search);
const query = (params.get("q") || "").trim();

let allGames = [];
let results = [];
let page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
let totalPages = 1;

function setCountText() {
  const el = document.getElementById("resultsCount");
  if (!query) {
    el.textContent = "Search titles, tags, and categories.";
  } else if (!results.length) {
    el.textContent = `No games match "${query}". Try a different spelling.`;
  } else {
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, results.length);
    el.textContent = `${results.length.toLocaleString()} ${results.length === 1 ? "game" : "games"} match "${query}" (showing ${start}\u2013${end})`;
  }
}

function updateUrl() {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  history.replaceState(null, "", `search.html${qs ? `?${qs}` : ""}`);
}

function pageUrl(target) {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (target > 1) p.set("page", String(target));
  return `search.html?${p.toString()}`;
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
    if (pages[1] > 2) pages.splice(1, 0, "…");
  }
  if (pages[pages.length - 1] < totalPages) {
    if (pages[pages.length - 1] < totalPages - 1) pages.push("…");
    pages.push(totalPages);
  }

  const item = (p, label = String(p), extra = "", disabled = false) => {
    if (disabled) return `<span class="page-btn page-btn-nav disabled" aria-disabled="true">${label}</span>`;
    if (p === "...") return `<span class="page-gap" aria-hidden="true">${p}</span>`;
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
  totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  page = Math.min(page, totalPages);
  const slice = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const flush = () => renderGameGrid(grid, slice);
  if (document.startViewTransition) {
    try { document.startViewTransition(() => { flush(); setCountText(); updateUrl(); }); }
    catch { flush(); setCountText(); updateUrl(); }
  } else {
    flush();
    setCountText();
    updateUrl();
  }

  renderPager();
}

function render() {
  const grid = document.getElementById("grid");
  if (!query) {
    document.title = "Search games - BoredPuP";
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="big">What are you in the mood for?</div>
        <p>Search by title, tag, or category - or <a class="inline-link" href="category.html">browse everything</a>.</p>
      </div>`;
    setCountText();
    return;
  }

  renderSkeleton(grid, PAGE_SIZE);
  document.title = `Search "${query}" - BoredPuP`;

  try {
    results = searchGames(allGames, query);
    page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
    setCountText();
    if (!results.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="big">Nothing found</div>
          <p>No games match "${escapeHtml(query)}". Try fewer words, or clear the filters.</p>
        </div>`;
      renderPager();
      return;
    }
    loadPage();
  } catch {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="big">Search unavailable</div>
        <p>Please refresh to try again.</p>
      </div>`;
  }
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
    loadPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

async function init() {
  initNav();
  setCanonical();
  initPwa();
  const input = document.getElementById("searchInput");
  if (input) input.value = query;

  try {
    allGames = await getAllGames();
  } catch {
    document.getElementById("grid").innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="big">Couldn't load the catalog</div>
        <p>Please refresh the page to try again.</p>
      </div>`;
  }

  render();

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = input.value.trim();
      window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    }
  });

  bindPager();
  initFooter();
}

init();