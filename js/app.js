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

const CATEGORY_ICONS = {
  Puzzles:
    '<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/>',
  Hypercasual: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  Arcade:
    '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
  Adventure:
    '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  Racing:
    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  Shooting:
    '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
  Girls:
    '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  Sports:
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  Clicker:
    '<path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>',
  Action: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  Fighting:
    '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
  Multiplayer:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  Boys:
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  "3D":
    '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/>',
  Cooking:
    '<path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/>',
  Soccer: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/>',
  ".IO":
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  "2 Player":
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  Bejeweled:
    '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
};

const CATEGORY_ACCENTS = ["orange", "blue", "green", "red", "yellow"];

export function catIcon(name) {
  return `<svg class="lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    CATEGORY_ICONS[name] || CATEGORY_ICONS.Arcade
  }</svg>`;
}

export function categoryCard(cat, count, active, index = 0) {
  const name = cat.name || cat;
  const href = `category.html?c=${encodeURIComponent(name)}`;
  const accent = CATEGORY_ACCENTS[((index % CATEGORY_ACCENTS.length) + CATEGORY_ACCENTS.length) % CATEGORY_ACCENTS.length];
  const countHtml = count != null ? `<span class="cat-count">${count.toLocaleString()}</span>` : "";
  return `
    <a class="category-card accent-${accent}${active ? " active" : ""}" href="${href}">
      <span class="cat-icon">${catIcon(name)}</span>
      <span class="cat-name">${escapeHtml(name)}</span>
      ${countHtml}
    </a>`;
}

export function renderCategoryCards(container, categories, activeName) {
  if (!container) return;
  container.innerHTML = [
    categoryCard({ name: "All games" }, null, !activeName, -1),
    ...categories.map((c, i) => categoryCard(c, c.count, c.name === activeName, i)),
  ].join("");
}

export function categoryPill(cat, count, active) {
  const href = `category.html?c=${encodeURIComponent(cat.name || cat)}`;
  const countHtml = count != null ? `<span class="pill-count">${count}</span>` : "";
  return `
    <a class="pill${active ? " active" : ""}" href="${href}">
      ${catIcon(cat.name || cat)}${escapeHtml(cat.name || cat)}${countHtml}
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

  applyFooterReveal();
}

function applyFooterReveal() {
  const footer = document.querySelector(".footer");
  if (!footer) return;
  const mql = window.matchMedia("(min-width: 1080px)");
  function update() {
    if (mql.matches) {
      document.body.classList.add("reveal-footer");
      requestAnimationFrame(() => {
        document.body.style.marginBottom = `${footer.offsetHeight}px`;
      });
    } else {
      document.body.classList.remove("reveal-footer");
      document.body.style.marginBottom = "";
    }
  }
  update();
  mql.addEventListener("change", update);
  window.addEventListener("resize", update);
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

let installPrompt = null;

export function initPwa() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
    showInstallButton();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    hideInstallButton();
  });
}

function showInstallButton() {
  if (document.getElementById("installPromptBtn")) return;
  const btn = document.createElement("button");
  btn.id = "installPromptBtn";
  btn.type = "button";
  btn.className = "install-prompt-btn";
  btn.textContent = "Install BoredPuP app";
  btn.addEventListener("click", async () => {
    if (!installPrompt) return;
    try {
      installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      /* prompt refused */
    }
    installPrompt = null;
    hideInstallButton();
  });
  document.body.appendChild(btn);
}

function hideInstallButton() {
  const btn = document.getElementById("installPromptBtn");
  if (btn) btn.remove();
}