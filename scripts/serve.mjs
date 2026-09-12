import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.argv[2] || ".");
const port = Number(process.argv[3]) || 8080;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".gz": "application/gzip",
};

createServer(async (req, res) => {
  let path = decodeURIComponent((req.url || "/").split("?")[0]);
  if (path === "/") path = "/index.html";

  try {
    const file = resolve(root, path.replace(/^[/\\]+/, ""));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    const s = await stat(file);
    if (s.isDirectory()) {
      res.writeHead(302, { Location: path + "/" });
      res.end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": file.includes(`${root}${sep}data`) ? "public, max-age=300" : "public, max-age=60",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
}).listen(port, () => console.log(`BoredPuP serving ${root} at http://localhost:${port}`));