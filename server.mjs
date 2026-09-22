import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);
const localMessages = [];
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
function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}
async function body(request) {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}
function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function sortedMessages() {
  return localMessages.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
async function api(request, response, urlPath) {
  const replyMatch = urlPath.match(/^\/api\/messages\/([^/]+)\/replies\/?$/);
  if (request.method === 'GET' && urlPath === '/api/messages') return json(response, 200, { messages: sortedMessages(), mode: 'local-server' });
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed' });
  const data = await body(request);
  const name = clean(data.name, 40);
  const message = clean(data.message, 500);
  if (!name || !message) return json(response, 400, { error: 'Name and message are required' });
  if (replyMatch) {
    const thread = localMessages.find((item) => item.id === decodeURIComponent(replyMatch[1]));
    if (!thread) return json(response, 404, { error: 'Message not found' });
    thread.replies.push({ id: crypto.randomUUID(), name, message, createdAt: new Date().toISOString() });
    return json(response, 201, { message: thread, messages: sortedMessages() });
  }
  const thread = { id: crypto.randomUUID(), name, message, createdAt: new Date().toISOString(), replies: [] };
  localMessages.push(thread);
  return json(response, 201, { message: thread, messages: sortedMessages() });
}

http.createServer(async (request, response) => {
  try {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (urlPath === '/api/messages' || urlPath.startsWith('/api/messages/')) return api(request, response, urlPath);
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
    if (!response.headersSent) response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Upside Down personal site: http://127.0.0.1:${port}/`));
