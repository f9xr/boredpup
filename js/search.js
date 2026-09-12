import { initNav, initFooter, escapeHtml, renderGameGrid, renderSkeleton } from "./app.js";
import { getAllGames, searchGames } from "./data.js";

const PAGE_SIZE = 24;
const params = new URLSearchParams(window.location.search);
const query = (params.get("q") || "").trim();

let allGames = [];
let results = [];
let shown = 0;

function setCountText() {
  const el = document.getElementById("resultsCount");
  if (!query) {
    el.textContent = "Search titles, tags, and categories.";
  } else if (!results.length) {
    el.textContent = `No games match “${query}”. Try a different spelling.`;
  } else {
    el.textContent = `${results.length.toLocaleString()} ${results.length === 1 ? "game" : "games"} match “${query}”`;
  }
}

function loadMore() {
  const grid = document.getElementById("grid");
  const slice = results.slice(shown, shown + PAGE_SIZE);
  renderGameGrid(grid, slice);
  shown += slice.length;
  const btn = document.getElementById("loadMore");
  btn.style.display = shown < results.length ? "inline-flex" : "none";
  btn.textContent = shown < results.length ? `Load more (${results.length - shown} left)` : "";
}

function render() {
  const grid = document.getElementById("grid");
  if (!query) {
    document.title = "Search games — BoredPuP";
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="big">What are you in the mood for?</div>
        <p>Search by title, tag, or category — or <a class="inline-link" href="category.html">browse everything</a>.</p>
      </div>`;
    setCountText();
    return;
  }

  renderSkeleton(grid, PAGE_SIZE);
  document.title = `Search “${query}” — BoredPuP`;

  try {
    results = searchGames(allGames, query);
    setCountText();
    shown = 0;
    grid.innerHTML = "";
    if (!results.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="big">Nothing found</div>
          <p>No games match “${escapeHtml(query)}”. Try fewer words, or clear the filters.</p>
        </div>`;
      document.getElementById("loadMore").style.display = "none";
      return;
    }
    loadMore();
  } catch {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="big">Search unavailable</div>
        <p>Please refresh to try again.</p>
      </div>`;
  }
}

async function init() {
  initNav();
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

  document.getElementById("loadMore").addEventListener("click", loadMore);
  initFooter();
}

init();