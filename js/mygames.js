import { initNav, initFooter, setCanonical, initPwa, renderGameGrid, renderSkeleton, toast } from "./app.js";
import { getAllGames, getFavorites, getRecent } from "./data.js";

function emptyState(message, cta) {
  return `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="big">${message}</div>
      <p>${cta}</p>
    </div>`;
}

async function init() {
  initNav();
  setCanonical();
  initPwa();

  const grid = document.getElementById("recentGrid");
  let games = [];
  try {
    games = await getAllGames();
  } catch {
    /* fall through */
  }

  const byId = new Map(games.map((g) => [g[0], g]));
  const recentEl = document.getElementById("recentGrid");
  const favsEl = document.createElement("div");
  favsEl.className = "game-grid";
  favsEl.id = "favGrid";

  function renderRecent() {
    renderSkeleton(recentEl, 6);
    const recent = getRecent(); // [{id,title,at}]
    const items = recent.map((r) => byId.get(String(r.id))).filter(Boolean);
    if (!items.length) {
      recentEl.innerHTML = emptyState("Nothing played yet", '<a class="inline-link" href="index.html">Browse the catalog - your last games appear here.</a>');
      return;
    }
    renderGameGrid(recentEl, items);
  }

  function renderFavs() {
    renderSkeleton(favsEl, 6);
    document.getElementById("favCount").textContent = getFavorites().length
      ? `(${getFavorites().length})`
      : "";
    const items = getFavorites().map((id) => byId.get(id)).filter(Boolean);
    if (!items.length) {
      favsEl.innerHTML = emptyState("No favorites yet", 'Tap the <span aria-hidden="true">♡</span> heart on any game card to save it here.');
      return;
    }
    renderGameGrid(favsEl, items);
  }

  renderRecent();

  const tabs = document.querySelectorAll(".my-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      if (tab.dataset.tab === "favs") {
        if (!document.getElementById("favGrid")) recentEl.replaceWith(favsEl);
        renderFavs();
      } else {
        if (document.getElementById("favGrid")) favsEl.replaceWith(recentEl);
        renderRecent();
      }
    });
  });

  document.getElementById("clearAll").addEventListener("click", () => {
    try {
      localStorage.removeItem("boredpup:recent:v1");
      localStorage.removeItem("boredpup:favs:v1");
    } catch {
      /* ignore */
    }
    toast("History and favorites cleared");
    if (document.getElementById("favGrid")) {
      favsEl.replaceWith(recentEl);
      document.querySelector(".my-tab[data-tab='recent']").click();
    } else {
      renderRecent();
    }
  });

  initFooter();
}

init();