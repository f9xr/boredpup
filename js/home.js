import { initNav, initFooter, renderCategoryCards, catIcon, renderGameGrid, renderSkeleton, sample, setCanonical, initPwa } from "./app.js";
import { getAllGames, getCategories, randomGame, getRecent } from "./data.js";

const PAGE_SIZE = 15;
let allGames = [];
let initialGoodPicks = [];

function statCount(count) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 }).format(count) + "+";
}

async function loadPills() {
  const host = document.getElementById("categoryGrid");
  try {
    const cats = await getCategories();
    renderCategoryCards(host, cats, null);
  } catch {
    host.innerHTML = `<a class="category-card accent-orange" href="category.html"><span class="cat-icon">${catIcon("Puzzles")}</span><span class="cat-name">Puzzles</span></a><a class="category-card accent-blue" href="category.html"><span class="cat-icon">${catIcon("Racing")}</span><span class="cat-name">Racing</span></a><a class="category-card accent-red" href="category.html"><span class="cat-icon">${catIcon("Arcade")}</span><span class="cat-name">Arcade</span></a>`;
  }
}

function loadNewGrid() {
  const host = document.getElementById("newGrid");
  renderSkeleton(host, PAGE_SIZE);
  const newest = allGames.slice(0, PAGE_SIZE);
  renderGameGrid(host, newest);
  document.getElementById("newSub").textContent = `${newest.length} freshly added games`;
}

function loadTrendGrid() {
  const host = document.getElementById("trendGrid");
  renderSkeleton(host, PAGE_SIZE);
  const picks = sample(allGames, PAGE_SIZE);
  renderGameGrid(host, picks);
  return picks;
}

function loadRecentGrid() {
  const section = document.getElementById("recent");
  const host = document.getElementById("recentGrid");
  if (!section || !host) return;
  const ids = getRecent();
  if (!ids.length) {
    section.style.display = "none";
    return;
  }
  renderSkeleton(host, 8);
  const byId = new Map(allGames.map((g) => [g[0], g]));
  const items = ids.map((r) => byId.get(String(r.id))).filter(Boolean);
  if (!items.length) {
    section.style.display = "none";
    return;
  }
  renderGameGrid(host, items.slice(0, 10));
}

async function init() {
  initNav();
  setCanonical();
  initPwa();

  try {
    const [games, cats] = await Promise.all([getAllGames(), getCategories()]);
    allGames = games;

    const statEl = document.getElementById("statGames");
    if (statEl) statEl.textContent = statCount(games.length);

    const statCats = document.getElementById("statCats");
    if (statCats) statCats.textContent = String(cats.length);

    renderCategoryCards(document.getElementById("categoryGrid"), cats, null);
    loadNewGrid();
    initialGoodPicks = loadTrendGrid();
    loadRecentGrid();
  } catch {
    renderGameGrid(document.getElementById("newGrid"), []);
  }

  initFooter();

  const reRoll = document.getElementById("reRoll");
  if (reRoll) {
    reRoll.addEventListener("click", (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const host = document.getElementById("trendGrid");
      renderSkeleton(host, PAGE_SIZE);
      setTimeout(() => {
        const pickIds = new Set(initialGoodPicks.map((p) => p[0]));
      const picks = sample(allGames.filter((g) => !pickIds.has(g[0])), PAGE_SIZE);
        renderGameGrid(host, picks.length ? picks : sample(allGames, PAGE_SIZE));
        btn.disabled = false;
        btn.textContent = "Shuffle again →";
      }, 280);
    });
  }
}

init();