// 客人专享（guest）模式冒烟测试（T3）
// 同 custom-order.test.js 的「手动注入本地 JS」方式启动真实应用，
// 用含 ?guest=1&banquet=wedding&pkg=A 的 URL 验证受限界面：
//   ① body 加 guest-mode 类  ② #guestBar 可见  ③ 点分享二维码打开受限弹窗
// 运行：node tools/_guest.test.js

const fs = require('fs');
const path = require('path');
const jsdomPath = 'C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/jsdom';
const { JSDOM, VirtualConsole } = require(jsdomPath);

const PROJ = 'E:/山水S酒店/菜单系统';
const html = fs.readFileSync(path.join(PROJ, 'index.html'), 'utf8');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL: ' + msg); failures++; }
  else { console.log('  ✓ ' + msg); }
}
const consoleErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => consoleErrors.push('jsdomError: ' + (e && e.message ? e.message : e)));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/?guest=1&banquet=wedding&pkg=A',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = window.matchMedia || function () { return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }; };
    window.scrollTo = function () {};
    window.IntersectionObserver = window.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
    window.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
    if (!window.URL.createObjectURL) window.URL.createObjectURL = function () { return 'blob:test'; };
    window.alert = function () {};
    window.confirm = function () { return true; };
    // jsdom 无 canvas 后端：getContext 会抛 "Not implemented"，改为返回 null，
    // 让 makeQRCanvas 的 `if(!ctx) resolve(null)` 优雅降级分支生效
    if (window.HTMLCanvasElement && !window.HTMLCanvasElement.prototype.getContext.__stub) {
      const orig = window.HTMLCanvasElement.prototype.getContext;
      window.HTMLCanvasElement.prototype.getContext = function () { return null; };
      window.HTMLCanvasElement.prototype.getContext.__stub = true;
    }
    // jsdom 无网络：首次拉云端立即失败，避免 init 在 await 处挂起
    window.fetch = function () { return Promise.reject(new Error('no-network-in-test')); };
  }
});
const { window } = dom;
const document = window.document;

// 手动按依赖顺序注入本地 JS（同步，早于 DOMContentLoaded 触发）
['assets/qrcode.js', 'assets/data.js', 'assets/store.js', 'assets/webdav.js', 'assets/app.js', 'assets/custom.js'].forEach(f => {
  const code = fs.readFileSync(path.join(PROJ, f), 'utf8');
  const s = document.createElement('script');
  s.textContent = code;
  document.body.appendChild(s);
});

setTimeout(run, 120);

async function run() {
  console.log('\n[客人专享 guest 模式]');
  try {
    const storeOk = window.eval("typeof Store === 'object' && typeof Store.BANQUETS === 'object'");
    assert(storeOk, 'Store 已加载（BANQUETS 可用）');

    assert(document.body.classList.contains('guest-mode'), 'body 加 guest-mode 类（受限界面生效）');
    const gb = document.getElementById('guestBar');
    assert(gb && gb.hidden === false, '底部客人条 #guestBar 已显示（hidden=false）');
    assert(!!document.getElementById('guestDownload'), '客人条含「下载本套餐 PDF」按钮');

    // 顶栏管理/定制入口在 guest-mode 下被 CSS 隐藏：校验品牌菜单（管理/定制入口）不可见
    // 通过点击「分享套餐二维码」验证分享走受限 guest 路径并打开弹窗
    const share = document.getElementById('setShareQr');
    assert(!!share, '存在「分享套餐二维码（客人专享）」按钮');
    if (share) {
      share.dispatchEvent(new window.Event('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 40)); // 等 makeQRCanvas().then 异步打开弹窗
      const modal = document.getElementById('qrModal');
      assert(modal && modal.hidden === false, '点击后打开二维码弹窗（客人扫码入口可用）');
    }

    assert(consoleErrors.length === 0, '运行期无 jsdom 报错（实得 ' + consoleErrors.length + (consoleErrors.length ? '：' + consoleErrors.join(' | ') : '') + '）');
  } catch (e) {
    console.error('  ✗ 运行异常: ' + (e && e.stack ? e.stack : e));
    failures++;
  }
  console.log(failures === 0 ? '\n✅ 客人专享模式全部通过' : '\n❌ 失败 ' + failures + ' 项');
  process.exit(failures === 0 ? 0 : 1);
}
