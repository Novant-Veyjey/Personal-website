import { getStore } from '@netlify/blobs';

const STORE_NAME = 'signal-messages';
const KEY = 'board';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  });
}

function normalizeMessage(input) {
  const data = input || {};
  return {
    id: typeof data.id === 'string' && data.id ? data.id : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
    name: (String(data.name || '').trim().slice(0, 40)) || '匿名信号',
    message: String(data.message || '').trim().slice(0, 500),
    createdAt: new Date().toISOString(),
    replies: [],
  };
}

function normalizeReply(input) {
  const data = input || {};
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: (String(data.name || '').trim().slice(0, 40)) || '匿名信号',
    message: String(data.message || '').trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  };
}

async function readBoard() {
  const store = getStore(STORE_NAME);
  const raw = await store.get(KEY, { type: 'json' });
  return Array.isArray(raw) ? raw : [];
}

async function writeBoard(list) {
  const store = getStore(STORE_NAME);
  await store.set(KEY, JSON.stringify(list.slice(0, 200)));
}

// Blobs 写后读有短暂一致性延迟，回复时按 id 查找失败则小幅重试，避免刚发完留言立刻回复时 404 掉回本地
async function findTarget(id, attempts) {
  let messages = await readBoard();
  let target = messages.find((m) => m.id === id);
  let attempt = 0;
  while (!target && attempt < (attempts || 5)) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    messages = await readBoard();
    target = messages.find((m) => m.id === id);
    attempt++;
  }
  return { messages, target };
}

export default async (request) => {
  const url = new URL(request.url);
  const tail = (url.pathname.split('/messages').pop() || '').replace(/^\//, '');

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method === 'GET') {
    const messages = await readBoard();
    return json({ messages });
  }

  if (request.method === 'POST') {
    let body = {};
    try { body = await request.json(); } catch (_) {}

    const replyMatch = tail.match(/^([^/]+)\/replies$/);
    if (replyMatch) {
      const id = decodeURIComponent(replyMatch[1]);
      const found = await findTarget(id, 5);
      const messages = found.messages;
      const target = found.target;
      if (!target) return json({ error: 'NOT_FOUND' }, 404);
      target.replies = Array.isArray(target.replies) ? target.replies : [];
      target.replies.push(normalizeReply(body));
      await writeBoard(messages);
      return json({ messages });
    }

    const item = normalizeMessage(body);
    const messages = await readBoard();
    messages.unshift(item);
    await writeBoard(messages);
    return json({ messages });
  }

  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
};
