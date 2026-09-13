/* BoredPuP - shared UI helpers. */

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function setCanonical() {
  const existing = document.querySelector('link[rel="canonical"]');
  const url = window.location.href.split("#")[0];
  if (existing) existing.setAttribute("href", url);
  else {
    const link = document.createElement("link");
    link.rel = "canonical";
    link.href = url;
    document.head.appendChild(link);
  }
}

export function isFav(id) {
  try {
    const favs = JSON.parse(localStorage.getItem("boredpup:favs:v1") || "[]");
    return Array.isArray(favs) && favs.includes(String(id));
  } catch {
    return false;
  }
}

export function toggleFav(id, btn) {
  const faved = isFav(id);
  try {
    const favs = JSON.parse(localStorage.getItem("boredpup:favs:v1") || "[]");
    const set = new Set(Array.isArray(favs) ? favs : []);
    if (faved) set.delete(String(id));
    else set.add(String(id));
    localStorage.setItem("boredpup:favs:v1", JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
  if (btn) {
    btn.classList.toggle("active", !faved);
    btn.setAttribute("aria-pressed", String(!faved));
    btn.setAttribute("aria-label", !faved ? `Remove ${id} from favorites` : `Add to favorites`);
  }
  return !faved;
}

export function gameCard(g) {
  const id = g[0];
  const title = g[1];
  const category = g[2];
  const tags = Array.isArray(g[3]) && g[3].length ? g[3] : [];
  const thumb = g[4];
  const href = `game.html?id=${encodeURIComponent(id)}&t=${encodeURIComponent(title)}`;
  const faved = isFav(id);

  const tagBadge =
    tags.length && tags[0] ? `<span class="game-badge">${escapeHtml(tags[0])}</span>` : "";

  return `
  <article class="game-card" data-id="${id}">
    <a class="game-thumb-link" href="${href}" aria-label="Play ${escapeHtml(title)}">
      <div class="game-thumb">
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(title)}" loading="lazy" width="512" height="384"
             referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('no-img')">
        ${tagBadge}
      </div>
    </a>
    <button class="fav-btn${faved ? " active" : ""}" type="button" data-id="${id}"
            aria-pressed="${faved}" aria-label="${faved ? "Remove from favorites" : "Add to favorites"}"
            title="${faved ? "Saved" : "Save to favorites"}"><span>${faved ? "♥" : "♡"}</span></button>
    <a class="game-body" href="${href}" tabindex="-1">
      <div class="game-title">${escapeHtml(title)}</div>
      <div class="game-cat">${escapeHtml(category)}</div>
    </a>
  </article>`;
}

let cardActionsBound = false;

export function initCardActions() {
  if (cardActionsBound) return;
  cardActionsBound = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".fav-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (!btn.classList.contains("active")) toast("Saved to favorites");
    toggleFav(btn.dataset.id, btn);
  });
}

export function renderSkeleton(container, count) {
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton">
        <div class="skel-thumb"></div>
      </div>`;
  }
  container.innerHTML = html;
}

export function renderGameGrid(container, games) {
  container.innerHTML = games.map(gameCard).join("");
  initCardActions();
}

export function categoryPill(cat, count, active) {
  const href = `category.html?c=${encodeURIComponent(cat.name || cat)}`;
  const countHtml = count != null ? `<span class="pill-count">${count}</span>` : "";
  return `
    <a class="pill${active ? " active" : ""}" href="${href}">
      ${escapeHtml(cat.name || cat)}${countHtml}
    </a>`;
}

export function renderCategoryPills(container, categories, activeName, count) {
  container.innerHTML = [
    `<a class="pill${!activeName ? " active" : ""}" href="category.html">All games${count ? ` <span class="pill-count">${count}</span>` : ""}</a>`,
    ...categories.map((c) => categoryPill(c, c.count, c.name === activeName)),
  ].join("");
}

export function initNav() {
  const burger = document.getElementById("navBurger");
  const mobile = document.getElementById("mobileNav");
  if (burger && mobile) {
    burger.addEventListener("click", () => {
      const open = mobile.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobile.addEventListener("click", () => {
      mobile.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    });
  }
}

export async function initFooter() {
  try {
    const { getCategories } = await import("./data.js");
    const cats = await getCategories();
    const host = document.getElementById("footerCats");
    if (host && cats.length) {
      host.innerHTML = cats
        .slice(0, 6)
        .map((c) => `<a href="category.html?c=${encodeURIComponent(c.name)}">${escapeHtml(c.name)}</a>`)
        .join("");
    }
  } catch {
    /* footer categories are progressive enhancement */
  }

  document.querySelectorAll("[data-action='random']").forEach((node) => {
    node.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const { randomGame } = await import("./data.js");
        const g = await randomGame();
        if (g) window.location.href = `game.html?id=${encodeURIComponent(g[0])}`;
      } catch {
        /* ignore */
      }
    });
  });
}

export function toast(message, ms = 2600) {
  let node = document.querySelector(".toast");
  if (!node) {
    node = document.createElement("div");
    node.className = "toast";
    document.body.appendChild(node);
  }
  node.textContent = message;
  requestAnimationFrame(() => node.classList.add("show"));
  clearTimeout(node._t);
  node._t = setTimeout(() => node.classList.remove("show"), ms);
}

export function sample(games, n) {
  const copy = [...games];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export function shuffle(games) {
  const copy = [...games];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function initPwa() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}