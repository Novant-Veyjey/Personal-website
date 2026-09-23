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
    pathname: canonicalPath(url.pathname, 'auth'),
    body,
    cookie: request.headers.get('cookie') || '',
  });

  return toResponse(result);
};
