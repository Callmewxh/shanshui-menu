// 整份菜单离线导出 — 端到端冒烟测试（T3）
// 验证多页 PDF、单套餐 SVG 与导出入口，并防止线上分享能力回流。
// 运行：node tools/menu-export.test.js
// 依赖 jsdom（位于隔离的 node workspace）：NODE_PATH 指过去即可。

const fs = require('fs');
const path = require('path');
let jsdom;
try { jsdom = require('jsdom'); } catch (_) { jsdom = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/jsdom'); }
const { JSDOM, VirtualConsole } = jsdom;

const PROJ = path.resolve(__dirname, '..');
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

// jsdom 不自动加载外部 <script src>，手动按依赖顺序注入本地 JS
['assets/data.js', 'assets/store.js', 'assets/app.js', 'assets/custom.js'].forEach(f => {
  const code = fs.readFileSync(path.join(PROJ, f), 'utf8');
  const s = document.createElement('script');
  s.textContent = code;
  document.body.appendChild(s);
});

setTimeout(run, 120);

function run() {
  console.log('\n[整份菜单离线导出测试]');
  try {
    assert(window.CustomOrder && typeof window.CustomOrder.exportWholeMenu === 'function', 'CustomOrder.exportWholeMenu 已暴露');
    assert(typeof window.CustomOrder.buildMultiPagePdf === 'function', 'CustomOrder.buildMultiPagePdf 已暴露');
    assert(typeof window.CustomOrder.buildPackageSVG === 'function', 'CustomOrder.buildPackageSVG 已暴露');
    assert(typeof window.CustomOrder.shareUrl === 'undefined', '线上分享 shareUrl 未暴露');
    assert(typeof window.CustomOrder.makeQRCanvas === 'undefined', '二维码生成入口未暴露');

    // 中文宴席名与文件名规则：不得泄漏 baby / housewarming 等技术 ID。
    assert(window.CustomOrder._getBanquetDisplayName('baby') === '宝宝宴', 'baby 映射为「宝宝宴」');
    assert(window.CustomOrder._getBanquetDisplayName('housewarming') === '乔迁宴', 'housewarming 映射为「乔迁宴」');
    assert(window.CustomOrder._getMenuExportBaseName('wedding', null) === '婚宴菜单', '婚宴整份导出名为「婚宴菜单」');
    const namingPkg = window.eval("Store.getPackage('wedding', 'A')");
    const originalNamingPkgName = namingPkg && namingPkg.name;
    if (namingPkg) namingPkg.name = '百年好合';
    assert(window.CustomOrder._getMenuExportBaseName('wedding', 'A') === '婚宴菜单-百年好合', '婚宴单份导出名为「婚宴菜单-百年好合」');
    assert(window.CustomOrder._getMenuExportBaseName('wedding', 'A', '刘府') === '刘府婚宴-百年好合', '填写客户后导出名为「刘府婚宴-百年好合」');
    if (namingPkg) namingPkg.name = originalNamingPkgName;
    assert(window.CustomOrder._getMenuExportBaseName('housewarming', null) === '乔迁宴菜单', '乔迁宴整份导出名为「乔迁宴菜单」');
    assert(window.CustomOrder._getMenuExportBaseName('housewarming', 'A') === '乔迁宴菜单-A菜单', '乔迁宴单份导出名为「乔迁宴菜单-A菜单」');

    // 3) 多页 PDF 生成器
    const fakeJpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0xFF, 0xD9]);
    const pages = [
      { bytes: fakeJpeg, w: 100, h: 80 },
      { bytes: fakeJpeg, w: 100, h: 80 },
      { bytes: fakeJpeg, w: 100, h: 80 }
    ];
    const pdf = window.CustomOrder.buildMultiPagePdf(pages);
    const head = String.fromCharCode.apply(null, pdf.slice(0, 8));
    const tail = String.fromCharCode.apply(null, pdf.slice(pdf.length - 6));
    const pdfStr = String.fromCharCode.apply(null, pdf);
    assert(head.indexOf('%PDF-1.') === 0, '多页 PDF 产出合法 PDF 头');
    assert(tail.indexOf('%%EOF') >= 0, '多页 PDF 产出合法 PDF 尾');
    assert(/xref/.test(pdfStr) && /startxref/.test(pdfStr) && /trailer/.test(pdfStr), '多页 PDF 含 xref/startxref/trailer');
    assert(/Type \/Pages/.test(pdfStr), '多页 PDF 含 /Type /Pages 节点');
    assert(/Count 3/.test(pdfStr), '多页 PDF /Count 为 3（与传入页数一致）');
    const kidsMatch = pdfStr.match(/\/Kids\s*\[([^\]]*)\]/);
    // 注意：每个页面引用形如「3 0 R」，是 3 个空白分隔 token，必须按「引用」而非 token 计数
    const kidsRefs = kidsMatch ? (kidsMatch[1].match(/\d+\s+0\s+R/g) || []) : [];
    assert(kidsRefs.length === 3, '多页 PDF /Kids 含 3 个页面引用（实得 ' + kidsRefs.length + '：' + kidsRefs.join(', ') + '）');
    const pageObjCount = (pdfStr.match(/\/Type \/Page /g) || []).length; // 注意尾部空格，避免匹配 /Pages
    assert(pageObjCount === 3, '多页 PDF 含 3 个 /Type /Page 对象（实得 ' + pageObjCount + '）');
    const imageXObjCount = (pdfStr.match(/\/Subtype \/Image/g) || []).length;
    assert(imageXObjCount === 3, '多页 PDF 含 3 个 /Subtype /Image XObject（每页一张，实得 ' + imageXObjCount + '）');
    assert(/MediaBox/.test(pdfStr), '多页 PDF 含 MediaBox');

    // 4) 单套餐 SVG（给菜品库补占位图，验证缩略图分支）
    window.eval("Store.LIBRARY.forEach(function(d){ if(!d.image) d.image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'; });");
    // 取婚宴第一个套餐
    const pkgId = window.eval("(function(){ var b = Store.getBanquet('wedding'); return b && b.packages[0] ? b.packages[0].id : null; })()");
    assert(!!pkgId, '取到婚宴第一个套餐 id：' + pkgId);
    const svg = window.CustomOrder.buildPackageSVG('wedding', pkgId, 1);
    assert(svg.indexOf('<svg') === 0, 'buildPackageSVG 返回 SVG 根');
    assert(svg.indexOf('</svg>') > -1, 'buildPackageSVG 闭合正确');
    assert(/宴席菜单/.test(svg), '套餐页含标题「宴席菜单」');
    assert(/婚宴/.test(svg), '套餐页含宴席名「婚宴」');
    const pkgName = window.eval("(Store.getBanquet('wedding').packages[0].name) || ''");
    assert(pkgName === '' || svg.indexOf(pkgName) > -1, '套餐页含套餐名「' + pkgName + '」');
    assert(/元\/桌/.test(svg), '套餐页含价格单位「元/桌」');
    assert(!/扫码二维码/.test(svg), '套餐页页脚已移除二维码扫码提示（8 点反馈 #8）');
    assert(svg.indexOf('<image') > -1, '套餐页嵌入菜品缩略图（SVG <image>）');
    assert(/font-family="&quot;Noto Serif SC&quot;/.test(svg), '套餐页字体使用转义后的 Noto Serif SC（SVG XML 合法）');

    // 4b) 需求 #3：导出跟随「设置」里上传的 LOGO（无 LOGO 时回退红底白 "S"）
    const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
    window.localStorage.setItem('ss_brand_logo', LOGO);
    window.localStorage.setItem('ss_brand_logo_crop', JSON.stringify({ x: 0.1, y: 0.2, w: 0.6, h: 0.6 }));
    const svgLogo = window.CustomOrder.buildPackageSVG('wedding', pkgId, 1);
    assert(svgLogo.indexOf('brandmark_') > -1, '有 LOGO 时徽标走裁剪图片路径（含 clipPath brandmark_）');
    assert(svgLogo.indexOf(LOGO) > -1, '有 LOGO 时导出嵌入用户 LOGO（跟随前面设置）');
    assert(/brandmark_[^>]*><circle/.test(svgLogo), '有 LOGO 时徽标为圆形裁切（圆心截图框一致，透明底）');
    assert(svgLogo.indexOf('#FFFFFF') === -1, '有 LOGO 时徽标不使用白底矩形');
    assert(svgLogo.indexOf('>S</text>') === -1, '有 LOGO 时不再画默认红底白 "S" 方块');
    window.localStorage.removeItem('ss_brand_logo');
    window.localStorage.removeItem('ss_brand_logo_crop');
    const svgNoLogo = window.CustomOrder.buildPackageSVG('wedding', pkgId, 1);
    assert(svgNoLogo.indexOf('>S</text>') > -1, '无 LOGO 时回退默认红底白 "S" 方块');

    // 5) 调用不抛同步异常（栅格化依赖真实 canvas，jsdom 下异步完成，此处仅验证入口安全）
    let threw = false;
    try {
      window.CustomOrder.exportWholeMenu('wedding', { scale: 1 });
    } catch (e) { threw = true; console.error('    exportWholeMenu threw:', e && e.message); }
    assert(!threw, 'exportWholeMenu 可调用（异步栅格化在浏览器 canvas 中完成）');

    setTimeout(function () {
      // jsdom 没有 canvas 后端，getContext('2d') 必然抛「Not implemented」——真实浏览器不会出现，
      // 且代码已 try/catch 优雅降级（上一条断言 resolve null 即为证），故从错误清单中剔除该已知环境噪声。
      const realErrors = consoleErrors.filter(function (m) {
        return !/Not implemented:\s*HTMLCanvasElement/.test(m) && !/without installing the canvas npm package/.test(m);
      });
      if (consoleErrors.length !== realErrors.length) {
        console.log('  · 已忽略 ' + (consoleErrors.length - realErrors.length) + ' 条 jsdom 无 canvas 后端的已知噪声');
      }
      assert(realErrors.length === 0, '运行期无 jsdom 报错' + (realErrors.length ? '：' + realErrors.join(' | ') : ''));
      console.log('\n' + (failures === 0 ? '✅ 全部通过' : '❌ 失败 ' + failures + ' 项'));
      process.exit(failures === 0 ? 0 : 1);
    }, 20);
  } catch (e) {
    console.error('  ✗ THREW: ' + (e && e.stack ? e.stack : e));
    failures++;
    console.log('\n❌ 失败 ' + failures + ' 项');
    process.exit(1);
  }
}
