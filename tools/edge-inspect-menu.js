// 深度检查：在「点菜」视图用合成 contextmenu 打开 #pkgbarCtxMenu 后，核对它是否真的可见/在视口内/是否被祖先 transform 截掉。
// 同时核对：#pkgbar 是否真的含 .chip、右键 handler 是否挂上、菜单元素是否存在。Node 内置 WebSocket，无 npm。
const WebSocket = global.WebSocket;
const http = require('http');
const PORT = 9222;
const TARGET_URL = 'http://127.0.0.1:8123/index.html';

function getJSON(url) { return new Promise((res, rej) => { http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
function connect(wsUrl) { return new Promise((resolve, reject) => { const ws = new WebSocket(wsUrl); ws._pending = new Map(); ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.id && ws._pending.has(m.id)) { const p = ws._pending.get(m.id); ws._pending.delete(m.id); m.error ? p.reject(new Error(m.error.message || JSON.stringify(m.error))) : p.resolve(m.result); } }; ws.onopen = () => resolve(ws); ws.onerror = (e) => reject(e.error || new Error('ws')); }); }
let _id = 0;
function send(ws, method, params = {}) { return new Promise((resolve, reject) => { const id = ++_id; ws._pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
function evaluate(ws, expr) { return send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then((r) => { if (r.exceptionDetails) return { __err: r.exceptionDetails.text }; return r.result ? r.result.value : undefined; }); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  const list = await getJSON(`http://127.0.0.1:${PORT}/json`);
  const page = list.find((t) => t.type === 'page' && /about:blank/.test(t.url)) || list.find((t) => t.type === 'page') || list[0];
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, 'Runtime.enable');
  await send(ws, 'Page.enable');
  await send(ws, 'Page.navigate', { url: TARGET_URL });

  let ready = false;
  for (let i = 0; i < 40; i++) { await sleep(500); const st = await evaluate(ws, `(() => ({ rs: document.readyState, chip: !!document.querySelector('#pkgbar .chip'), pkgbar: !!document.getElementById('pkgbar'), menu: !!document.getElementById('pkgbarCtxMenu') }))()`); if (st && st.chip) { ready = true; console.log('app 已初始化', JSON.stringify(st)); break; } if (i % 4 === 0) console.log('  等待...', JSON.stringify(st)); }
  if (!ready) { console.log('!! 初始化失败'); process.exit(1); }

  // 打开右键菜单（合成 contextmenu，直接触发 handler）
  const opened = await evaluate(ws, `(() => {
    const chip = document.querySelector('#pkgbar .chip');
    chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }));
    const m = document.getElementById('pkgbarCtxMenu');
    const cs = getComputedStyle(m);
    const r = m.getBoundingClientRect();
    // 祖先 transform / filter / overflow 检查
    const bad = [];
    let p = m.parentElement;
    while (p && p !== document.documentElement) {
      const s = getComputedStyle(p);
      const hasT = (s.transform && s.transform !== 'none');
      const hasF = (s.filter && s.filter !== 'none');
      const hasO = (s.overflow && s.overflow !== 'visible');
      if (hasT || hasF || hasO) bad.push({ tag: p.tagName, id: p.id || '', cls: (p.className && p.className.toString().slice(0,30)) || '', transform: s.transform, filter: s.filter, overflow: s.overflow });
      p = p.parentElement;
    }
    return {
      menuHidden: m.hidden, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, zIndex: cs.zIndex,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      inViewport: (r.width>0 && r.height>0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight && r.x>=0 && r.y>=0),
      bodyOverflow: getComputedStyle(document.body).overflow,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      badAncestors: bad
    };
  })()`);
  console.log('右键菜单深度检查:', JSON.stringify(opened, null, 2));
  process.exit(0);
})().catch((e) => { console.error('脚本错误:', e); process.exit(1); });
