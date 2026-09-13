import { initNav, initFooter, renderCategoryPills, renderGameGrid, renderSkeleton, setCanonical, initPwa } from "./app.js";
import { getAllGames, getCategories } from "./data.js";

const PAGE_SIZE = 24;

const params = new URLSearchParams(window.location.search);
const category = params.get("c") || null;

let allLoaded = [];
let filtered = [];
let shown = 0;
let sortBy = "newest";

function applySort(list) {
  const arr = [...list];
  if (sortBy === "az") arr.sort((a, b) => a[1].localeCompare(b[1]));
  else if (sortBy === "za") arr.sort((a, b) => b[1].localeCompare(a[1]));
  return arr;
}

function refreshGrid({ reset = false } = {}) {
  const grid = document.getElementById("grid");
  if (reset) {
    shown = 0;
    grid.innerHTML = "";
  }
  const slice = applySort(filtered).slice(shown, shown + PAGE_SIZE);
  renderGameGrid(grid, slice);
  shown += slice.length;

  const moreBtn = document.getElementById("loadMore");
  moreBtn.style.display = shown < filtered.length ? "inline-flex" : "none";
  const remaining = filtered.length - shown;
  moreBtn.textContent = remaining > 0 ? `Load more (${remaining} left)` : "Load more games";

  if (!shown) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="big">Nothing here yet</div>
        <p>No games match this category. Try another one above.</p>
      </div>`;
    moreBtn.style.display = "none";
  }
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
  refreshGrid({ reset: true });
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
  sortSelect.addEventListener("change", () => {
    sortBy = sortSelect.value;
    refreshGrid({ reset: true });
    gridFade();
  });

  document.getElementById("loadMore").addEventListener("click", () => refreshGrid());

  document.title = category ? `${category} Games - BoredPuP` : "All Games - BoredPuP";
}

function gridFade() {
  const grid = document.getElementById("grid");
  grid.style.opacity = "0.4";
  setTimeout(() => (grid.style.opacity = "1"), 120);
}

init();