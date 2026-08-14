#!/usr/bin/env node
/**
 * build-a4-mockup.js —— 生成「宴席定制报价单」A4 设计稿（HTML 预览）
 * 读取 data/menu-config.json 的真实菜品，套用新中式视觉规范，输出 A4 竖版页面：
 *   1) 带图版 · 第 1 页
 *   2) 带图版 · 第 2 页
 *   3) 无图版 · 单页
 * 产出 prototype/a4-export-mockup.html，供浏览器截图评审。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'menu-config.json'), 'utf8'));
const byId = Object.fromEntries(cfg.library.map((x) => [x.id, x]));
const pkg = cfg.menu.wedding.packages.find((p) => p.id === 'A1');

const CATS = ['凉菜', '主菜', '主食点心'];
const CAT_NUM = { '凉菜': '壹', '主菜': '贰', '主食点心': '叁' };

// 组装菜品行：分类顺序 凉菜→主菜→主食点心；备注仅在设计稿里作示例
const notes = {
  'lib08': '蒜蓉另上',
  'lib05': '可换清蒸/豉汁',
  'lib15': '可做热/冷',
};
const dishes = CATS.flatMap((cat) =>
  pkg.dishes
    .map((id) => ({ id, lib: byId[id] }))
    .filter((x) => x.lib && x.lib.cat === cat)
    .map((x, i) => ({
      id: x.id,
      cat,
      cn: (pkg.nameOverrides && pkg.nameOverrides[x.id]) || x.lib.cn,
      image: x.lib.image || null,
      note: notes[x.id] || '',
      no: i + 1,
    }))
);

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// —— 样式令牌（与 UIUX 手册一致，纸张渲染用 Windows 字体）——
const css = `
:root{
  --bg:#F5F0E6; --surface:#FFFFFF; --ink:#3A2E26; --muted:#A88A5E;
  --primary:#B23A2E; --primary-deep:#8F2A20; --primary-soft:#F6E9D8;
  --gold:#C2A15A; --gold-deep:#8A6D1F; --gold-hair:#D8C7A6; --line:#ECE3D2;
  --serif:"SimSun","STSong","宋体",serif;
  --kai:"KaiTi","STKaiti","楷体",serif;
  --sans:"Microsoft YaHei","PingFang SC","微软雅黑",sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#E9E2D4;font-family:var(--sans);padding:42px 20px 80px}
.stage{max-width:880px;margin:0 auto}
.cap{font-size:15px;color:#6b5c49;margin:34px 0 10px;display:flex;align-items:center;gap:10px}
.cap::before{content:"";width:5px;height:18px;background:var(--primary);border-radius:3px}
.cap small{color:#97866f;font-size:13px}
.page{
  width:210mm;height:297mm;background:var(--bg);color:var(--ink);
  position:relative;overflow:hidden;box-shadow:0 14px 42px rgba(60,45,25,.28);
  margin:0 auto;font-family:var(--sans);
}
.frame{position:absolute;left:7mm;top:7mm;right:7mm;bottom:7mm;border:1px solid var(--gold-hair);border-radius:4mm;pointer-events:none}
.topband{position:absolute;left:0;top:0;width:100%;height:4.5mm;background:var(--primary)}
.topband::after{content:"";position:absolute;left:0;top:4.5mm;width:100%;height:.7mm;background:linear-gradient(90deg,var(--gold),#E5D4A8,var(--gold))}

/* —— 页眉 —— */
.hd{position:absolute;left:16mm;right:16mm;top:11mm;display:flex;align-items:flex-start;justify-content:space-between}
.brand{display:flex;align-items:center;gap:4mm}
.mark{width:12mm;height:12mm;border-radius:2.6mm;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:7mm;font-weight:700}
.bname{font-family:var(--kai);font-size:7.2mm;font-weight:700;color:var(--primary);letter-spacing:.8mm;line-height:1.15}
.bsub{font-size:3mm;color:var(--muted);letter-spacing:1.2mm;margin-top:1mm}
.ttl{text-align:right}
.ttl h1{font-family:var(--kai);font-size:9mm;font-weight:700;color:var(--ink);letter-spacing:1.6mm;line-height:1.2}
.ttl .en{font-size:3mm;color:var(--gold-deep);letter-spacing:1.6mm;margin-top:1.2mm}
.seal{position:absolute;right:0;top:20mm;width:13mm;height:13mm;background:var(--primary);border-radius:1.8mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;place-items:center;color:#fff;font-family:var(--kai);font-size:4.2mm;line-height:1;padding:1.2mm;letter-spacing:.4mm}

.info{position:absolute;left:16mm;right:16mm;top:39mm;display:flex;align-items:stretch;background:#FFFDF7;border:1px solid var(--line);border-radius:2.6mm;overflow:hidden}
.info .it{flex:1;padding:3.2mm 5mm;position:relative}
.info .it + .it::before{content:"";position:absolute;left:0;top:3mm;bottom:3mm;width:.4mm;background:var(--line)}
.info .lb{font-size:3mm;color:var(--muted);letter-spacing:1mm;margin-bottom:1.2mm}
.info .vl{font-family:var(--serif);font-size:5mm;font-weight:700;color:var(--ink)}
.info .vl.gold{color:var(--gold-deep)}
.info .vl em{font-style:normal;font-size:3.2mm;font-weight:400;color:var(--muted);margin-left:1.5mm}

/* —— 分类标题 —— */
.cat{display:flex;align-items:center;gap:3mm;margin:0 0 4mm}
.grid .cat{grid-column:1/-1;margin:1mm 0 0}
.grid > .cat:first-child,.plain > .cat:first-child{margin-top:3mm}
.cat .tick{width:2.6mm;height:2.6mm;background:var(--primary);transform:rotate(45deg);flex:none}
.cat h2{font-family:var(--kai);font-size:6.4mm;font-weight:700;color:var(--primary);letter-spacing:1.4mm;white-space:nowrap}
.cat .cnt{font-size:3.2mm;color:var(--muted);letter-spacing:.4mm;white-space:nowrap}
.cat .rule{flex:1;height:.55mm;background:linear-gradient(90deg,var(--gold),transparent)}

/* —— 带图卡片 —— */
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3.5mm 3.5mm}
.card{background:var(--surface);border:1px solid var(--gold-hair);border-radius:3mm;overflow:hidden;display:flex;flex-direction:column}
.thumb{position:relative;margin:1.6mm;aspect-ratio:4/3;border-radius:2mm;overflow:hidden;background:#EDE4D3}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.card .tag{position:absolute;left:1.2mm;top:1.2mm;background:var(--primary);color:#fff;font-size:2.6mm;letter-spacing:.4mm;padding:.7mm 1.4mm;border-radius:1mm;line-height:1}
.card .meta{height:17mm;padding:1.8mm 2.4mm;display:flex;flex-direction:column;gap:1mm}
.card .cn{font-family:var(--serif);font-size:3.4mm;font-weight:700;color:var(--ink);letter-spacing:0;line-height:1.3;min-height:8.8mm;overflow:hidden}
.card .nt{font-size:2.9mm;color:var(--primary);letter-spacing:.2mm;min-height:1em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .nt.empty{color:transparent}

/* —— 无图版 —— */
.plain{position:absolute;left:16mm;right:16mm;top:64mm;bottom:22mm}
.prow{display:flex;align-items:baseline;gap:3mm;padding:2.2mm 0}
.prow + .prow{border-top:.35mm solid var(--line)}
.prow .no{font-family:var(--serif);font-size:3.6mm;color:var(--gold-deep);letter-spacing:.3mm;flex:none}
.prow .cn{font-family:var(--serif);font-size:4.6mm;font-weight:700;color:var(--ink);letter-spacing:.3mm;white-space:nowrap}
.prow .lead{flex:1;border-bottom:.6mm dotted var(--gold-hair);transform:translateY(-1.2mm)}
.prow .nt{font-size:3.3mm;color:var(--primary);letter-spacing:.2mm;flex:none;white-space:nowrap}
.prow .none{flex:none;width:0}

/* —— 页脚 —— */
.ft{position:absolute;left:16mm;right:16mm;bottom:12mm;display:flex;align-items:center;gap:4mm}
.ft .line{flex:1;height:.5mm;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
.ft .mid{text-align:center;flex:none}
.ft .orn{width:2.4mm;height:2.4mm;background:var(--gold);transform:rotate(45deg);margin:0 auto 1.2mm}
.ft .pg{font-size:3mm;color:var(--muted);letter-spacing:1.2mm}
.ft .side{font-size:2.9mm;color:var(--muted);letter-spacing:.5mm;flex:1}
.ft .side.r{text-align:right}

/* —— 页面 2 紧凑页眉 —— */
.hd2{position:absolute;left:16mm;right:16mm;top:12mm;display:flex;align-items:center;justify-content:space-between}
.hd2 .b{font-family:var(--kai);font-size:5.4mm;font-weight:700;color:var(--primary);letter-spacing:.8mm}
.hd2 .b i{font-style:normal;color:var(--muted);font-size:3.4mm;letter-spacing:.5mm;font-family:var(--sans);margin-left:2mm}
.hd2 .pg{font-size:3.2mm;color:var(--muted);letter-spacing:1mm}
.body2{position:absolute;left:16mm;right:16mm;top:28mm;bottom:26mm}
`;

// —— 页眉 HTML ——
function header() {
  return `
  <div class="topband"></div>
  <div class="frame"></div>
  <div class="hd">
    <div class="brand">
      <div class="mark">S</div>
      <div>
        <div class="bname">山水S酒店</div>
        <div class="bsub">SHANSHUI HOTEL</div>
      </div>
    </div>
    <div class="ttl">
      <h1>宴席定制报价单</h1>
      <div class="en">BANQUET QUOTATION</div>
    </div>
  </div>
  <div class="seal"><span>宴</span><span>席</span><span>定</span><span>制</span></div>
  <div class="info">
    <div class="it"><div class="lb">客 户</div><div class="vl">张先生<em>尊贵的宴请嘉宾</em></div></div>
    <div class="it"><div class="lb">宴 席</div><div class="vl">婚宴 · 百年好合<em>（￥2,399 元/桌）</em></div></div>
    <div class="it"><div class="lb">出 单</div><div class="vl gold">2026 年 8 月 12 日</div></div>
  </div>`;
}

function header2(page, total) {
  return `
  <div class="topband"></div>
  <div class="frame"></div>
  <div class="hd2">
    <div class="b">山水S酒店 · 宴席定制报价单<i>婚宴 · 百年好合</i></div>
    <div class="pg">第 ${page} 页 / 共 ${total} 页</div>
  </div>`;
}

function footer(page, total) {
  return `
  <div class="ft">
    <div class="side">山水S酒店 · 宴席定制</div>
    <div class="line"></div>
    <div class="mid"><div class="orn"></div><div class="pg">第 ${page} 页 · 共 ${total} 页</div></div>
    <div class="line"></div>
    <div class="side r">本单仅作报价参考，以最终确认为准</div>
  </div>`;
}

function catHead(cat, count) {
  return `<div class="cat"><span class="tick"></span><h2>${CAT_NUM[cat]} · ${cat}</h2><span class="cnt">共 ${count} 道</span><span class="rule"></span></div>`;
}

function card(d) {
  return `<div class="card">
    <div class="thumb">
      ${d.image ? `<img src="${d.image}" alt="">` : ''}
      <span class="tag">${esc(d.cat)}</span>
    </div>
    <div class="meta">
      <div class="cn">${esc(d.cn)}</div>
      <div class="nt${d.note ? '' : ' empty'}">${d.note ? esc(d.note) : '·'}</div>
    </div>
  </div>`;
}

// —— 带图版：单页 4 列，全部菜品一页放完（分类用照片角标）——
function photoPageHtml() {
  return `<div class="page">
    ${header()}
    <div class="grid" style="position:absolute;left:16mm;right:16mm;top:64mm">
      ${dishes.map(card).join('\n    ')}
    </div>
    ${footer(1, 1)}
  </div>`;
}

// —— 无图版：单页 ——
function plainPageHtml() {
  const body = [];
  CATS.forEach((cat) => {
    const rows = dishes.filter((d) => d.cat === cat);
    if (!rows.length) return;
    body.push(catHead(cat, rows.length));
    rows.forEach((d) => {
      body.push(`<div class="prow">
        <span class="no">${String(d.no).padStart(2, '0')}</span>
        <span class="cn">${esc(d.cn)}</span>
        <span class="lead"></span>
        ${d.note ? `<span class="nt">（${esc(d.note)}）</span>` : '<span class="none"></span>'}
      </div>`);
    });
  });
  return `<div class="page">
    ${header()}
    <div class="plain">${body.join('\n  ')}</div>
    ${footer(1, 1)}
  </div>`;
}

const pages = [
  ['带图版 · 单页', '全部 16 道 · 4 列小图 · 分类角标', photoPageHtml()],
  ['无图版 · 单页', '全部 16 道 · 编号列表', plainPageHtml()],
];

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>宴席定制报价单 · A4 设计稿</title>
<style>${css}</style>
</head>
<body>
<div class="stage">
  ${pages.map(([t, sub, p]) => `<div class="cap">${t}<small>${sub}</small></div>${p}`).join('\n  ')}
</div>
</body>
</html>`;

const out = path.join(ROOT, 'prototype', 'a4-export-mockup.html');
fs.writeFileSync(out, html, 'utf8');
console.log('written', out, (fs.statSync(out).size / 1024).toFixed(0) + 'KB', 'dishes:', dishes.length);
