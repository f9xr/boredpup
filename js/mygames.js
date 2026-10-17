import { initNav, initFooter, setCanonical, initPwa, renderGameGrid, renderSkeleton, toast } from "./app.js";
import { getAllGames, getFavorites, getRecent, RECENT_KEY } from "./data.js";

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

  const recentEl = document.getElementById("recentGrid");
  const favsEl = document.getElementById("favGrid");
  let games = [];
  try {
    games = await getAllGames();
  } catch {
    /* fall through */
  }

  const byId = new Map(games.map((g) => [g[0], g]));

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

  const tabs = [...document.querySelectorAll(".my-tab")];
  function activate(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    const showFavs = tab.dataset.tab === "favs";
    recentEl.hidden = showFavs;
    favsEl.hidden = !showFavs;
    if (showFavs) renderFavs();
    else renderRecent();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (e) => {
      let next = null;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === "Home") next = tabs[0];
      else if (e.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        activate(next);
        next.focus();
      }
    });
  });

  document.getElementById("clearAll").addEventListener("click", () => {
    // Only the play history: the button says "Clear history", and wiping the
    // favorites list from behind that label was silent data loss.
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignore */
    }
    toast("Recently played cleared");
    if (recentEl.hidden) {
      activate(document.querySelector(".my-tab[data-tab='recent']"));
    } else {
      renderRecent();
    }
  });

  initFooter();
}

init();
