// 四皮肤 × 三屏 冒烟：验证「切换皮肤只改 data-theme 属性、骨架/DOM/JS 不变」
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
  console.log('\n[四皮肤 × 三屏 冒烟]');
  try {
    const storeOk = window.eval("typeof Store === 'object' && typeof Store.getTheme === 'function'");
    assert(storeOk, 'Store.getTheme/setTheme 已暴露');

    const opts = document.querySelectorAll('#themeOpts .theme-opt');
    assert(opts.length === 4, '设置内「皮肤主题」含 4 个选项（实际 ' + opts.length + '）');
    const themeVals = Array.from(opts).map(b => b.getAttribute('data-theme')).sort().join(',');
    assert(themeVals === 'apple,glass,shanshui,wabi', '四皮肤值齐全：' + themeVals);

    // 骨架关键节点在换肤前后都应存在（证明只改属性、不动 DOM）
    const skeletonIds = ['pkgbar', 'list', 'settingsModal', 'modal', 'customScreen', 'brandMenu', 'themeOpts'];
    skeletonIds.forEach(id => assert(!!document.getElementById(id), '骨架节点 #' + id + ' 存在'));

    const modes = ['order', 'manage', 'custom'];
    const themes = ['shanshui', 'apple', 'glass', 'wabi'];

    for (const mode of modes) {
      const item = document.querySelector('.brand-item[data-mode="' + mode + '"]');
      assert(!!item, '品牌菜单含「' + mode + '」模式入口');
      if (item) item.dispatchEvent(new window.Event('click', { bubbles: true }));
      await tick();

      for (const t of themes) {
        const before = consoleErrors.length;
        const btn = document.querySelector('#themeOpts .theme-opt[data-theme="' + t + '"]');
        btn.dispatchEvent(new window.Event('click', { bubbles: true }));
        await tick(); // 等 Store.setTheme().then(applyTheme) 的微任务
        assert(document.documentElement.getAttribute('data-theme') === t, '[' + mode + '] 切到 ' + t + ' → <html data-theme> 正确');
        assert(btn.classList.contains('on'), '[' + mode + '] ' + t + ' 选项高亮 .on');
        // 骨架节点在该皮肤下仍全部存在
        skeletonIds.forEach(id => assert(!!document.getElementById(id), '[' + mode + '/' + t + '] 骨架 #' + id + ' 仍在'));
        assert(consoleErrors.length === before, '[' + mode + '/' + t + '] 无新增运行期报错' + (consoleErrors.length > before ? '：' + consoleErrors.slice(before).join(' | ') : ''));
      }
    }

    // 持久化：刷新语义——Store.getTheme 应返回最后一次选择的主题
    assert(window.eval("Store.getTheme()") === 'wabi', 'Store.getTheme 返回上次选择（wabi，已持久化）');

    assert(consoleErrors.length === 0, '全程无 jsdom 运行期报错' + (consoleErrors.length ? '：' + consoleErrors.join(' | ') : ''));
  } catch (e) {
    console.error('  ✗ 异常：' + (e && e.stack ? e.stack : e));
    failures++;
  }

  console.log('\n' + (failures === 0 ? '✅ 全部通过' : '❌ 失败 ' + failures + ' 项'));
  process.exit(failures === 0 ? 0 : 1);
}

function tick() { return new Promise(r => setTimeout(r, 0)); }
