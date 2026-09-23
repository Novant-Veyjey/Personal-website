/* ============================================================
   账号表（存 Netlify Blobs / 本地文件）
   ------------------------------------------------------------
   · 账号名＝昵称，昵称唯一；注册后直接用它登录，留言里显示的也是它
   · 不发验证邮件、不需要邮箱；密码用 scrypt + 每账号随机盐做哈希，明文不落盘
   · id 用于把留言绑到账号上，日后若允许改昵称，历史留言也不会串
   ============================================================ */
import crypto from 'node:crypto';
import { readKey, writeKey } from './store.mjs';

const STORE = 'signal-users';

export function accountKey(name) {
  return `n:${String(name || '').trim().toLowerCase()}`;
}

export function publicUser(user) {
  return { id: user.id, name: user.name };
}

export async function findUser(name) {
  const key = accountKey(name);
  if (key === 'n:') return null;
  return readKey(STORE, key, null);
}

function duplicateError() {
  const error = new Error('这个昵称已经被用了，换一个吧。');
  error.code = 'ACCOUNT_EXISTS';
  return error;
}

export async function createUser({ name, password }) {
  const key = accountKey(name);

  /* 先查一次：绝大多数重名在这里就能拦下，给出友好提示 */
  const existing = await readKey(STORE, key, null);
  if (existing) throw duplicateError();

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const user = {
    id: crypto.randomUUID(),
    name,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };

  /* 再原子写入：两个请求同一瞬间抢同一个昵称时，只有一个能写成功 */
  try {
    await writeKey(STORE, key, user, { onlyIfNew: true });
  } catch (error) {
    if (error && error.code === 'KEY_EXISTS') throw duplicateError();
    throw error;
  }
  return user;
}

export function verifyPassword(user, password) {
  if (!user || typeof user.hash !== 'string' || typeof user.salt !== 'string') return false;
  const hash = crypto.scryptSync(password, user.salt, 64).toString('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(user.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
