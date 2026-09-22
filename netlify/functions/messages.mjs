import { getStore } from "@netlify/blobs";

const STORE_NAME = "upside-down-message-board";
const PREFIX = "messages/";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    }
  });
}

function clean(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function listMessages(store) {
  const { blobs } = await store.list({ prefix: PREFIX });
  const messages = await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json" })));
  return messages.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export default async function handler(request) {
  if (request.method === "OPTIONS") return response({ ok: true });

  const url = new URL(request.url);
  const replyMatch = url.pathname.match(/\/messages\/([^/]+)\/replies\/?$/);
  const store = getStore(STORE_NAME);

  try {
    if (request.method === "GET") {
      return response({ messages: await listMessages(store), mode: "cloud" });
    }
    if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

    const body = await readBody(request);
    const name = clean(body.name, 40);
    const message = clean(body.message, 500);
    if (!name || !message) return response({ error: "Name and message are required" }, 400);

    if (replyMatch) {
      const key = PREFIX + decodeURIComponent(replyMatch[1]);
      const thread = await store.get(key, { type: "json" });
      if (!thread) return response({ error: "Message not found" }, 404);
      thread.replies = Array.isArray(thread.replies) ? thread.replies : [];
      thread.replies.push({
        id: crypto.randomUUID(),
        name,
        message,
        createdAt: new Date().toISOString()
      });
      await store.setJSON(key, thread);
      return response({ message: thread, messages: await listMessages(store) }, 201);
    }

    const thread = {
      id: crypto.randomUUID(),
      name,
      message,
      createdAt: new Date().toISOString(),
      replies: []
    };
    await store.setJSON(PREFIX + thread.id, thread);
    return response({ message: thread, messages: await listMessages(store) }, 201);
  } catch (error) {
    console.error("message-api-error", error);
    return response({ error: "Message service unavailable" }, 503);
  }
}
