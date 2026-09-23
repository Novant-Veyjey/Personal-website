/* ============================================================
   本地开发服务器（node server.mjs）
   ------------------------------------------------------------
   作用：把「网站」和「本站自带后端」一起跑起来，和线上行为一致：
     · 静态文件：index.html / assets / holo-card-deck …
     · /api/auth/*      账号接口      （与 Netlify Function 共用 lib/api.mjs）
     · /api/messages    留言与回复     （同上）
     · /api/profile     档案资料       （同上，带站长密钥）
   数据默认落在 netlify/.data/*.json（线上则是 Netlify Blobs）。
   端口：PORT 环境变量，默认 5173。
   ============================================================ */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleApi } from './netlify/functions/lib/api.mjs';
import { readKey, writeKey } from './netlify/functions/lib/store.mjs';

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
  '.woff2': 'font/woff2',
};

function safePath(urlPath) {
  const filename = path.resolve(root, `.${urlPath}`);
  return filename === root || filename.startsWith(`${root}${path.sep}`) ? filename : null;
}

function sendJson(response, status, body, setCookie) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (setCookie) headers['Set-Cookie'] = setCookie;
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

/* 档案资料：与 netlify/functions/profile.mjs 同逻辑，方便本地调试 */
const OWNER_KEY = process.env.SITE_OWNER_KEY || 'UPSIDE-DOWN-7F3K-OWNER';
const PROFILE_FIELDS = {
  cnName: 24, enName: 32, role: 40, location: 40, initials: 3,
  oneLine: 64, statement: 120, bio0: 220, bio1: 220, bio2: 220,
  tags: 100, email: 80, github: 160, wechat: 40, note: 100,
};
function sanitizeProfile(input) {
  const data = input || {};
  const out = {};
  for (const [field, max] of Object.entries(PROFILE_FIELDS)) {
    if (typeof data[field] === 'string') out[field] = data[field].trim().slice(0, max);
  }
  if (Array.isArray(data.extras)) {
    out.extras = data.extras
      .filter((item) => item && typeof item.label === 'string' && typeof item.value === 'string')
      .slice(0, 10)
      .map((item) => ({ label: item.label.trim().slice(0, 16), value: item.value.trim().slice(0, 60) }));
  }
  if (typeof data.avatar === 'string' && data.avatar.startsWith('data:image/') && data.avatar.length <= 2500000) {
    out.avatar = data.avatar;
  }
  return out;
}

async function handleProfile(request, response) {
  if (request.method === 'GET') {
    const profile = await readKey('signal-messages', 'profile', null);
    return sendJson(response, 200, { profile: profile && typeof profile === 'object' ? profile : null });
  }
  if (request.method === 'POST') {
    if ((request.headers['x-owner-key'] || '') !== OWNER_KEY) return sendJson(response, 403, { error: 'FORBIDDEN' });
    const profile = sanitizeProfile(await readBody(request));
    await writeKey('signal-messages', 'profile', profile);
    return sendJson(response, 200, { profile });
  }
  return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
}

http.createServer(async (request, response) => {
  try {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);

    if (urlPath.startsWith('/api/auth')) {
      const body = request.method === 'POST' ? await readBody(request) : {};
      const result = await handleApi({
        method: request.method,
        pathname: urlPath,
        body,
        cookie: request.headers.cookie || '',
      });
      return sendJson(response, result.status, result.json, result.setCookie);
    }

    if (urlPath === '/api/messages' || urlPath.startsWith('/api/messages/')) {
      const body = request.method === 'POST' ? await readBody(request) : {};
      const result = await handleApi({
        method: request.method,
        pathname: urlPath,
        body,
        cookie: request.headers.cookie || '',
      });
      return sendJson(response, result.status, result.json, result.setCookie);
    }

    if (urlPath === '/api/profile' || urlPath === '/.netlify/functions/profile') {
      return handleProfile(request, response);
    }

    let filename = safePath(urlPath);
    if (!filename) { response.writeHead(403); return response.end('Forbidden'); }
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const data = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(data);
  } catch {
    if (!response.headersSent) response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Upside Down personal site: http://127.0.0.1:${port}/`));
