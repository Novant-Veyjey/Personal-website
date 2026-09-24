/* ============================================================
   EdgeOne Pages Functions 入口（替代 Netlify Functions）
   ------------------------------------------------------------
   路由：functions/api/[[path]].js 捕获 /api/* 全部请求，
        用真实 URL pathname 交给现有 handleApi 分发，零改动复用后端逻辑。

   存储：自动走 netlify/functions/lib/store.mjs 的 EdgeOne KV 分支
         （需在 EdgeOne 控制台把 KV 命名空间绑定为变量名 KV）。

   说明：前端（EdgeOne Pages 静态托管）与 Functions 同源，
        因此 /api/* 无需跨域；这里仍补了 CORS 头，方便本地或特殊部署调试。

   部署注意：
     · 函数运行时选「Node.js」（后端用 node:crypto）。
     · 绑定 KV 命名空间，变量名填 KV。
     · 可选环境变量：SITE_SESSION_SECRET（会话签名密钥）、
       SITE_OWNER_KEY（档案联系方式密钥，默认 UPSIDE-DOWN-7F3K-OWNER）。
   ============================================================ */
import { handleApi } from '../../netlify/functions/lib/api.mjs';
import { readKey, writeKey } from '../../netlify/functions/lib/store.mjs';

const STORE = 'signal-messages';
const PROFILE_KEY = 'profile';
const OWNER_KEY = process.env.SITE_OWNER_KEY || 'UPSIDE-DOWN-7F3K-OWNER';
const CONTACT_FIELDS = ['email', 'github'];

const PROFILE_FIELDS = {
  cnName: 24, enName: 32, role: 40, location: 40, initials: 3,
  oneLine: 64, statement: 120, bio0: 220, bio1: 220, bio2: 220,
  tags: 100, cardKicker: 40, email: 80, github: 160, note: 100,
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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,x-owner-key',
      'Cache-Control': 'no-store',
    },
  });
}

/* 档案资料（与 netlify/functions/profile.mjs 同逻辑，改用 KV 存储层） */
async function handleProfile(req) {
  if (req.method === 'GET') {
    const profile = await readKey(STORE, PROFILE_KEY, null);
    return json({ profile: profile && typeof profile === 'object' ? profile : null });
  }
  if (req.method === 'POST') {
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const incoming = sanitizeProfile(body);
    const current = (await readKey(STORE, PROFILE_KEY, null)) || {};
    const keyOk = req.headers.get('x-owner-key') === OWNER_KEY;
    const merged = Object.assign({}, current, incoming);
    /* 官方联系方式只有填对密钥才能改；否则保留已存值，避免被游客覆盖 */
    let contactLocked = false;
    if (!keyOk) {
      CONTACT_FIELDS.forEach((f) => {
        if (Object.prototype.hasOwnProperty.call(incoming, f)) {
          merged[f] = current[f] != null ? current[f] : '';
          contactLocked = true;
        }
      });
    }
    await writeKey(STORE, PROFILE_KEY, merged);
    return json({ profile: merged, contactLocked });
  }
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
}

function toResponse(result) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,x-owner-key',
    'Cache-Control': 'no-store',
  };
  if (result.setCookie) headers['Set-Cookie'] = result.setCookie;
  return new Response(JSON.stringify(result.json), { status: result.status, headers });
}

export async function onRequest(context) {
  const req = context.request;

  /* 预检：本地调试或跨域时放行 */
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,x-owner-key',
      },
    });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;
  const cookie = req.headers.get('cookie') || '';

  /* 档案走独立处理；其余 /api/auth、/api/messages 交给现有 handleApi */
  if (pathname.startsWith('/api/profile')) return handleProfile(req);

  let body = {};
  if (method !== 'GET' && method !== 'OPTIONS') {
    try { body = await req.json(); } catch (_) {}
  }
  const result = await handleApi({ method, pathname, body, cookie });
  return toResponse(result);
}
