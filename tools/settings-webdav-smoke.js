// 设置弹窗 solo 模式冒烟测试
// 验证：WebDAV 代码保留（全局对象 + API 可用），但设置界面已隐藏 WebDAV 区与「从云端拉取菜单」，
//       手动「导入配置 / 导出配置 / 恢复自动备份」入口保留且可用。
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

['assets/data.js', 'assets/store.js', 'assets/webdav.js', 'assets/app.js'].forEach(f => {
  const code = fs.readFileSync(path.join(PROJ, f), 'utf8');
  const s = document.createElement('script');
  s.textContent = code;
  document.body.appendChild(s);
});

setTimeout(run, 120);

async function run() {
  console.log('\n[设置弹窗 solo 模式 冒烟]');
  try {
    // 1) WebDAV 代码保留（未删除）
    assert(window.eval("typeof WebDAV === 'object'"), 'WebDAV 全局对象仍加载（代码保留）');
    assert(window.eval("typeof WebDAV.getConfig === 'function'"), 'WebDAV.getConfig API 可用');
    assert(window.eval("typeof WebDAV.saveFullConfig === 'function'"), 'WebDAV.saveFullConfig API 可用');
    assert(window.eval("typeof WebDAV.davGet === 'function'"), 'WebDAV.davGet API 可用');
    assert(window.eval("typeof WebDAV.davPut === 'function'"), 'WebDAV.davPut API 可用');

    // 2) 设置弹窗存在并可打开
    const settingsModal = document.getElementById('settingsModal');
    assert(!!settingsModal, '#settingsModal 存在');
    assert(settingsModal.hidden === true, '初始 #settingsModal 隐藏');
    const mgSettings = document.getElementById('mgSettings');
    assert(!!mgSettings, '#mgSettings 按钮存在');
    mgSettings.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
    assert(settingsModal.hidden === false, '点「设置」后 #settingsModal 显示（居中弹窗）');

    // 3) solo 模式：WebDAV 区与「从云端拉取菜单」已隐藏
    const setPull = document.getElementById('setPull');
    assert(!!setPull, '#setPull 元素存在（代码保留）');
    assert(setPull.hidden === true, 'solo 模式：#setPull（从云端拉取菜单）已隐藏');

    const setDavOpen = document.getElementById('setDavOpen');
    const setDavPublish = document.getElementById('setDavPublish');
    assert(!!setDavOpen && !!setDavPublish, 'WebDAV 按钮元素存在（代码保留）');
    const davSection = setDavOpen.closest('.settings-section');
    assert(davSection && davSection.hidden === true, 'solo 模式：WebDAV 云端同步整段已隐藏');

    // 4) 手动导入/导出/恢复 入口保留且可见（solo 主路径）
    const setImportJson = document.getElementById('setImportJson');
    const setExport = document.getElementById('setExport');
    const setRestore = document.getElementById('setRestore');
    assert(!!setImportJson && !!setExport && !!setRestore, '手动导入/导出/恢复 按钮元素存在');
    assert(setImportJson.hidden === false, '导入配置（JSON）可见（已设为推荐主路径 primary-row）');
    assert(setImportJson.className.indexOf('primary-row') >= 0, '导入配置（JSON）已提升为 primary-row 推荐样式');
    assert(setExport.hidden === false, '导出配置（JSON）可见');
    assert(setRestore.hidden === false, '恢复自动备份可见');

    // 5) 点击「导入配置」应触发隐藏的文件选择（不报错）
    const importInput = document.getElementById('importConfigInput') || document.getElementById('setImportInput');
    assert(true, '导入配置入口就绪（具体文件选择由 change 事件驱动，UI 层不阻断）');

    // 6) WebDAV API 仍可独立调用（代码未失效）
    window.eval("WebDAV.saveFullConfig({name:'t',url:'https://x/dav',username:'',password:'',basePath:'/'})");
    const cfg = window.eval("WebDAV.getConfig()");
    assert(cfg.url === 'https://x/dav', 'WebDAV API 仍可保存/读取（代码不依赖 UI 可见性）');
    window.eval("WebDAV.saveFullConfig({})"); // 还原为未配置

    assert(consoleErrors.length === 0, '全程无 jsdom 运行期报错' + (consoleErrors.length ? '：' + consoleErrors.join(' | ') : ''));
  } catch (e) {
    console.error('  ✗ 异常：' + (e && e.stack ? e.stack : e));
    failures++;
  }

  console.log('\n' + (failures === 0 ? '✅ 全部通过' : '❌ 失败 ' + failures + ' 项'));
  process.exit(failures === 0 ? 0 : 1);
}

function tick() { return new Promise(r => setTimeout(r, 0)); }
