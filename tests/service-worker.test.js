import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

// 模拟浏览器缓存与离线网络，执行实际 SW 源码，验证仓库子路径和隔离边界。
function workerHarness() {
  const scope = 'https://example.test/afterlight-bbs/';
  const handlers = new Map();
  const stores = new Map();
  const requests = [];
  const flags = { offline: false, claimed: false, skipped: false };
  const files = ['./', './index.html', './assets/app-a1.js', './assets/app-a1.css', './icon.svg'];
  const keyOf = (value) => typeof value === 'string' ? value : value.url;
  const network = async (value) => {
    const url = keyOf(value);
    requests.push(url);
    if (flags.offline) throw new TypeError('模拟网络断开');
    if (url === new URL('./precache.json', scope).href) return Response.json(files);
    return new Response(`资源：${url}`);
  };
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        addAll: async (values) => {
          const entries = await Promise.all(values.map(async value => [keyOf(value), await network(value)]));
          for (const [key, response] of entries) store.set(key, response);
        },
        match: async value => store.get(keyOf(value))?.clone(),
      };
    },
  };
  runInNewContext(source.replaceAll('__BUILD_ID__', 'test-version'), {
    URL, Request, caches, fetch: network,
    self: {
      registration: { scope },
      location: { origin: new URL(scope).origin },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: async () => { flags.skipped = true; },
      clients: { claim: async () => { flags.claimed = true; } },
    },
  });
  async function lifecycle(name) {
    let pending;
    handlers.get(name)({ waitUntil: value => { pending = value; } });
    await pending;
  }
  async function fetchRequest(path, mode = 'cors', method = 'GET') {
    let response;
    handlers.get('fetch')({ request: { url: new URL(path, scope).href, mode, method }, respondWith: value => { response = value; } });
    return response;
  }
  return { scope, stores, requests, flags, lifecycle, fetchRequest };
}

test('SW 在 GitHub Pages 子路径预缓存，断网后可读取导航、JS 与 CSS', async () => {
  const worker = workerHarness();
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  assert.equal(worker.flags.skipped, true);
  assert.equal(worker.flags.claimed, true);
  assert.ok(worker.requests.every(url => url.startsWith(worker.scope)));
  const before = worker.requests.length;
  worker.flags.offline = true;
  for (const [path, mode] of [['./', 'navigate'], ['./assets/app-a1.js', 'cors'], ['./assets/app-a1.css', 'cors']]) {
    const response = await worker.fetchRequest(path, mode);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /资源：/u);
  }
  assert.equal(worker.requests.length, before);
});

test('SW 激活只清理本应用的旧缓存，并保留其他仓库缓存', async () => {
  const worker = workerHarness();
  worker.stores.set('afterlight-static-%2Fafterlight-bbs%2F-old-version', new Map());
  worker.stores.set('afterlight-static-%2Fanother-app%2F-old-version', new Map());
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  assert.equal(worker.stores.has('afterlight-static-%2Fafterlight-bbs%2F-old-version'), false);
  assert.equal(worker.stores.has('afterlight-static-%2Fanother-app%2F-old-version'), true);
});

test('SW 不拦截跨域、仓库外路径与写入请求，未缓存资源不伪装成功', async () => {
  const worker = workerHarness();
  await worker.lifecycle('install');
  assert.equal(await worker.fetchRequest('https://other.test/data'), undefined);
  assert.equal(await worker.fetchRequest('/another-app/'), undefined);
  assert.equal(await worker.fetchRequest('./', 'cors', 'POST'), undefined);
  worker.flags.offline = true;
  await assert.rejects(worker.fetchRequest('./assets/missing.js'), /模拟网络断开/u);
});
