/* ============================================================
   登录会话：签名 Cookie（无服务端会话表，天然支持多设备）
   ------------------------------------------------------------
   Cookie 内容 = base64url(JSON{uid,name,exp}) + '.' + HMAC-SHA256 签名
   密钥取环境变量 SITE_SESSION_SECRET；没配就用内置默认值
   （个人站够用；想更稳妥可在 Netlify 后台配一个自己的密钥）。
   ============================================================ */
import crypto from 'node:crypto';

const SECRET = process.env.SITE_SESSION_SECRET || 'upside-down-personal-site-default-secret';
const COOKIE_NAME = 'site_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 天

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createToken(user) {
  const payload = Buffer.from(JSON.stringify({
    uid: user.id,
    name: user.name,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readToken(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  const a = Buffer.from(signature || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || !data.uid || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionCookie(token) {
  const secure = process.env.NETLIFY ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export function clearedCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/* 从请求头里的 Cookie 解析出当前登录用户 */
export function userFromCookie(cookieHeader) {
  const raw = String(cookieHeader || '');
  const hit = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!hit) return null;
  return readToken(decodeURIComponent(hit.slice(COOKIE_NAME.length + 1)));
}
