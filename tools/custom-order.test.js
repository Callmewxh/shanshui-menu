// 定制单（宴席定制报价单）— 端到端冒烟测试（T3）
// 在 jsdom 中加载真实 data/store/app/custom 四件套，验证：
//  1) 进入定制单模式：从选中宴席/套餐克隆草案并渲染
//  2) 草案按 凉菜/主菜/主食点心 分组、菜品行非空
//  3) 抬头「客户姓氏·宴席类型」可编辑（默认取宴席名）
//  4) 导出弹窗可打开；buildSVG 生成带图版/无图版；doExport(svg) 产出 blob
// 运行：node tools/custom-order.test.js
// 依赖 jsdom（位于隔离的 node workspace）：NODE_PATH 指过去即可。

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
  }
});

const { window } = dom;
const document = window.document;

// jsdom 不自动加载外部 <script src>，手动按依赖顺序注入本地 JS
['assets/data.js', 'assets/store.js', 'assets/app.js', 'assets/custom.js'].forEach(f => {
  const code = fs.readFileSync(path.join(PROJ, f), 'utf8');
  const s = document.createElement('script');
  s.textContent = code;
  document.body.appendChild(s);
});

setTimeout(run, 80);

function run() {
  console.log('\n[定制单冒烟测试]');
  try {
    // Store 在 store.js 中是顶层 const，属词法全局（非 window 属性），用 eval 在页面作用域取
    const storeOk = (function () { try { return window.eval('typeof Store') === 'object' && window.eval('typeof Store.resolvePackage') === 'function'; } catch (e) { return false; } })();
    assert(storeOk, 'Store 全局可用（词法全局）');
    assert(window.CustomOrder && typeof window.CustomOrder.enter === 'function', 'CustomOrder.enter 已暴露');

    // 本地 data.js 种子无图（真图在 menu-config.json）。为验证缩略图嵌入分支，给菜品库补一张占位图
    window.eval("Store.LIBRARY.forEach(function(d){ if(!d.image) d.image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'; });");

    const customBtn = document.querySelector('.brand-item[data-mode="custom"]');
    assert(!!customBtn, '品牌菜单含「定制单」入口');

    // 进入定制单模式
    customBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    const cs = document.getElementById('customScreen');
    assert(cs && cs.hidden === false, '点击后定制单界面可见');

    const body = document.getElementById('csBody');
    const rows = body ? body.querySelectorAll('.cs-row').length : 0;
    assert(rows > 0, '草案渲染出菜品行（共 ' + rows + ' 行）');
    const groups = body ? body.querySelectorAll('.cs-group').length : 0;
    assert(groups >= 1 && groups <= 3, '草案按分类分组（' + groups + ' 组）');
    const cats = Array.from(body.querySelectorAll('.cs-group-title')).map(e => e.textContent.replace(/\s/g, ''));
    assert(cats.every(c => ['凉菜', '主菜', '主食点心'].indexOf(c) >= 0), '分组标题均为合法分类：' + cats.join('、'));

    const csType = document.getElementById('csType');
    assert(csType && csType.value === '婚宴', '抬头宴席类型默认取宴席名「婚宴」（实得「' + (csType && csType.value) + '」）');
    const csClient = document.getElementById('csClient');
    assert(csClient && csClient.value === '', '客户姓氏初始为空（可编辑）');

    // 导出弹窗
    document.getElementById('csExportBtn').dispatchEvent(new window.Event('click', { bubbles: true }));
    const expModal = document.getElementById('exportModal');
    assert(expModal && expModal.hidden === false, '点击「存为图片」打开导出弹窗');
    // 切到 SVG 格式
    const svgFmtBtn = document.querySelector('.exp-fmt[data-fmt="svg"]');
    if (svgFmtBtn) svgFmtBtn.dispatchEvent(new window.Event('click', { bubbles: true }));

    // buildSVG 两种版本
    const svgThumb = window.CustomOrder._buildSVG('thumb');
    assert(svgThumb.indexOf('<svg') === 0, 'buildSVG(thumb) 返回 SVG 根');
    assert(/婚宴/.test(svgThumb), 'thumb SVG 含宴席类型');
    assert(svgThumb.indexOf('<image') > -1, 'thumb SVG 嵌入菜品缩略图');
    assert(svgThumb.indexOf('</svg>') > -1, 'thumb SVG 闭合正确');
    const svgPlain = window.CustomOrder._buildSVG('plain');
    assert(/婚宴/.test(svgPlain), 'plain SVG 含宴席类型');
    assert(svgPlain.indexOf('<image') === -1, 'plain SVG 无图');
    assert(svgPlain.indexOf('</svg>') > -1, 'plain SVG 闭合正确');

    // doExport(svg) 产出 blob
    let captured = null;
    window.URL.createObjectURL = function (b) { captured = b; return 'blob:x'; };
    const origClick = window.HTMLAnchorElement.prototype.click;
    window.HTMLAnchorElement.prototype.click = function () {};
    window.CustomOrder._doExport();
    assert(captured != null, 'doExport 触发下载（produced blob）');
    window.HTMLAnchorElement.prototype.click = origClick;

    assert(consoleErrors.length === 0, '运行期无 jsdom 报错' + (consoleErrors.length ? '：' + consoleErrors.join(' | ') : ''));
  } catch (e) {
    console.error('  ✗ THREW: ' + (e && e.stack ? e.stack : e));
    failures++;
  }
  console.log('\n' + (failures === 0 ? '✅ 全部通过' : '❌ 失败 ' + failures + ' 项'));
  process.exit(failures === 0 ? 0 : 1);
}
