import { getStore } from '@netlify/blobs';

const STORE_NAME = 'signal-messages';
const KEY = 'profile';
// 站长密钥：只有带对 x-owner-key 的请求才能改写全站资料。
// 仓库是公开的，之后可在 Netlify 后台改用环境变量提升安全性。
const OWNER_KEY = 'UPSIDE-DOWN-7F3K-OWNER';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,x-owner-key',
      'Cache-Control': 'no-store',
    },
  });
}

const FIELDS = {
  cnName: 24, enName: 32, role: 40, location: 40, initials: 3,
  oneLine: 64, statement: 120, bio0: 220, bio1: 220, bio2: 220,
  tags: 100, email: 80, github: 160, wechat: 40, note: 100,
};

function sanitize(input) {
  const data = input || {};
  const out = {};
  for (const [field, max] of Object.entries(FIELDS)) {
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

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,x-owner-key',
      },
    });
  }

  const store = getStore(STORE_NAME);

  if (request.method === 'GET') {
    const profile = await store.get(KEY, { type: 'json' });
    return json({ profile: profile && typeof profile === 'object' ? profile : null });
  }

  if (request.method === 'POST') {
    if (request.headers.get('x-owner-key') !== OWNER_KEY) {
      return json({ error: 'FORBIDDEN' }, 403);
    }
    let body = {};
    try { body = await request.json(); } catch (_) {}
    const profile = sanitize(body);
    await store.set(KEY, JSON.stringify(profile));
    return json({ profile });
  }

  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
};
