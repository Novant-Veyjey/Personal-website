import { getStore } from '@netlify/blobs';

const STORE_NAME = 'signal-messages';
const KEY = 'profile';
// 管理员密钥：只用于保护「官方联系方式」三项（email / github / wechat）。
// 其余资料字段免密钥即可写入；只有填对该密钥，联系方式才会被覆盖。
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
  tags: 100, cardKicker: 40, email: 80, github: 160, wechat: 40, note: 100,
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
    let body = {};
    try { body = await request.json(); } catch (_) {}
    const incoming = sanitize(body);
    const current = (await store.get(KEY, { type: 'json' })) || {};
    const CONTACT_FIELDS = ['email', 'github', 'wechat'];
    const keyOk = request.headers.get('x-owner-key') === OWNER_KEY;
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
    await store.set(KEY, JSON.stringify(merged));
    return json({ profile: merged, contactLocked });
  }

  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
};
