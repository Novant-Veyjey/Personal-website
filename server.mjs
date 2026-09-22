import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safePath(urlPath) {
  const filename = path.resolve(root, `.${urlPath}`);
  return filename === root || filename.startsWith(`${root}${path.sep}`) ? filename : null;
}

http.createServer(async (request, response) => {
  try {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filename = safePath(urlPath);
    if (!filename) { response.writeHead(403); return response.end('Forbidden'); }
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const data = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    response.end(data);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Upside Down personal site: http://127.0.0.1:${port}/`));
