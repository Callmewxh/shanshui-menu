// 山水S酒店 · 菜单系统 Service Worker（离线缓存 + 安装为 App）
// ⚠️ 每次发布新版本请同步 +1 本版本号（v7→v8→…），并在 index.html 的 register 选项中保持 updateViaCache:'none'。
//    原因：本系统纯静态部署，若 CACHE 键不变，已安装 PWA 的设备会一直跑缓存里的旧 app.js / custom.js，
//    表现为「代码改了但设备上没反应」。版本号一变 → 激活时自动清掉旧缓存，设备下次打开即拉取最新代码。
const CACHE = 'ss-menu-v8';
const ASSETS = [
  './',
  './index.html',
  './assets/style.css',
  './assets/data.js',
  './assets/store.js',
  './assets/app.js',
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
