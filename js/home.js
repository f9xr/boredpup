import { initNav, initFooter, renderCategoryPills, renderGameGrid, renderSkeleton, sample } from "./app.js";
import { getAllGames, getCategories, randomGame } from "./data.js";

const PAGE_SIZE = 15;
let allGames = [];
let initialGoodPicks = [];

function statCount(count) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 }).format(count) + "+";
}

async function loadPills() {
  const host = document.getElementById("pillRow");
  renderSkeleton(host, 4);
  try {
    const cats = await getCategories();
    renderCategoryPills(host, cats, null);
  } catch {
    host.innerHTML = `<a class="pill" href="category.html">Puzzles</a><a class="pill" href="category.html">Racing</a><a class="pill" href="category.html">Arcade</a>`;
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

async function init() {
  initNav();

  try {
    const [games, cats] = await Promise.all([getAllGames(), getCategories()]);
    allGames = games;

    const statEl = document.getElementById("statGames");
    if (statEl) statEl.textContent = statCount(games.length);

    renderCategoryPills(document.getElementById("pillRow"), cats, null);
    loadNewGrid();
    initialGoodPicks = loadTrendGrid();
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
        const picks = sample(allGames.filter((g) => !initialGoodPicks.some((p) => p[0] === g[0])), PAGE_SIZE);
        renderGameGrid(host, picks.length ? picks : sample(allGames, PAGE_SIZE));
        btn.disabled = false;
        btn.textContent = "Shuffle again →";
      }, 280);
    });
  }
}

init();