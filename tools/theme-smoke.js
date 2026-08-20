// 默认皮肤（shanshui）冒烟：验证移除四套可选皮肤后，骨架/DOM/JS 正常、默认皮肤生效
// 复用 custom-order.test.js 的 jsdom 注入机制（runScripts:dangerously + 手动注入本地 JS）
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
  url: 'http://localhost/',
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
  }
});
const { window } = dom;
const document = window.document;

['assets/data.js', 'assets/store.js', 'assets/app.js'].forEach(f => {
  const code = fs.readFileSync(path.join(PROJ, f), 'utf8');
  const s = document.createElement('script');
  s.textContent = code;
  document.body.appendChild(s);
});

setTimeout(run, 80);

async function run() {
  console.log('\n[默认皮肤（shanshui）冒烟]');
  try {
    const storeOk = window.eval("typeof Store === 'object' && typeof Store.getTheme === 'function'");
    assert(storeOk, 'Store.getTheme/setTheme 已暴露');

    // 四套可选皮肤已移除：皮肤切换器不再存在，仅默认 shanshui 生效
    const themeOptsEl = document.getElementById('themeOpts');
    assert(!themeOptsEl, '皮肤切换器已移除（#themeOpts 不存在）');
    assert(document.documentElement.getAttribute('data-theme') === 'shanshui', '默认 data-theme=shanshui 已应用');

    // 骨架关键节点应存在（证明 DOM/JS 正常）
    const skeletonIds = ['pkgbar', 'list', 'settingsModal', 'modal', 'customScreen', 'brandMenu'];
    skeletonIds.forEach(id => assert(!!document.getElementById(id), '骨架节点 #' + id + ' 存在'));

    // 注意：custom（定制单）已不再作为品牌菜单并列入口（8 点反馈 #1 移除），
    // 改由点菜界面右键套餐 → 呼出「定制菜单」进入，故这里只验证 order / manage 两个品牌入口。
    const modes = ['order', 'manage'];

    for (const mode of modes) {
      const before = consoleErrors.length;
      const item = document.querySelector('.brand-item[data-mode="' + mode + '"]');
      assert(!!item, '品牌菜单含「' + mode + '」模式入口');
      if (item) item.dispatchEvent(new window.Event('click', { bubbles: true }));
      await tick();
      skeletonIds.forEach(id => assert(!!document.getElementById(id), '[' + mode + '] 骨架 #' + id + ' 仍在'));
      assert(consoleErrors.length === before, '[' + mode + '] 无新增运行期报错' + (consoleErrors.length > before ? '：' + consoleErrors.slice(before).join(' | ') : ''));
    }

    assert(consoleErrors.length === 0, '全程无 jsdom 运行期报错' + (consoleErrors.length ? '：' + consoleErrors.join(' | ') : ''));
  } catch (e) {
    console.error('  ✗ 异常：' + (e && e.stack ? e.stack : e));
    failures++;
  }

  console.log('\n' + (failures === 0 ? '✅ 全部通过' : '❌ 失败 ' + failures + ' 项'));
  process.exit(failures === 0 ? 0 : 1);
}

function tick() { return new Promise(r => setTimeout(r, 0)); }
