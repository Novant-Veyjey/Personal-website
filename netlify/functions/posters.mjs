/* Netlify Functions 版照片球接口（与 EdgeOne / 本地 server.mjs 同一套逻辑） */
import { handlePosters } from './lib/posters.mjs';

export default async (request) => {
  let body = {};
  if (request.method === 'POST') {
    try { body = await request.json(); } catch (_) {}
  }
  const result = await handlePosters({
    method: request.method,
    body,
    cookie: request.headers.get('cookie') || '',
  });
  return new Response(JSON.stringify(result.json), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  });
};
