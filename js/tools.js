import { initNav, initFooter, setCanonical, initPwa, escapeHtml } from "./app.js";
import { getAllGames, getCategories, getDetails, getMeta, randomGame } from "./data.js";

const gamesById = new Map();

function safeEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (!/^(html5\.)?gamemonetize\.(co|com)$/i.test(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

function bindTabs() {
  document.querySelectorAll(".tool-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tool-tab").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      document.querySelectorAll(".tool-section").forEach((sec) => {
        sec.classList.toggle("active", sec.id === `tab-${btn.dataset.tab}`);
      });
    });
  });
}

function bindCopy(btnId, elId) {
  document.getElementById(btnId).addEventListener("click", async () => {
    const text = document.getElementById(elId).textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    const btn = document.getElementById(btnId);
    const old = btn.textContent;
    btn.textContent = "Copied ✓";
    setTimeout(() => (btn.textContent = old), 1600);
  });
}

async function showGameTools(g) {
  const out = document.getElementById("toolOutput");
  if (!g) {
    out.style.display = "none";
    return;
  }
  const id = g[0];
  const title = g[1];
  const details = await getDetails(id);
  const url = details ? safeEmbedUrl(details.url) : null;
  const w = details ? details.width : 800;
  const h = details ? details.height : 600;
  const embedUrl = url || "https://html5.gamemonetize.co/";
  const playHref = `game.html?id=${encodeURIComponent(id)}&t=${encodeURIComponent(title)}`;

  document.getElementById("toolTitle").textContent = title;
  const playLink = document.getElementById("toolPlayLink");
  playLink.textContent = new URL(playHref, window.location.href).href;
  playLink.href = playHref;

  const embed = `<iframe src="${embedUrl}" width="100%" height="100%" style="aspect-ratio: ${w} / ${h}; border: 0;" allow="autoplay; fullscreen; encrypted-media; accelerometer; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="no-referrer" title="${title.replace(/"/g, "&quot;")}"></iframe>`;
  document.getElementById("toolEmbed").textContent = embed;

  const walk = `<iframe src="https://gamemonetize.video/?gameid=${encodeURIComponent(id)}&color=%233b9eff" width="100%" height="480" style="border: 0;" allowfullscreen title="Walkthrough for ${title.replace(/"/g, "&quot;")}"></iframe>`;
  document.getElementById("toolWalk").textContent = walk;

  const share = new URL(playHref, window.location.href).href;
  document.getElementById("toolShare").textContent = share;

  out.style.display = "";
}

function bindPicker() {
  const input = document.getElementById("toolPick");
  const results = document.getElementById("toolResults");
  let timer = null;

  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim().toLowerCase();
    if (!q) {
      results.innerHTML = "";
      document.getElementById("toolOutput").style.display = "none";
      return;
    }
    timer = setTimeout(() => {
      const matches = [...gamesById.values()]
        .filter((g) => (g[1] + " " + (g[3] || []).join(" ")).toLowerCase().includes(q))
        .slice(0, 6);
      results.innerHTML = matches.length
        ? matches
            .map(
              (g) =>
                `<button class="tool-result" type="button" data-id="${g[0]}">
                   <img src="${escapeHtml(g[4])}" alt="" width="64" height="48" loading="lazy">
                   <span>${escapeHtml(g[1])}</span>
                 </button>`
            )
            .join("")
        : `<p class="subtitle mute">No games match “${escapeHtml(input.value.trim())}”.</p>`;
    }, 180);
  });

  results.addEventListener("click", async (e) => {
    const btn = e.target.closest(".tool-result");
    if (!btn) return;
    input.value = gamesById.get(btn.dataset.id)[1];
    results.innerHTML = "";
    await showGameTools(gamesById.get(btn.dataset.id));
  });
}

function bindFeed() {
  const cat = document.getElementById("feedCat");
  getCategories().then((cats) => {
    cat.innerHTML =
      `<option value="All">All</option>` +
      cats.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
  });

  document.getElementById("genFeed").addEventListener("click", () => {
    const category = encodeURIComponent(cat.value);
    const popularity = encodeURIComponent(document.getElementById("feedPop").value);
    const amount = encodeURIComponent(document.getElementById("feedAmount").value);
    const url = `https://rss.gamemonetize.com/rssfeed.php?format=json&category=${category}&type=html5&popularity=${popularity}&company=All&amount=${amount}`;
    document.getElementById("feedJson").textContent = url;
    document.getElementById("feedOpen").href = url;
    document.getElementById("feedOut").style.display = "";
  });
}

async function bindRandom() {
  document.getElementById("randPick").addEventListener("click", async () => {
    const g = await randomGame();
    if (!g) return;
    const host = document.getElementById("randOut");
    const href = `game.html?id=${encodeURIComponent(g[0])}&t=${encodeURIComponent(g[1])}`;
    const thumb = `<img src="${escapeHtml(g[4])}" alt="${escapeHtml(g[1])}" width="256" height="192" style="border-radius: var(--radius-lg); border: 1px solid var(--hairline); max-width: 100%; height: auto;">`;
    host.innerHTML = `
      <a href="${href}" class="inline-link" style="font-size: 1.15rem;">Featured: ${escapeHtml(g[1])} →</a>
      <a href="${href}">${thumb}</a>`;
  });
}

async function init() {
  initNav();
  setCanonical();
  initPwa();

  try {
    const games = await getAllGames();
    games.forEach((g) => gamesById.set(g[0], g));
  } catch {
    /* picker stays empty */
  }

  bindTabs();
  bindPicker();
  bindFeed();
  bindRandom();
  bindCopy("copyEmbed", "toolEmbed");
  bindCopy("copyWalk", "toolWalk");
  bindCopy("copyShare", "toolShare");
  bindCopy("copyFeedJson", "feedJson");
  initFooter();
}

init();