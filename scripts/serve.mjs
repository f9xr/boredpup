/* BoredPuP - local static server for development.

   Rewritten to fix four bugs that made it a poor stand-in for production:

   1. decodeURIComponent() ran OUTSIDE the try block, on the raw request line.
      A request for "/%" throws URIError, which escaped the handler entirely and
      took down the process. An unhandled request should never be fatal.
   2. Directory redirects appended a slash unconditionally, so "/pages" ->
      "/pages/" -> "/pages//" -> "/pages///" ... an unbounded redirect loop.
   3. .webmanifest and .woff2 were missing from the MIME table, so the PWA
      manifest and webfonts were served as application/octet-stream, which
      browsers reject.
   4. A missing path returned a bare "not found" string with no 404.html, so
      the real 404 page never rendered in development - exactly the case it
      exists to cover. */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

const root = resolve(process.argv[2] || ".");
const port = Number(process.argv[3]) || 8080;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webmanifest.gz": "application/manifest+json; charset=utf-8",
};

function send(res, status, body, type, extra = {}) {
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(body),
    ...extra,
  });
  res.end(body);
}

/* Reject traversal before touching the filesystem, and normalize so that "/"
   and "/./" cannot smuggle a prefix past the startsWith check. */
function safeJoin(base, urlPath) {
  const file = resolve(base, `.${urlPath}`);
  if (file !== base && !file.startsWith(base + sep)) return null;
  return file;
}

async function serve(req, res) {
  let path;
  try {
    path = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  } catch {
    // Malformed percent-encoding. Answer 400 and stay alive.
    return send(res, 400, "bad request", "text/plain; charset=utf-8");
  }

  if (path.includes("\0")) {
    return send(res, 400, "bad request", "text/plain; charset=utf-8");
  }
  if (path.endsWith("/")) path += "index.html";

  const file = safeJoin(root, path);
  if (!file) return send(res, 403, "forbidden", "text/plain; charset=utf-8");

  let s;
  try {
    s = await stat(file);
  } catch {
    return notFound(req, res);
  }

  let target = file;
  if (s.isDirectory()) {
    // Canonicalize the trailing slash, exactly once. This is the loop fix.
    // A directory with no index.html is not a resource, so it 404s rather than
    // 403 - the same answer as asking for the index.html directly, which is
    // what made /pages and /pages/ disagree before.
    try {
      target = join(file, "index.html");
      s = await stat(target);
    } catch {
      return notFound(req, res);
    }
  }

  let body;
  try {
    body = await readFile(target);
  } catch {
    return notFound(req, res);
  }

  const ext = extname(target).toLowerCase();
  const isData = target.startsWith(join(root, "data") + sep);
  const isHtml = ext === ".html";

  return send(res, 200, req.method === "HEAD" ? "" : body, types[ext] || "application/octet-stream", {
    // HTML must not be cached in dev, or a reload serves the previous build and
    // you end up debugging a file that is not on disk any more.
    "Cache-Control": isHtml ? "no-cache" : isData ? "public, max-age=300" : "public, max-age=60",
    "X-Content-Type-Options": "nosniff",
  });
}

/* Serve the real 404 page so the suggested-games UI is exercised locally too,
   while keeping plain text for asset requests that cannot render HTML. */
async function notFound(req, res) {
  const wantsHtml = (req.headers.accept || "").includes("text/html");
  if (wantsHtml) {
    try {
      const body = await readFile(join(root, "404.html"));
      return send(res, 404, req.method === "HEAD" ? "" : body, types[".html"], {
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
    } catch {
      /* fall through to plain text */
    }
  }
  return send(res, 404, "not found", "text/plain; charset=utf-8");
}

const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    return res.end("method not allowed");
  }
  serve(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("internal error");
  });
});

server.listen(port, () => {
  console.log(`BoredPuP serving ${root} at http://localhost:${port}`);
});
