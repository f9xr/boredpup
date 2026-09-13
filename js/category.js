import { initNav, initFooter, renderCategoryPills, renderGameGrid, renderSkeleton, setCanonical, initPwa } from "./app.js";
import { getAllGames, getCategories } from "./data.js";

const PAGE_SIZE = 24;
const PAGE_WINDOW = 2;

const params = new URLSearchParams(window.location.search);
const category = params.get("c") || null;

let allLoaded = [];
let filtered = [];
let sortBy = params.get("sort") || "newest";
let page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
let totalPages = 1;

function applySort(list) {
  const arr = [...list];
  if (sortBy === "az") arr.sort((a, b) => a[1].localeCompare(b[1]));
  else if (sortBy === "za") arr.sort((a, b) => b[1].localeCompare(a[1]));
  return arr;
}

function updateUrl() {
  const p = new URLSearchParams();
  if (category) p.set("c", category);
  if (sortBy !== "newest") p.set("sort", sortBy);
  if (page > 1) p.set("page", String(page));
  const path = window.location.pathname.includes(".html")
    ? window.location.pathname.split("/").pop()
    : "category.html";
  const qs = p.toString();
  history.replaceState(null, "", `${path}${qs ? `?${qs}` : ""}`);
}

function pageUrl(target) {
  const p = new URLSearchParams();
  if (category) p.set("c", category);
  if (sortBy !== "newest") p.set("sort", sortBy);
  if (target > 1) p.set("page", String(target));
  const qs = p.toString();
  return `${qs ? `?${qs}` : ""}`;
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
    if (pages[0 + 1] > 2) pages.splice(1, 0, "…");
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

function refreshGrid() {
  const grid = document.getElementById("grid");
  const sorted = applySort(filtered);
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

function render() {
  const title = document.getElementById("pageTitle");
  const listTitle = document.getElementById("listTitle");
  const countEl = document.getElementById("pageCount");
  const grid = document.getElementById("grid");

  renderSkeleton(grid, PAGE_SIZE);

  if (category) {
    filtered = allLoaded.filter((g) => g[2] === category);
    title.textContent = `${category} games`;
    listTitle.textContent = category;
    document.title = `${category} Games - BoredPuP`;
    document.querySelector('meta[name="description"]').setAttribute(
      "content",
      `Play free ${category} games online instantly - no downloads. New ${category.toLowerCase()} games added daily at BoredPuP.`
    );
  } else {
    filtered = allLoaded;
    title.textContent = "All games";
    listTitle.textContent = "Everything";
    document.title = "All Games - BoredPuP";
  }

  countEl.textContent = `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "game" : "games"} free to play`;
  refreshGrid();
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
    refreshGrid();
  });
}

async function init() {
  initNav();
  setCanonical();
  initPwa();

  try {
    const [games, cats] = await Promise.all([getAllGames(), getCategories()]);
    allLoaded = games;
    render();
    renderCategoryPills(document.getElementById("pillRow"), cats, category, games.length);
  } catch {
    document.getElementById("grid").innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="big">Couldn't load games</div>
        <p>Please refresh the page to try again.</p>
      </div>`;
  }

  initFooter();

  const sortSelect = document.getElementById("sortSelect");
  sortSelect.value = sortBy;
  sortSelect.addEventListener("change", () => {
    sortBy = sortSelect.value;
    page = 1;
    refreshGrid();
  });

  bindPager();

  document.title = category ? `${category} Games - BoredPuP` : "All Games - BoredPuP";
}

init();