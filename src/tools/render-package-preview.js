// 整份菜单导出「单套餐页」真实数据预览渲染器
// 用途：把 buildPackageSVG 的输出用「线上真实菜单数据」（data/menu-config.json）渲成 .svg + 一个对照 HTML，
//       让人眼直接验收视觉保真（排版/裁切/字体/页脚），不依赖浏览器 canvas。
// 用法：node tools/render-package-preview.js [banquetId] [scale]
//       默认 banquetId=wedding，scale=1；输出到 prototype/pkg-preview-*.svg 与 prototype/pkg-preview.html

const fs = require('fs');
const path = require('path');
const jsdomPath = 'C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/jsdom';
const { JSDOM, VirtualConsole } = require(jsdomPath);

const PROJ = 'E:/山水S酒店/菜单系统';
const OUT = path.join(PROJ, 'prototype');
const banquetId = process.argv[2] || 'wedding';
const scale = parseFloat(process.argv[3] || '1') || 1;

const html = fs.readFileSync(path.join(PROJ, 'index.html'), 'utf8');
const vc = new VirtualConsole();
vc.on('jsdomError', () => {});   // 忽略 jsdom 无 canvas 后端的已知噪声

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    window.scrollTo = () => {};
    window.IntersectionObserver = window.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
    window.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
    if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:test';
    window.alert = () => {};
    window.confirm = () => true;
  }
});

const { window } = dom;
const document = window.document;

['assets/qrcode.js', 'assets/data.js', 'assets/store.js', 'assets/app.js', 'assets/custom.js'].forEach(f => {
  const s = document.createElement('script');
  s.textContent = fs.readFileSync(path.join(PROJ, f), 'utf8');
  document.body.appendChild(s);
});

setTimeout(() => {
  // 载入线上真实菜单（含真实菜品照片），确保预览＝客户实际拿到的样子
  const cfgPath = path.join(PROJ, 'data/menu-config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = fs.readFileSync(cfgPath, 'utf8');
    window.__CFG__ = cfg;
    try {
      window.eval('(function(){ var c = JSON.parse(window.__CFG__); if (Store.importConfig) Store.importConfig(c); })()');
      console.log('已载入 data/menu-config.json 真实菜单数据');
    } catch (e) {
      console.log('载入真实数据失败，回落种子数据：' + e.message);
    }
  } else {
    console.log('未找到 data/menu-config.json，使用种子数据');
  }

  const b = window.eval('JSON.stringify(Store.getBanquet(' + JSON.stringify(banquetId) + ') || null)');
  const banquet = JSON.parse(b);
  if (!banquet || !banquet.packages || !banquet.packages.length) {
    console.error('宴席「' + banquetId + '」不存在或无套餐');
    process.exit(1);
  }
  console.log('宴席：' + banquet.name + '，套餐数：' + banquet.packages.length);

  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const cards = [];
  banquet.packages.forEach((p, i) => {
    const svg = window.CustomOrder.buildPackageSVG(banquetId, p.id, scale);
    const file = 'pkg-preview-' + banquetId + '-' + String(p.id).replace(/[^\w]/g, '') + '.svg';
    fs.writeFileSync(path.join(OUT, file), svg, 'utf8');
    const dishCount = (svg.match(/<image /g) || []).length;
    console.log('  第 ' + (i + 1) + ' 页 · ' + p.id + ' ' + (p.name || '') + ' → ' + file
      + '（' + Math.round(svg.length / 1024) + ' KB，含图 ' + dishCount + ' 张）');
    cards.push({ file, title: (p.id + ' · ' + (p.name || '')), price: p.price || '' });
  });

  // 对照 HTML：一屏铺开所有页面，等同 PDF 的每套餐一页
  const page = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>整份菜单导出预览 · ${banquet.name}</title>
<style>
  body { margin:0; padding:28px; background:#3A2E26; font-family:"PingFang SC","Microsoft YaHei",sans-serif; }
  h1 { color:#F5F0E6; font-size:19px; font-weight:600; margin:0 0 6px; }
  .sub { color:#C2A15A; font-size:13px; margin:0 0 22px; }
  .grid { display:flex; flex-wrap:wrap; gap:24px; }
  .card { background:#F5F0E6; border-radius:8px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,.35); }
  .cap { padding:9px 14px; font-size:13px; color:#8F2A20; background:#FBF7EE; border-bottom:1px solid #D8C7A6; }
  .cap b { color:#B23A2E; }
  img { display:block; width:420px; height:auto; }
</style></head><body>
<h1>整份菜单导出预览 · ${banquet.name}（每套餐一页，共 ${cards.length} 页）</h1>
<p class="sub">档位 ×${scale} · 数据源 data/menu-config.json · 此为 PDF 每页的真实内容（PDF 会额外在右下角烧入二维码）</p>
<div class="grid">
${cards.map((c, i) => `  <div class="card"><div class="cap">第 ${i + 1} 页 &nbsp;<b>${c.title}</b>${c.price ? ' &nbsp;¥' + c.price + '/桌' : ''}</div><img src="${c.file}" alt="${c.title}"></div>`).join('\n')}
</div>
</body></html>`;
  fs.writeFileSync(path.join(OUT, 'pkg-preview.html'), page, 'utf8');
  console.log('\n对照页：prototype/pkg-preview.html');
  process.exit(0);
}, 200);
