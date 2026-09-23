/* ============================================================
   /api/messages
   ------------------------------------------------------------
   真正的逻辑都在 lib/api.mjs（和本地 server.mjs 共用同一份），
   这里只做 Netlify Function 的适配：
     GET  /api/messages              所有人可读（含未登录访客）
     POST /api/messages              登录后才能发，作者＝自己的账号
     POST /api/messages/:id/replies  登录后才能回复，作者＝自己的账号
   ============================================================ */
import { handleApi } from './lib/api.mjs';
import { canonicalPath, toResponse } from './lib/respond.mjs';

export default async (request) => {
  const url = new URL(request.url);
  const method = request.method;

  let body = {};
  if (method === 'POST') {
    try { body = await request.json(); } catch { body = {}; }
  }

  const result = await handleApi({
    method,
    pathname: canonicalPath(url.pathname, 'messages'),
    body,
    cookie: request.headers.get('cookie') || '',
  });

  return toResponse(result);
};
