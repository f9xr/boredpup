/* Behavioural checks for js/data.js.
   These target the C1 defects, which are all about what happens with bad or
   stale input - none of them show up in a syntax check. */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Minimal browser + localStorage stand-in, installed before data.js loads. */
const store = new Map();
const online = { value: true };
let fetchCalls = 0;

/* Node 24 exposes `navigator` as a getter-only global, so it has to be
   redefined rather than assigned. */
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  get: () => ({ onLine: online.value }),
});
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { addEventListener() {} };

const catalog = JSON.parse(readFileSync(join(root, "data/catalog.json"), "utf8"));
globalThis.fetch = async (url) => {
  fetchCalls++;
  const p = String(url).replace("data/", "");
  if (p === "catalog.json") {
    return { ok: true, json: async () => catalog };
  }
  throw new Error(`unexpected fetch ${url}`);
};

const { getCatalog, getGame, getDetails, searchGames, getAllGames } = await import("../js/data.js");

/* The literal storage key on purpose: it is part of the on-disk contract that
   a returning visitor depends on, so a test that imports the constant would
   happily follow a rename and stop testing anything. */
const LOCAL_KEY = "boredpup:catalog:v3";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

const games = await getAllGames();
const sampleId = games[0][0];

await checkAsync("getGame finds a known id", async () => {
  const g = await getGame(sampleId);
  assert.ok(g, "expected a game");
  assert.equal(g[0], sampleId);
});

await checkAsync("getGame returns null for an unknown id", async () => {
  assert.equal(await getGame("definitely-not-a-real-id"), null);
});

await checkAsync("searchGames matches and rejects correctly", async () => {
  const hit = searchGames(games, games[0][1].toLowerCase().slice(0, 6));
  assert.ok(hit.length >= 1, "expected at least one hit");
  assert.equal(searchGames(games, "zzzzqqqqxxxx").length, 0);
  assert.equal(searchGames(games, "").length, games.length);
});

await checkAsync("searchGames is case and term based", async () => {
  const upper = searchGames(games, games[0][1].toUpperCase());
  assert.ok(upper.length >= 1);
});

/* The interesting part: re-import data.js with a poisoned cache to prove the
   snapshot is validated rather than trusted. */
async function withCache(value, fn) {
  store.set(LOCAL_KEY, value);
  const bust = `?bust=${Math.random()}`;
  const mod = await import(`../js/data.js${bust}`);
  return fn(mod);
}

await checkAsync("rejects a JSON-valid but wrong-shaped cache", async () => {
  const before = fetchCalls;
  await withCache(JSON.stringify({ ts: Date.now(), meta: null, games: null }), async (m) => {
    const cat = await m.getCatalog();
    assert.notEqual(cat.source, "cache", "should not have served the poisoned cache");
    assert.ok(Array.isArray(cat.games) && cat.games.length > 0, "should have refetched a real catalog");
  });
  assert.ok(fetchCalls > before, "should have performed a network fetch");
});

await checkAsync("rejects an empty-games cache", async () => {
  await withCache(JSON.stringify({ ts: Date.now(), meta: { categories: [] }, games: [] }), async (m) => {
    const cat = await m.getCatalog();
    assert.notEqual(cat.source, "cache");
    assert.ok(cat.games.length > 0);
  });
});

await checkAsync("rejects a bare object cache", async () => {
  await withCache(JSON.stringify({}), async (m) => {
    const cat = await m.getCatalog();
    assert.notEqual(cat.source, "cache");
  });
});

await checkAsync("serves a fresh cache without refetching", async () => {
  const generated = new Date().toISOString();
  await withCache(
    JSON.stringify({ ts: Date.now(), meta: { ...catalog.meta, generated }, games: catalog.games }),
    async (m) => {
      const before = fetchCalls;
      const cat = await m.getCatalog();
      assert.equal(cat.source, "cache");
      assert.equal(fetchCalls, before, "must not refetch a fresh cache");
    },
  );
});

await checkAsync("treats an old generated date as stale even with a fresh ts", async () => {
  const generated = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  await withCache(
    JSON.stringify({
      ts: Date.now(), // <- the browser just wrote it
      meta: { ...catalog.meta, generated }, // <- but the build is a month old
      games: catalog.games,
    }),
    async (m) => {
      const before = fetchCalls;
      const cat = await m.getCatalog();
      assert.equal(cat.source, "snapshot", "a month-old snapshot must not count as fresh");
      assert.ok(fetchCalls > before, "should have refetched");
    },
  );
});

await checkAsync("serves a stale-but-valid cache when offline", async () => {
  const generated = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  online.value = false;
  try {
    await withCache(
      JSON.stringify({ ts: Date.now(), meta: { ...catalog.meta, generated }, games: catalog.games }),
      async (m) => {
        const cat = await m.getCatalog();
        assert.equal(cat.source, "cache", "offline users must still get games");
        assert.ok(cat.games.length > 0);
      },
    );
  } finally {
    online.value = true;
  }
});

await checkAsync("getDetails returns null for an unknown id", async () => {
  assert.equal(await getDetails("no-such-game-id"), null);
});

console.log(`\n${passed} check(s) passed`);
