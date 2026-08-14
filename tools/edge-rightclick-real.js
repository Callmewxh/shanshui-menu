// 用 CDP「真实鼠标手势」复现点菜界面右键套餐：移动鼠标→右键按下→松开（让浏览器自己产生 contextmenu），
// 再深度检查 #pkgbarCtxMenu 是否真的可见、有没有被祖先 transform 截掉。Node 内置 WebSocket，无 npm。
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
  console.log('连接 target:', page.url, page.webSocketDebuggerUrl);
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, 'Runtime.enable');
  await send(ws, 'Page.enable');
  await send(ws, 'Input.enable');

  console.log('导航到', TARGET_URL);
  await send(ws, 'Page.navigate', { url: TARGET_URL });

  let ready = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const st = await evaluate(ws, `(() => { try { return { rs: document.readyState, chip: !!document.querySelector('#pkgbar .chip') }; } catch (e) { return { err: String(e) }; } })()`);
    if (st && st.chip) { ready = true; console.log('app 已初始化'); break; }
    if (i % 4 === 0) console.log('  等待初始化...', JSON.stringify(st));
  }
  if (!ready) { console.log('!! 未检测到 #pkgbar .chip'); process.exit(1); }

  // 取 chip 中心坐标（视口坐标，与 CDP 鼠标坐标一致）
  const rect = await evaluate(ws, `(() => {
    const c = document.querySelector('#pkgbar .chip');
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: Math.round(r.x + r.width/2), cy: Math.round(r.y + r.height/2) };
  })()`);
  console.log('chip 矩形:', JSON.stringify(rect));

  // 真实右键手势
  await send(ws, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.cx, y: rect.cy });
  await sleep(50);
  await send(ws, 'Input.dispatchMouseEvent', { type: 'mousePressed', button: 'right', x: rect.cx, y: rect.cy, clickCount: 1 });
  await send(ws, 'Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'right', x: rect.cx, y: rect.cy, clickCount: 1 });
  await sleep(400);

  // 深度检查菜单可见性 + 祖先 transform（会让 position:fixed 相对祖先定位/被裁剪）
  const inspect = await evaluate(ws, `(() => {
    const m = document.getElementById('pkgbarCtxMenu');
    if (!m) return { exists: false };
    const cs = getComputedStyle(m);
    const r = m.getBoundingClientRect();
    const ancestors = [];
    let p = m.parentElement;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      if (s.transform && s.transform !== 'none' || s.filter && s.filter !== 'none' || s.perspective && s.perspective !== 'none' || s.willChange && s.willChange !== 'auto') {
        ancestors.push({ tag: p.tagName, id: p.id, cls: p.className && p.className.toString().slice(0,40), transform: s.transform, filter: s.filter, willChange: s.willChange, overflow: s.overflow });
      }
      p = p.parentElement;
    }
    return {
      exists: true,
      hidden: m.hidden,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      zIndex: cs.zIndex,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      inViewport: (r.width>0 && r.height>0 && r.x>=0 && r.y>=0 && r.x < window.innerWidth && r.y < window.innerHeight),
      transformAncestors: ancestors
    };
  })()`);
  console.log('右键后菜单深度检查:', JSON.stringify(inspect, null, 2));

  process.exit(0);
})().catch((e) => { console.error('脚本错误:', e); process.exit(1); });
