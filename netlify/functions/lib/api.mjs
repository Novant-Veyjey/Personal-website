/* ============================================================
   本站自带后端：所有接口的唯一实现
   ------------------------------------------------------------
   线上由 Netlify Functions 调用，本地由 server.mjs 调用同一份逻辑，
   所以「本地能跑通」＝「线上就能跑通」。
   ------------------------------------------------------------
   接口一览：
     GET  /api/auth/session   当前登录账号（未登录返回 user: null）
     POST /api/auth/register  { name, password }   ← name 即昵称，也是登录账号
     POST /api/auth/login     { name, password }
     POST /api/auth/logout
     GET  /api/messages       全部留言与回复（公开，含未登录访客）
     POST /api/messages       { message }           需登录
     POST /api/messages/:id/replies { message }     需登录
   ------------------------------------------------------------
   安全要点：留言作者一律取服务端会话里的账号名，前端传什么都不作数，
            因此无法冒充别人。
   ============================================================ */
import { readKey, writeKey } from './store.mjs';
import { createUser, findUser, publicUser, verifyPassword } from './users.mjs';
import { clearedCookie, createToken, sessionCookie, userFromCookie } from './session.mjs';

const BOARD_STORE = 'signal-messages';
const BOARD_KEY = 'board';

function ok(body, extra = {}) {
  return { status: 200, json: { ok: true, ...body }, ...extra };
}
function fail(status, error) {
  return { status, json: { ok: false, error } };
}
function text(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function readBoard() {
  const raw = await readKey(BOARD_STORE, BOARD_KEY, []);
  return Array.isArray(raw) ? raw : [];
}
async function writeBoard(list) {
  await writeKey(BOARD_STORE, BOARD_KEY, list.slice(0, 200));
}
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function publicMessage(item) {
  return {
    id: item.id,
    name: item.name,
    message: item.message,
    createdAt: item.createdAt,
    replies: Array.isArray(item.replies) ? item.replies : [],
  };
}

/* Blobs 写后读有短暂一致性延迟；刚发完留言立刻回复时按 id 找不到就小步重试 */
async function findThread(id, attempts = 5) {
  let messages = await readBoard();
  let target = messages.find((item) => item.id === id);
  let attempt = 0;
  while (!target && attempt < attempts) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    messages = await readBoard();
    target = messages.find((item) => item.id === id);
    attempt++;
  }
  return { messages, target };
}

export async function handleApi({ method, pathname, body, cookie }) {
  const body_ = body && typeof body === 'object' ? body : {};
  const user = userFromCookie(cookie);
  const route = `${method.toUpperCase()} ${pathname.replace(/\/+$/, '') || '/'}`;

  /* ---------------- 账号 ---------------- */
  if (route === 'GET /api/auth/session') {
    return ok({ user: user ? { id: user.uid, name: user.name } : null });
  }

  if (route === 'POST /api/auth/register') {
    const name = text(body_.name, 20);
    const password = String(body_.password || '');
    if (name.length < 2) return fail(400, '昵称至少 2 个字。');
    if (password.length < 6) return fail(400, '密码至少需要 6 位。');

    try {
      const created = await createUser({ name, password });
      const token = createToken({ id: created.id, name: created.name });
      return ok({ user: publicUser(created) }, { setCookie: sessionCookie(token) });
    } catch (error) {
      if (error && error.code === 'ACCOUNT_EXISTS') return fail(409, error.message);
      console.error('[api] 注册失败：', error && error.message);
      return fail(500, '注册失败，请稍后再试。');
    }
  }

  if (route === 'POST /api/auth/login') {
    const name = text(body_.name, 20);
    const password = String(body_.password || '');
    if (!name || !password) return fail(400, '请填写昵称和密码。');
    const found = await findUser(name);
    if (!found || !verifyPassword(found, password)) return fail(401, '昵称或密码不对。');
    const token = createToken({ id: found.id, name: found.name });
    return ok({ user: publicUser(found) }, { setCookie: sessionCookie(token) });
  }

  if (route === 'POST /api/auth/logout') {
    return ok({ user: null }, { setCookie: clearedCookie() });
  }

  /* ---------------- 留言板 ---------------- */
  if (route === 'GET /api/messages') {
    const messages = await readBoard();
    return ok({ messages: messages.map(publicMessage) });
  }

  const replyMatch = pathname.match(/^\/api\/messages\/([^/]+)\/replies$/);
  if (method.toUpperCase() === 'POST' && (route === 'POST /api/messages' || replyMatch)) {
    if (!user) return fail(401, '请先登录再留言。');
    const content = text(body_.message, 500);
    if (!content) return fail(400, '留言内容不能为空。');

    if (replyMatch) {
      const id = decodeURIComponent(replyMatch[1]);
      const { messages, target } = await findThread(id);
      if (!target) return fail(404, '这条留言已不存在。');
      target.replies = Array.isArray(target.replies) ? target.replies : [];
      target.replies.push({
        id: makeId(),
        userId: user.uid,
        name: user.name,          // 作者＝服务端会话里的账号名
        message: content,
        createdAt: new Date().toISOString(),
      });
      await writeBoard(messages);
      return ok({ messages: messages.map(publicMessage) });
    }

    const messages = await readBoard();
    messages.unshift({
      id: makeId(),
      userId: user.uid,
      name: user.name,
      message: content,
      createdAt: new Date().toISOString(),
      replies: [],
    });
    await writeBoard(messages);
    return ok({ messages: messages.map(publicMessage) });
  }

  return fail(404, '接口不存在。');
}
