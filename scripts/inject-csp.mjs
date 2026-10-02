/* BoredPuP - inject the Content-Security-Policy into every HTML page.

   There was no CSP at all across 14 pages, while shipping inline JSON-LD,
   three inline module blocks, an inline onerror in every generated game card,
   and a third-party script injected into the page.

   The policies live in scripts/csp.mjs. There are two, and picking the wrong
   one for a directory is the mistake worth avoiding: the hand-written pages
   carry the Grow.me widget and so need PAGE_CSP, while the generated game pages
   do not and keep the tighter SITE_CSP. Giving g/ PAGE_CSP would loosen
   'unsafe-inline' across 6,704 pages that have no widget; giving the
   hand-written pages SITE_CSP would block the widget with no visible error.

   The generated pages under g/ are written by scripts/build-game-pages.mjs with
   their policy already baked in, so this only needs to cover the hand-written
   ones - but it will happily update a g/ page if one is ever edited by hand,
   with the policy that directory should have. */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CSP_TAG, PAGE_CSP_TAG } from "./csp.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Every page paired with the policy it is supposed to carry. */
async function pages() {
  const out = [];
  const collect = async (dir, prefix, tag) => {
    for (const f of await readdir(dir)) {
      if (f.endsWith(".html")) out.push([prefix ? join(prefix, f) : f, tag]);
    }
  };
  await collect(root, "", PAGE_CSP_TAG);
  await collect(join(root, "pages"), "pages", PAGE_CSP_TAG);
  try {
    await collect(join(root, "g"), "g", CSP_TAG);
  } catch {
    /* no generated pages yet */
  }
  return out;
}

async function main() {
  let changed = 0;
  for (const [file, tag] of await pages()) {
    const p = join(root, file);
    let html = await readFile(p, "utf8");

    // Replace an existing policy if present, otherwise insert after the charset
    // declaration so it applies to everything the page loads.
    if (/<meta http-equiv="Content-Security-Policy"[^>]*>/.test(html)) {
      const next = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, tag);
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
    html = html.replace(anchor[0], `${anchor[0]}\n  ${tag}`);
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
