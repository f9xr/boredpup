/* BoredPuP - rewrite the canonical site base URL across every shipped file.

   The base URL used to be hand-copied into 54 places across 13 HTML files and
   robots.txt, and had drifted: the HTML said `http://www.f9xr.org/boredpup//`
   (plaintext http, and a doubled slash) while the sitemap generator emitted
   `https://www.f9xr.org/boredpup`. The two disagreed, non-JS crawlers saw the
   broken one, and nothing detected it.

   Now there is exactly one place the base is defined. Run after a content
   change, and from CI:

     node scripts/sync-base-url.mjs
     BOREDPUP_BASE_URL=https://example.org/site node scripts/sync-base-url.mjs

   The marker below is written as a comment next to every rewritten value so
   the next run can find and update them again. */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BOREDPUP_BASE_URL || "https://www.f9xr.org/boredpup").replace(/\/+$/, "");

/* Anything that looks like an absolute URL on our own origin, with any scheme,
   any number of trailing slashes, and an optional marker. */
const PATTERN = new RegExp(
  `(https?://(?:www\\.)?f9xr\\.org/boredpup)/*` +
    `(<!--\\s*boredpup:base\\s*-->)?`,
  "g"
);

async function htmlFiles() {
  const out = [];
  for (const f of await readdir(root)) {
    if (f.endsWith(".html")) out.push(f);
  }
  for (const f of await readdir(join(root, "pages"))) {
    if (f.endsWith(".html")) out.push(join("pages", f));
  }
  return out;
}

async function main() {
  console.log(`Base URL: ${BASE}`);
  const files = [...(await htmlFiles()), "robots.txt", "sitemap.xml"];
  let changed = 0;

  for (const file of files) {
    const p = join(root, file);
    const before = await readFile(p, "utf8");
    const after = before.replace(PATTERN, `${BASE}/$2`);
    if (after !== before) {
      await writeFile(p, after, "utf8");
      const n = (before.match(PATTERN) || []).length;
      console.log(`  updated ${file} (${n} URL${n === 1 ? "" : "s"})`);
      changed += n;
    }
  }

  console.log(changed ? `Done, ${changed} URL(s) rewritten ✓` : "Nothing to rewrite (already in sync)");
  if (!changed) {
    // Make the base URL a deliberate part of the build rather than a habit.
    const robots = await readFile(join(root, "robots.txt"), "utf8");
    if (!robots.includes(BASE)) {
      console.warn(`Warning: no reference to ${BASE} found in robots.txt`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
