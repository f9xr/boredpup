/* BoredPuP - inject the Content-Security-Policy into every HTML page.

   There was no CSP at all across 14 pages, while shipping inline JSON-LD,
   three inline module blocks, an inline onerror in every generated game card,
   and a third-party script injected into the page.

   It is delivered as a <meta http-equiv> rather than a header because this is
   a static host with no header control. Two consequences worth knowing:

     - frame-ancestors is IGNORED in meta-delivered CSP (per spec). Clickjacking
       protection has to be set as a real header by the host, or is unavailable.
     - report-uri is likewise unavailable, so violations are not sent anywhere.

   Everything else works. Keep this file as the single place the policy is
   defined; run `npm run sync:csp` after adding a page or a new third-party host.

   Host lists are precise rather than wildcarded, which is the point of a CSP:
   thumbnails come from exactly three hosts, and every badge host is enumerated. */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // No 'unsafe-inline' here: the inline <script type="module"> blocks were
  // extracted to js/notfound.js and js/contact.js, and the generated inline
  // onerror attribute was replaced with a delegated listener, so every
  // executable script is now same-origin and external.
  "script-src 'self'",
  // 65 style="" attributes in the markup, so this one has to stay loose.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://img.gamemonetize.com https://img.gamedistribution.com https://yupi.io https://shipthing.com https://1000tools.best https://smolsaas.com https://smolhunt.com https://api.producthunt.com https://racoondr.com https://launchstag.com",
  // The live-feed fallback in js/data.js.
  "connect-src 'self' https://rss.gamemonetize.com",
  "frame-src 'self' https://html5.gamemonetize.com https://gamemonetize.co https://gamemonetize.com https://yupi.io https://html5.gamedistribution.com",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const TAG = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;

async function pages() {
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
  let changed = 0;
  for (const file of await pages()) {
    const p = join(root, file);
    let html = await readFile(p, "utf8");

    // Replace an existing policy if present, otherwise insert after the charset
    // declaration so it applies to everything the page loads.
    if (/<meta http-equiv="Content-Security-Policy"[^>]*>/.test(html)) {
      const next = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, TAG);
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
    html = html.replace(anchor[0], `${anchor[0]}\n  ${TAG}`);
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
