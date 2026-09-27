/* BoredPuP - inject the Content-Security-Policy into every HTML page.

   There was no CSP at all across 14 pages, while shipping inline JSON-LD,
   three inline module blocks, an inline onerror in every generated game card,
   and a third-party script injected into the page.

   The policy itself lives in scripts/csp.mjs, shared with the game-page
   generator so the hand-written and generated pages cannot drift apart.

   The generated pages under g/ are written by scripts/build-game-pages.mjs with
   the policy already baked in, so this only needs to cover the hand-written
   ones - but it will happily update a g/ page if one is ever edited by hand. */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CSP_TAG } from "./csp.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function pages() {
  const out = [];
  for (const f of await readdir(root)) {
    if (f.endsWith(".html")) out.push(f);
  }
  for (const f of await readdir(join(root, "pages"))) {
    if (f.endsWith(".html")) out.push(join("pages", f));
  }
  try {
    for (const f of await readdir(join(root, "g"))) {
      if (f.endsWith(".html")) out.push(join("g", f));
    }
  } catch {
    /* no generated pages yet */
  }
  return out;
}

async function main() {
  let changed = 0;
  for (const file of await pages()) {
    const p = join(root, file);
    let html = await readFile(p, "utf8");

    // Replace an existing policy if present, otherwise insert after the charset
    // declaration so it applies to everything the page loads.
    if (/<meta http-equiv="Content-Security-Policy"[^>]*>/.test(html)) {
      const next = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, CSP_TAG);
      if (next !== html) {
        await writeFile(p, next, "utf8");
        console.log(`  updated ${file}`);
        changed++;
      }
      continue;
    }
    const anchor = html.match(/<meta charset="[^"]*">/i);
    if (!anchor) {
      console.error(`  SKIPPED ${file}: no <meta charset> to anchor after`);
      continue;
    }
    html = html.replace(anchor[0], `${anchor[0]}\n  ${CSP_TAG}`);
    await writeFile(p, html, "utf8");
    console.log(`  added CSP to ${file}`);
    changed++;
  }
  console.log(changed ? `Done, ${changed} page(s) updated ✓` : "Already in sync");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
