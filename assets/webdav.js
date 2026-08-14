// 山水S酒店 · WebDAV 同步客户端
// 通过「同源/可控代理」（如 Cloudflare Worker）读写 WebDAV，规避浏览器直连 CORS 拦截。
// 本文件只持「代理地址」与「访问令牌」；WebDAV 账号密码存于代理服务端，不进浏览器。
// 模型：设备只 GET（拉取），管理端主动 PUT（发布）——单写者，无并发覆盖风险。
const WebDAV = (function () {
  'use strict';

  const LS_URL = 'ss_dav_url';
  const LS_TOKEN = 'ss_dav_token';
  const LS_NAME = 'ss_dav_name';
  const LS_BASE_PATH = 'ss_dav_base_path';
  const LS_USERNAME = 'ss_dav_username';
  const LS_PASSWORD = 'ss_dav_password';
  const DEFAULT_FILE = 'menu-config.json';

  function getConfig() {
    return {
      name: (localStorage.getItem(LS_NAME) || '').trim(),
      url: (localStorage.getItem(LS_URL) || '').trim(),
      basePath: (localStorage.getItem(LS_BASE_PATH) || '').trim(),
      username: (localStorage.getItem(LS_USERNAME) || '').trim(),
      password: (localStorage.getItem(LS_PASSWORD) || '').trim(),
      token: (localStorage.getItem(LS_TOKEN) || '').trim(),
    };
  }

  function getUrl() { return getConfig().url; }
  function getToken() { return getConfig().token; }
  function getPassword() { return getConfig().password; }

  // 兼容旧 API：只保存 url/token
  function saveConfig(url, token) {
    try {
      localStorage.setItem(LS_URL, (url || '').trim());
      localStorage.setItem(LS_TOKEN, (token || '').trim());
    } catch (_) {}
  }

  // 完整保存 WebDAV 配置表单
  function saveFullConfig(cfg) {
    try {
      localStorage.setItem(LS_NAME, (cfg.name || '').trim());
      localStorage.setItem(LS_URL, (cfg.url || '').trim());
      localStorage.setItem(LS_BASE_PATH, (cfg.basePath || '').trim());
      localStorage.setItem(LS_USERNAME, (cfg.username || '').trim());
      localStorage.setItem(LS_PASSWORD, (cfg.password || '').trim());
      localStorage.setItem(LS_TOKEN, (cfg.token || '').trim());
    } catch (_) {}
  }

  function isConfigured() { return !!getConfig().url; }

  function effectiveToken() {
    const cfg = getConfig();
    return cfg.token || cfg.password;
  }

  // 把 /dav 基址 + 可选根路径 + 文件名拼成完整 URL
  function buildUrl(file) {
    const cfg = getConfig();
    const base = cfg.url.replace(/\/+$/, '');
    const path = (cfg.basePath || '').replace(/^\/+/, '').replace(/\/+$/, '');
    const f = file || DEFAULT_FILE;
    return base + (path ? '/' + path : '') + '/' + f;
  }

  async function davGet(file, opts) {
    opts = opts || {};
    const url = buildUrl(file) + (opts.cacheBust ? ('?t=' + Date.now()) : '');
    const headers = { Accept: 'application/json' };
    const tok = effectiveToken();
    if (tok) headers['x-dav-token'] = tok;
    const res = await fetch(url, { method: 'GET', headers, cache: 'no-cache' });
    if (!res.ok) throw new Error('WebDAV GET ' + res.status);
    return await res.json();
  }

  async function davPut(file, obj) {
    const url = buildUrl(file);
    const headers = { 'Content-Type': 'application/json' };
    const tok = effectiveToken();
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

  async function testConnection(file) {
    try {
      await davGet(file || DEFAULT_FILE, { cacheBust: true });
      return { ok: true, msg: '连接成功' };
    } catch (e) {
      return { ok: false, msg: e.message || '连接失败' };
    }
  }

  return {
    isConfigured,
    getUrl,
    getToken,
    getPassword,
    getConfig,
    saveConfig,
    saveFullConfig,
    davGet,
    davPut,
    testConnection,
    DEFAULT_FILE,
  };
})();
