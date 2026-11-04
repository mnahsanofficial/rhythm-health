// Serves an Expo web export for screenshots. Unknown paths get index.html, as the single-page app expects.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const [root, port] = process.argv.slice(2);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".ttf": "font/ttf", ".png": "image/png", ".ico": "image/x-icon" };
createServer(async (request, response) => {
  const path = normalize(new URL(request.url, "http://x").pathname);
  const file = extname(path) ? join(root, path) : join(root, "index.html");
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(Number(port), "127.0.0.1");
