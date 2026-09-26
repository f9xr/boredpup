/* BoredPuP - 404 page: suggest a playable game instead of a dead end. */

import { initNav, initFooter, renderGameGrid, renderSkeleton, sample, setCanonical } from "./app.js";
import { getAllGames } from "./data.js";

initNav();
setCanonical();

try {
  const grid = document.getElementById("suggestedGrid");
  if (grid) {
    renderSkeleton(grid, 10);
    const games = await getAllGames();
    renderGameGrid(grid, sample(games, 10));
  }
} catch {
  const grid = document.getElementById("suggestedGrid");
  if (grid) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><div class="big">Games unavailable</div><p>Please refresh to try again.</p></div>`;
  }
}

initFooter();
