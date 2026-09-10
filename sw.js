// 山水S酒店 · 菜单系统 Service Worker（离线缓存 + 安装为 App）
// CACHE 由 `npm run build:cache` 按核心静态文件内容生成；`npm test` 会拦截过期缓存键。
// 发布流程先执行 `npm run build`，无需也不得手动递增版本号。
const CACHE = 'ss-menu-45c9f8710b46';
const ASSETS = [
  './',
  './index.html',
  './assets/style.css',
  './assets/data.js',
  './assets/store.js',
  './assets/app.js',
  './assets/export-assets.js',
  './assets/custom.js',
  './data/menu-config.json',
  // BEGIN GENERATED IMAGE ASSETS
  './data/img/lib01.jpg',
  './data/img/lib017.jpg',
  './data/img/lib018.jpg',
  './data/img/lib019.jpg',
  './data/img/lib02.jpg',
  './data/img/lib020.jpg',
  './data/img/lib021.jpg',
  './data/img/lib022.jpg',
  './data/img/lib023.jpg',
  './data/img/lib024.jpg',
  './data/img/lib025.jpg',
  './data/img/lib026.jpg',
  './data/img/lib027.jpg',
  './data/img/lib028.jpg',
  './data/img/lib029.jpg',
  './data/img/lib03.jpg',
  './data/img/lib033.jpg',
  './data/img/lib034.jpg',
  './data/img/lib035.jpg',
  './data/img/lib036.jpg',
  './data/img/lib037.jpg',
  './data/img/lib038.jpg',
  './data/img/lib039.jpg',
  './data/img/lib04.jpg',
  './data/img/lib040.jpg',
  './data/img/lib041.jpg',
  './data/img/lib042.jpg',
  './data/img/lib043.jpg',
  './data/img/lib048.jpg',
  './data/img/lib05.jpg',
  './data/img/lib053.jpg',
  './data/img/lib055.jpg',
  './data/img/lib06.jpg',
  './data/img/lib08.jpg',
  './data/img/lib09.jpg',
  './data/img/lib10.jpg',
  './data/img/lib11.jpg',
  './data/img/lib12.jpg',
  './data/img/lib13.jpg',
  './data/img/lib14.jpg',
  './data/img/lib15.jpg',
  './data/img/lib16.jpg',
  './assets/export/banquet-a4-fixed-template.png',
  './assets/export/banquet-a4-reference-bg.png',
  // END GENERATED IMAGE ASSETS
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 网络优先：有网时始终拉最新；离线时回退到缓存（保证断网也能展示菜单）
// 关键：fetch 带 cache:'no-cache'，绕开 CDN / 浏览器 HTTP 缓存，避免把「旧 app.js」锁进 SW 缓存。
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        // 仅缓存同源、2xx 的 GET 响应，且不缓存带 query 的动态请求之外的静态资源
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
