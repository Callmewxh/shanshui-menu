// Cloudflare Worker · 山水S酒店菜单 WebDAV 代理（经典 Service Worker 格式）
// 作用：把 /dav/* 转发到你的 WebDAV（坚果云 / InfiniCLOUD），服务端持密钥，
//       并补 CORS 头 + 处理 OPTIONS 预检，让浏览器端 PWA 能跨域读写。
//
// 配置（Worker 后台 → Settings → Variables，建议全部设为 secret/加密）：
//   WEBDAV_BASE  : 你的 WebDAV 根地址，如 https://dav.jianguoyun.com/dav
//   WEBDAV_USER  : WebDAV 登录名（坚果云为邮箱；InfiniCLOUD 为 Connection ID）
//   WEBDAV_PASS  : WebDAV 密码 / Apps Password
//   DAV_TOKEN    : （可选）PWA 端也必须填的一致令牌，防止代理被滥用
//   ALLOW_ORIGIN : （可选）允许的 PWA 源，如 https://xxx.app.workbuddy.link ，默认 *
//
// 部署后，PWA 设置里「代理地址」填：https://你的worker子域.workers.dev/dav

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // 只处理 /dav/* 路径
  if (!url.pathname.startsWith('/dav/')) {
    return new Response('Not found', { status: 404 });
  }
  // 仅开放 GET（拉取）/ PUT（发布）/ OPTIONS（预检）
  if (!['GET', 'PUT', 'OPTIONS'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405 });
  }
  // CORS 预检：必须返回 204 + CORS 头，否则带鉴权的 WebDAV 请求会被浏览器拦截
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  // 可选令牌校验：只有知道 DAV_TOKEN 的 PWA 才能用
  if (typeof DAV_TOKEN !== 'undefined' && DAV_TOKEN && request.headers.get('x-dav-token') !== DAV_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 映射 /dav/<file> -> <WEBDAV_BASE>/<file>
  const base = typeof WEBDAV_BASE !== 'undefined' ? WEBDAV_BASE : '';
  const user = typeof WEBDAV_USER !== 'undefined' ? WEBDAV_USER : '';
  const pass = typeof WEBDAV_PASS !== 'undefined' ? WEBDAV_PASS : '';
  const target = base.replace(/\/+$/, '') + '/' + url.pathname.slice('/dav/'.length);
  if (!target) return new Response('Bad gateway', { status: 502 });

  const upstream = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: 'Basic ' + btoa(user + ':' + pass),
      'Content-Type': 'application/json',
    },
    body: request.method === 'PUT' ? request.body : undefined,
    redirect: 'follow',
  });

  // 透传响应体，并补 CORS 头（上游 WebDAV 默认不返回）
  const resp = new Response(upstream.body, upstream);
  const h = corsHeaders();
  for (const k in h) resp.headers.set(k, h[k]);
  return resp;
}

function corsHeaders() {
  const origin = (typeof ALLOW_ORIGIN !== 'undefined' && ALLOW_ORIGIN) ? ALLOW_ORIGIN : '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-dav-token',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
  };
}
