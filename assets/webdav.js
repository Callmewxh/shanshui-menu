// 山水S酒店 · WebDAV 同步客户端
// 通过「同源/可控代理」（如 Cloudflare Worker）读写 WebDAV，规避浏览器直连 CORS 拦截。
// 本文件只持「代理地址」与「访问令牌」；WebDAV 账号密码存于代理服务端，不进浏览器。
// 模型：设备只 GET（拉取），管理端主动 PUT（发布）——单写者，无并发覆盖风险。
const WebDAV = (function () {
  'use strict';

  const LS_URL = 'ss_dav_url';
  const LS_TOKEN = 'ss_dav_token';
  const DEFAULT_FILE = 'menu-config.json';

  function getUrl() { return (localStorage.getItem(LS_URL) || '').trim(); }
  function getToken() { return (localStorage.getItem(LS_TOKEN) || '').trim(); }

  // 是否已在设置里填了代理地址
  function isConfigured() { return !!getUrl(); }

  // 保存代理地址与令牌到本机（仅本机，不上传）
  function saveConfig(url, token) {
    try {
      localStorage.setItem(LS_URL, (url || '').trim());
      localStorage.setItem(LS_TOKEN, (token || '').trim());
    } catch (_) {}
  }

  // 把 /dav 基址 + 文件名拼成完整 URL
  function buildUrl(file) {
    const base = getUrl().replace(/\/+$/, '');
    return base + '/' + (file || DEFAULT_FILE);
  }

  async function davGet(file, opts) {
    opts = opts || {};
    const url = buildUrl(file) + (opts.cacheBust ? ('?t=' + Date.now()) : '');
    const headers = { Accept: 'application/json' };
    const tok = getToken();
    if (tok) headers['x-dav-token'] = tok;
    const res = await fetch(url, { method: 'GET', headers, cache: 'no-cache' });
    if (!res.ok) throw new Error('WebDAV GET ' + res.status);
    return await res.json();
  }

  async function davPut(file, obj) {
    const url = buildUrl(file);
    const headers = { 'Content-Type': 'application/json' };
    const tok = getToken();
    if (tok) headers['x-dav-token'] = tok;
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(obj),
      cache: 'no-cache',
    });
    if (!res.ok) throw new Error('WebDAV PUT ' + res.status);
    return true;
  }

  return {
    isConfigured,
    getUrl,
    getToken,
    saveConfig,
    davGet,
    davPut,
    DEFAULT_FILE,
  };
})();
