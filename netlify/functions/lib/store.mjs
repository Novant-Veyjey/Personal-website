/* ============================================================
   统一存储层
   ------------------------------------------------------------
   线上有两种运行环境，存储自动切换：
     · Netlify 部署：用 Netlify Blobs（无需第三方服务，同源读写）。
     · EdgeOne Pages Functions 部署：用 EdgeOne 自带 KV（绑定命名空间后
       作为全局变量 KV 访问，KV.get/KV.put，键值按 "store/key" 组织）。
   本地开发（node server.mjs）：数据落到 netlify/.data/*.json。
   三者通过 useBlobs() / useKV() 自动判别，调用方无感知。

   并发安全（防同名账号被同时注册出来）：
   · 线上：writeKey(..., { onlyIfNew: true }) 走 Blobs 的条件写入，
           同一键并发写入只有第一个能成功，其余直接报 KEY_EXISTS。
   · 本地：文件读写全部排进一条串行队列，效果等价（同一键也只会写成功一次）。
   ============================================================ */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = path.resolve(here, '../../.data');

/* 线上运行时 Netlify 会注入 Blobs 上下文；本地没有，就走文件。 */
function useBlobs() {
  return Boolean(process.env.NETLIFY_BLOBS_CONTEXT || process.env.SITE_ID || process.env.NETLIFY);
}
/* EdgeOne Pages Functions：绑定了 KV 命名空间后，KV 会作为全局变量存在。 */
function useKV() {
  return typeof globalThis.KV !== 'undefined';
}

async function localFile(storeName) {
  return path.join(LOCAL_DIR, `${storeName.replace(/[^\w.-]/g, '_')}.json`);
}

/* 「键已存在」的统一错误：调用方按 error.code === 'KEY_EXISTS' 判断 */
function keyExistsError(key) {
  const error = new Error(`KEY_EXISTS: ${key}`);
  error.code = 'KEY_EXISTS';
  return error;
}
/* 条件写入失败（键已存在）时 Blobs 会返回 412 */
function isConflict(error) {
  if (!error) return false;
  if (error.status === 412 || error.statusCode === 412) return true;
  return /412|already exists|condition .*not met|precondition/i.test(String(error.message || ''));
}
/* 极少数老版本 SDK 不认识 onlyIfNew 选项，报的是参数错误 —— 这种情况退回普通写入，
   避免把「注册」直接搞坏（重复检查仍有 createUser 里的前置查询兜底）。 */
function isUnknownOption(error) {
  return /onlyIfNew|unknown option|invalid option|unrecognized|unexpected/i.test(String((error && error.message) || ''));
}

export async function readKey(storeName, key, fallback = null) {
  if (useKV()) {
    const raw = await globalThis.KV.get(`${storeName}/${key}`);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }
  if (useBlobs()) {
    try {
      const { getStore } = await import('@netlify/blobs');
      const value = await getStore(storeName).get(key, { type: 'json' });
      return value === null || value === undefined ? fallback : value;
    } catch (error) {
      console.error('[store] Blobs 读取失败：', error && error.message);
      return fallback;
    }
  }
  try {
    const all = JSON.parse(await fs.readFile(await localFile(storeName), 'utf8'));
    return all && Object.prototype.hasOwnProperty.call(all, key) ? all[key] : fallback;
  } catch {
    return fallback;
  }
}

export async function writeKey(storeName, key, value, options = {}) {
  const body = JSON.stringify(value);

  if (useKV()) {
    const fullKey = `${storeName}/${key}`;
    /* KV 没有原子的条件写入：先查后写兜底防重名（个人站并发极低，足够） */
    if (options.onlyIfNew) {
      const existing = await globalThis.KV.get(fullKey);
      if (existing != null) throw keyExistsError(key);
    }
    await globalThis.KV.put(fullKey, body);
    return;
  }

  if (useBlobs()) {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore(storeName);
    if (!options.onlyIfNew) {
      await store.set(key, body);
      return;
    }
    try {
      await store.set(key, body, { onlyIfNew: true });
    } catch (error) {
      if (isConflict(error)) throw keyExistsError(key);
      if (isUnknownOption(error)) { await store.set(key, body); return; }
      throw error;
    }
    return;
  }

  return serialize(async () => {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    const file = await localFile(storeName);
    let all = {};
    try { all = JSON.parse(await fs.readFile(file, 'utf8')) || {}; } catch {}
    if (options.onlyIfNew && Object.prototype.hasOwnProperty.call(all, key)) throw keyExistsError(key);
    all[key] = value;
    await fs.writeFile(file, JSON.stringify(all, null, 2));
  });
}

/* 本地文件版：所有写操作排成一条队列，避免「读-改-写」被并发交叉 */
let writeQueue = Promise.resolve();
function serialize(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(() => {}, () => {});
  return run;
}
