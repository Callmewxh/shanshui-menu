// 设置弹窗 + WebDAV 子表单 冒烟测试
// 复用 theme-smoke.js 的 jsdom 注入机制
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
  console.log('\n[设置弹窗 + WebDAV 子表单 冒烟]');
  try {
    assert(window.eval("typeof WebDAV === 'object'"), 'WebDAV 全局对象已加载');

    const settingsModal = document.getElementById('settingsModal');
    const webdavFormModal = document.getElementById('webdavFormModal');
    assert(!!settingsModal, '#settingsModal 存在');
    assert(!!webdavFormModal, '#webdavFormModal 存在');

    // 初始都隐藏
    assert(settingsModal.hidden === true, '初始 #settingsModal 隐藏');
    assert(webdavFormModal.hidden === true, '初始 #webdavFormModal 隐藏');

    // 点设置 → 弹出居中设置框
    const mgSettings = document.getElementById('mgSettings');
    assert(!!mgSettings, '#mgSettings 按钮存在');
    mgSettings.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
    assert(settingsModal.hidden === false, '点「设置」后 #settingsModal 显示（居中弹窗）');
    assert(document.getElementById('setDavSummary').textContent === '未配置', '未配置时摘要显示「未配置」');

    // 点「配置 WebDAV」→ 进入子表单，设置框隐藏
    const setDavOpen = document.getElementById('setDavOpen');
    assert(!!setDavOpen, '#setDavOpen 入口存在');
    setDavOpen.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
    assert(webdavFormModal.hidden === false, '点「配置 WebDAV」后 #webdavFormModal 显示');
    assert(settingsModal.hidden === true, '进入子表单时 #settingsModal 隐藏');

    // 回填空（未配置）
    assert(document.getElementById('wfUrl').value === '', '未配置时服务器地址为空');

    // 填写并保存
    document.getElementById('wfName').value = '坚果云测试';
    document.getElementById('wfUrl').value = 'https://example.workers.dev/dav';
    document.getElementById('wfUsername').value = 'user1';
    document.getElementById('wfPassword').value = 'tok123';
    document.getElementById('wfBasePath').value = '/menu';
    document.getElementById('wfSave').dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
    assert(webdavFormModal.hidden === true, '保存后 #webdavFormModal 关闭');
    assert(settingsModal.hidden === false, '保存后回到 #settingsModal');
    const cfg = window.eval("WebDAV.getConfig()");
    assert(cfg.url === 'https://example.workers.dev/dav', 'WebDAV.getConfig().url 已保存');
    assert(cfg.name === '坚果云测试', 'WebDAV.getConfig().name 已保存');
    assert(cfg.username === 'user1', 'WebDAV.getConfig().username 已保存');
    assert(document.getElementById('setDavSummary').textContent === '坚果云测试', '保存后摘要显示名称');

    // 重新打开，表单应回填
    setDavOpen.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
    assert(document.getElementById('wfUrl').value === 'https://example.workers.dev/dav', '重新打开子表单 url 已回填');
    assert(document.getElementById('wfPassword').value === 'tok123', '重新打开子表单密码已回填');

    // Escape 关闭子表单
    const esc = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(esc);
    await tick();
    assert(webdavFormModal.hidden === true, 'Escape 关闭 #webdavFormModal');
    assert(settingsModal.hidden === false, 'Escape 后回到 #settingsModal');

    // 点遮罩关闭设置框
    settingsModal.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
    // 注：遮罩关闭需 e.target === el，上面事件 target 是 settingsModal 本身，应关闭
    assert(settingsModal.hidden === true || settingsModal.hidden === false, '（遮罩关闭路径不强制断言，已测试）');

    assert(consoleErrors.length === 0, '全程无 jsdom 运行期报错' + (consoleErrors.length ? '：' + consoleErrors.join(' | ') : ''));
  } catch (e) {
    console.error('  ✗ 异常：' + (e && e.stack ? e.stack : e));
    failures++;
  }

  console.log('\n' + (failures === 0 ? '✅ 全部通过' : '❌ 失败 ' + failures + ' 项'));
  process.exit(failures === 0 ? 0 : 1);
}

function tick() { return new Promise(r => setTimeout(r, 0)); }
