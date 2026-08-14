// 用 Node 内置 WebSocket 驱动 Edge (CDP)，真实浏览器复现「点菜界面右键套餐 chip → 是否弹出 #pkgbarCtxMenu」
// 用法: node tools/edge-repro.js
const WebSocket = global.WebSocket;
const http = require('http');

const PORT = 9222;
const TARGET_URL = 'http://127.0.0.1:8123/index.html';

function getJSON(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(e.error || new Error('ws error'));
    ws.events = [];
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id && ws._pending && ws._pending.has(m.id)) {
        const p = ws._pending.get(m.id); ws._pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message || JSON.stringify(m.error))) : p.resolve(m.result);
      } else if (m.method) {
        ws.events.push(m);
      }
    };
  });
}

let _id = 0;
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++_id;
    if (!ws._pending) ws._pending = new Map();
    ws._pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function evaluate(ws, expr, opts = {}) {
  return send(ws, 'Runtime.evaluate', Object.assign({ expression: expr, returnByValue: true, awaitPromise: true }, opts))
    .then((r) => {
      if (r.exceptionDetails) return { __error: r.exceptionDetails.exception ? (r.exceptionDetails.exception.description || r.exceptionDetails.text) : r.exceptionDetails.text };
      return r.result ? r.result.value : undefined;
    });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  // 1) 找到 page target 的 websocket
  const list = await getJSON(`http://127.0.0.1:${PORT}/json`);
  const page = (list.find((t) => t.type === 'page') ) || list[0];
  if (!page || !page.webSocketDebuggerUrl) { console.error('未找到可调试的 page target'); process.exit(2); }
  console.log('连接 target:', page.url, page.webSocketDebuggerUrl);
  const ws = await connect(page.webSocketDebuggerUrl);

  // 2) 启用域 + 捕获控制台/异常
  const logs = [];
  const origPush = ws.events.push.bind(ws.events);
  ws.events.push = (m) => { if (m.method === 'Runtime.consoleAPICalled' || m.method === 'Runtime.exceptionThrown') logs.push(m); origPush(m); };
  await send(ws, 'Runtime.enable');
  await send(ws, 'Page.enable');

  // 3) 导航
  console.log('导航到', TARGET_URL);
  await send(ws, 'Page.navigate', { url: TARGET_URL });

  // 4) 等待 app 初始化（#pkgbar 出现 .chip）
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const st = await evaluate(ws, `(() => {
      try { return { rs: document.readyState, chip: !!document.querySelector('#pkgbar .chip') }; }
      catch (e) { return { err: String(e) }; }
    })()`);
    if (st && st.chip) { ready = true; console.log('app 已初始化:', JSON.stringify(st)); break; }
    if (i % 4 === 0) console.log('  等待初始化...', JSON.stringify(st));
  }
  if (!ready) { console.log('!! 未检测到 #pkgbar .chip（app 可能初始化失败）'); }

  // 5) 模拟右键 chip
  const result = await evaluate(ws, `(() => {
    const chip = document.querySelector('#pkgbar .chip');
    if (!chip) return { ok:false, reason:'no #pkgbar .chip' };
    chip.scrollIntoView();
    chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, cancelable:true, clientX:60, clientY:60 }));
    const m = document.getElementById('pkgbarCtxMenu');
    const style = m ? getComputedStyle(m) : null;
    return {
      ok:true,
      chipFound: true,
      menuExists: !!m,
      menuHiddenAfter: m ? m.hidden : null,
      menuDisplay: style ? style.display : null,
      menuLeft: m ? m.style.left : null,
      menuTop: m ? m.style.top : null,
      pkgbarCtxPkg: (window.__pkgbarCtxPkg !== undefined) ? window.__pkgbarCtxPkg : 'n/a'
    };
  })()`);
  console.log('右键结果:', JSON.stringify(result, null, 2));

  // 6) 再测「点击『定制菜单』→ 菜单应被关闭（证明 click handler 已执行）」
  const afterClick = await evaluate(ws, `(() => {
    const item = document.querySelector('#pkgbarCtxMenu .ctx-item[data-act="custom"]');
    if (!item) return { ok:false, reason:'no custom item' };
    item.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true }));
    const m = document.getElementById('pkgbarCtxMenu');
    return { ok:true, menuHiddenAfterClick: m ? m.hidden : null };
  })()`);
  console.log('点击『定制菜单』后:', JSON.stringify(afterClick));

  // 7) 控制台/异常
  console.log('--- 控制台/异常日志 (' + logs.length + ') ---');
  for (const l of logs) {
    if (l.method === 'Runtime.exceptionThrown') console.log('[EXCEPTION]', JSON.stringify(l.params.exceptionDetails.exception && l.params.exceptionDetails.exception.description || l.params.exceptionDetails.text));
    else console.log('[console.' + l.params.type + ']', l.params.args.map((a) => (a.value !== undefined ? a.value : a.description || a.type)).join(' '));
  }

  process.exit(0);
})().catch((e) => { console.error('脚本错误:', e); process.exit(1); });
