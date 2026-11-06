/* 用途：缓存构建产物，让公告板在首次加载后离线运行。用法：生产构建由应用自动注册。依赖：浏览器 Service Worker、构建生成的 precache.json。 */
const CACHE_PREFIX = `afterlight-static-${encodeURIComponent(new URL(self.registration.scope).pathname)}-`;
const currentCache = `${CACHE_PREFIX}__BUILD_ID__`;
const scopedUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch(scopedUrl('./precache.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error('无法读取离线资源列表');
    const manifest = await response.json();
    const files = Array.isArray(manifest) ? manifest : manifest.files;
    if (!Array.isArray(files) || !files.length) throw new Error('离线资源列表为空');
    // 构建脚本替换缓存版本，确保 HTML 和静态资源作为同一版本离线使用。
    const cache = await caches.open(currentCache);
    const urls = [...new Set(['./', './index.html', ...files].map(scopedUrl))];
    await cache.addAll(urls.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== currentCache) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(currentCache);
    if (request.mode === 'navigate') {
      return await cache.match(scopedUrl('./index.html')) || fetch(request);
    }
    return await cache.match(request) || fetch(request);
  })());
});
