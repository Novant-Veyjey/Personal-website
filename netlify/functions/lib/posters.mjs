/* ============================================================
   照片球（自定义海报）按账号云端存储
   ------------------------------------------------------------
   接口：
     GET  /api/posters   当前登录账号的海报列表（未登录 401）
     POST /api/posters   { posters: [{ src, alt, landscape }] } 覆盖保存
   存储：signal-posters / u:<uid>（store.mjs 自动适配 KV / Blobs / 本地文件）
   限制：最多 16 张，单张 dataURL ≤ 1.2M 字符，总量 ≤ 8M 字符。
   ============================================================ */
import { readKey, writeKey } from './store.mjs';
import { userFromCookie } from './session.mjs';

const STORE = 'signal-posters';
const MAX_ITEMS = 16;
const MAX_SRC = 1200000;
const MAX_TOTAL = 8000000;

function ok(body) { return { status: 200, json: Object.assign({ ok: true }, body) }; }
function fail(status, error) { return { status, json: { ok: false, error } }; }

export async function handlePosters({ method, body, cookie }) {
  const user = userFromCookie(cookie);
  if (!user) return fail(401, '请先登录再同步照片。');

  if (String(method).toUpperCase() === 'GET') {
    const posters = await readKey(STORE, 'u:' + user.uid, []);
    return ok({ posters: Array.isArray(posters) ? posters : [] });
  }

  if (String(method).toUpperCase() === 'POST') {
    const list = body && Array.isArray(body.posters) ? body.posters : null;
    if (!list) return fail(400, '数据格式不对。');
    const clean = list
      .filter((item) => item && typeof item.src === 'string' && item.src.startsWith('data:image/'))
      .slice(0, MAX_ITEMS)
      .map((item) => ({
        src: item.src.slice(0, MAX_SRC),
        alt: String(item.alt || '').slice(0, 80),
        landscape: !!item.landscape,
      }));
    const total = clean.reduce((sum, item) => sum + item.src.length, 0);
    if (total > MAX_TOTAL) return fail(413, '照片总量太大，删几张再试。');
    await writeKey(STORE, 'u:' + user.uid, clean);
    return ok({ posters: clean });
  }

  return fail(405, 'METHOD_NOT_ALLOWED');
}
