// 临时回归测试（T3）：品牌 LOGO 随 menu-config.json 一起搬运
// 验证两条真实路径：
//   A) 设备首次打开 → 自动从云端拉取「带 logo 的配置」→ localStorage 写入 logo 且界面徽标(.mark)显示 logo
//   B) 导入的配置不含 logo 时，不会误清空设备已有 logo（安全性）
// 运行：node tools/__logo_config_test.js
// 依赖隔离 node workspace 的 jsdom。

const fs = require('fs');
const path = require('path');
let jsdom;
try { jsdom = require('jsdom'); } catch (_) { jsdom = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/jsdom'); }
const { JSDOM, VirtualConsole } = jsdom;

const PROJ = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(PROJ, 'index.html'), 'utf8');

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const CFG_WITH_LOGO = {
  library: [{ id: 'lib001', num: '01', cn: '测试菜', en: 'Test', cat: '主菜', icon: 'platter', desc: '', image: null, crop: null }],
  menu: { wedding: { name: '婚宴', packages: [{ id: 'A1', name: 'A1', price: 0, demo: false, dishes: ['lib001'], nameOverrides: {} }] } },
  logo: LOGO,
  logoCrop: { x: 0.1, y: 0.2, w: 0.6, h: 0.6 },
};

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL: ' + msg); failures++; }
  else { console.log('  ✓ ' + msg); }
}

const vc = new VirtualConsole();
const consoleErrors = [];
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
    // 拦截 fetch：对 menu-config 请求返回「带 logo 的配置」
    window.fetch = function (url) {
      if (typeof url === 'string' && url.indexOf('menu-config') >= 0) {
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(JSON.stringify(CFG_WITH_LOGO))); } });
      }
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
    };
  }
});

const { window } = dom;
const document = window.document;

['assets/qrcode.js', 'assets/data.js', 'assets/store.js', 'assets/app.js', 'assets/custom.js'].forEach(f => {
  const code = fs.readFileSync(path.join(PROJ, f), 'utf8');
  const s = document.createElement('script');
  s.textContent = code;
  document.body.appendChild(s);
});

// 触发 boot（jsdom 手动注入脚本后 DOMContentLoaded 不一定自然派发）
setTimeout(() => {
  try { document.dispatchEvent(new window.Event('DOMContentLoaded')); } catch (_) {}
}, 60);

setTimeout(run, 800);

function run() {
  console.log('\n[品牌 LOGO 随配置一起拉取 — 回归测试]');
  try {
    // —— 路径 A：自动云端拉取带 logo 配置 ——
    const storedLogo = window.localStorage.getItem('ss_brand_logo');
    assert(storedLogo === LOGO, '拉取后 localStorage.ss_brand_logo 已写入云端配置里的 logo');

    const storedCrop = window.localStorage.getItem('ss_brand_logo_crop');
    assert(!!storedCrop && JSON.parse(storedCrop).w === 0.6, '拉取后 ss_brand_logo_crop 已写入裁剪参数');

    const m = document.querySelector('.mark');
    assert(!!m, '界面存在品牌徽标节点 .mark');
    if (m) {
      assert(m.classList.contains('has-logo'), '徽标 .mark 应用了 has-logo 类（使用了 logo 图片）');
      assert((m.style.backgroundImage || '').indexOf('data:image') >= 0, '徽标 .mark 的 background-image 已设为 logo 图（非默认红底「S」）');
    }

    // —— 路径 B：导入无 logo 配置，不应误清已有 logo ——
    const before = window.localStorage.getItem('ss_brand_logo');
    window.eval('Store.importConfig({ library:[{id:"lib002",num:"02",cn:"乙",en:"",cat:"主菜",icon:"platter",desc:"",image:null,crop:null}], menu:{ wedding:{ name:"婚宴", packages:[{id:"B",name:"B",price:0,demo:false,dishes:["lib002"],nameOverrides:{}}] } } }).then(function(r){ window.__b_ok = r.ok; });');
    setTimeout(() => {
      const after = window.localStorage.getItem('ss_brand_logo');
      assert(window.__b_ok === true, '导入（无 logo）配置返回 ok');
      assert(after === before && !!after, '导入无 logo 配置后，设备已有 logo 未被误清空');

      const realErrors = consoleErrors.filter(m => !/Not implemented:\s*HTMLCanvasElement/.test(m) && !/without installing the canvas npm package/.test(m));
      assert(realErrors.length === 0, '运行期无 jsdom 报错' + (realErrors.length ? '：' + realErrors.join(' | ') : ''));

      console.log('\n' + (failures === 0 ? '✅ 全部通过' : '❌ 失败 ' + failures + ' 项'));
      process.exit(failures === 0 ? 0 : 1);
    }, 120);
  } catch (e) {
    console.error('  ✗ THREW: ' + (e && e.stack ? e.stack : e));
    failures++;
    console.log('\n❌ 失败 ' + failures + ' 项');
    process.exit(1);
  }
}
