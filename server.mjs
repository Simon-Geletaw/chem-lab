// server.mjs — one backend that hosts every lab on a single origin with short
// path URLs:
//
//   /        → /c/     (the Chemistry Lab is the hub)
//   /c/      → chem-lab dist
//   /b/      → biology-lab dist
//   /m/      → math-lab dist
//   /p/      → physics-lab dist
//
// The door links between labs are relative paths (/c, /b, /m, /p), so they
// work on this server with no ports to remember. Zero dependencies — plain
// node:http. Start it after a build:  npm run build && npm run serve
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 8080);

// route path → dist folder. Order matters for the "/" root entry only.
const LABS = {
  '/c/': 'chem-lab',
  '/b/': 'biology-lab',
  '/m/': 'math-lab',
  '/p/': 'physics-lab'
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function pathFor(url) {
  // "/b", "/b/", "/b/index.html" → { dir: "biology-lab", rest: "..." }
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${PORT}`).pathname);
  if (pathname === '/') return { dir: 'chem-lab', rest: '/' };
  const entry = Object.entries(LABS).find(([route]) =>
    pathname === route.slice(0, -1) || pathname.startsWith(route));
  if (!entry) return null;
  return { dir: entry[1], rest: pathname.slice(entry[0].length - 1) }; // keep leading '/'
}

const server = createServer(async (req, res) => {
  try {
    const info = pathFor(req.url);
    if (!info) return send(res, 404, 'text/plain; charset=utf-8', '404 — unknown lab route');

    const baseDir = resolve(ROOT, info.dir, 'dist');
    const filePath = normalize(resolve(baseDir, '.' + info.rest));

    // Path-traversal guard: the resolved path must stay inside this lab's dist.
    if (filePath !== baseDir && !filePath.startsWith(baseDir + sep)) {
      return send(res, 403, 'text/plain; charset=utf-8', '403 — forbidden');
    }

    let body;
    let type;
    try {
      body = await readFile(filePath);
      type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    } catch {
      if (info.rest === '/' || info.rest === '') {
        // App root ("/c", "/c/"): serve the app's index. Deeper paths that
        // don't exist (e.g. /c/assets/) are real 404s.
        try { body = await readFile(resolve(baseDir, 'index.html')); }
        catch { return send(res, 404, 'text/plain; charset=utf-8', '404 — not found (did you run npm run build?)'); }
        type = 'text/html; charset=utf-8';
      } else {
        return send(res, 404, 'text/plain; charset=utf-8', '404 — not found');
      }
    }

    // Hashed build assets are immutable; HTML is always fresh.
    const cache = type.startsWith('text/html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
    res.end(body);
  } catch (err) {
    console.error('server error:', err);
    send(res, 500, 'text/plain; charset=utf-8', '500 — internal error');
  }
});

function send(res, status, type, text) {
  res.writeHead(status, { 'Content-Type': type });
  res.end(text);
}

server.listen(PORT, () => {
  console.log(`Lab backend on http://localhost:${PORT}`);
  console.log('  /c  Chemistry Lab    /b  Biology Lab');
  console.log('  /m  Mathematics Lab  /p  Physics Lab');
});