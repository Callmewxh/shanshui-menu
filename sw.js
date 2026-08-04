// 山水S酒店 · 菜单系统 Service Worker（离线缓存 + 安装为 App）
const CACHE = 'ss-menu-v5-9';
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
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
