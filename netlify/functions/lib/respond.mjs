/* 把 handleApi 的返回包装成 Netlify Function 的 Response */
export function toResponse(result) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (result.setCookie) headers['Set-Cookie'] = result.setCookie;
  return new Response(JSON.stringify(result.json), { status: result.status, headers });
}

/* 兼容两种访问路径：/api/auth/xxx 与 /.netlify/functions/auth/xxx
   （Netlify 的重写会保留原始路径，但直接访问函数地址也要能用） */
export function canonicalPath(pathname, segment) {
  const tail = pathname.split(`/${segment}`).pop() || '';
  return `/api/${segment}${tail}`;
}
