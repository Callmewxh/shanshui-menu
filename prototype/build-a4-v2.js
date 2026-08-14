#!/usr/bin/env node
/**
 * build-a4-v2.js —— 宴席定制单 A4 设计稿（v2 · 分品类段）
 * 读取 data/menu-config.json 真实菜品，套用新中式视觉规范，输出 A4 竖版单页：
 *   ① 带图版 · 分品类段（凉菜/主菜/主食点心 各自成块，4 列网格，截图与菜品库一致）
 *   ② 无图版 · 分品类段（编号清单，适合微信发送 / 打印省墨）
 * 产出 prototype/a4-design-v2.html 与 prototype/a4-design-v2-plain.html，供评审。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'menu-config.json'), 'utf8'));
const byId = Object.fromEntries(cfg.library.map((x) => [x.id, x]));
const pkg = cfg.menu.wedding.packages.find((p) => p.id === 'A1');

const CATS = ['凉菜', '主菜', '主食点心'];
const CAT_NUM = { '凉菜': '壹', '主菜': '贰', '主食点心': '叁' };

// 示例备注（仅设计稿展示用，真实导出取定制单填写的备注）
const notes = {
  'lib05': '可换清蒸 / 豉汁',
  'lib08': '蒜蓉另上',
  'lib15': '可做热 / 冷',
  'lib19': '忌口请提前告知',
};

const dishes = pkg.dishes
  .map((id) => ({ id, lib: byId[id] }))
  .filter((x) => x.lib)
  .map((x) => ({
    id: x.id,
    cat: x.lib.cat,
    cn: (pkg.nameOverrides && pkg.nameOverrides[x.id]) || x.lib.cn,
    image: x.lib.image || null,
    crop: x.lib.crop || null,
    note: notes[x.id] || '',
  }));

// 与 assets/app.js 的 cropBg(d) 完全一致：保证截图位置与菜品库展示一致
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function cropBg(d) {
  const c = (d && d.crop) ? d.crop : null;
  if (c && typeof c.w === 'number') {
    const w = clamp(c.w, 0.05, 1), h = clamp((typeof c.h === 'number' ? c.h : w * 0.75), 0.05, 1);
    const x = clamp(c.x, 0, 1 - w), y = clamp(c.y, 0, 1 - h);
    const sizeW = (100 / w).toFixed(3), sizeH = (100 / h).toFixed(3);
    const posX = (1 - w < 1e-4) ? '0' : (x / (1 - w) * 100).toFixed(2);
    const posY = (1 - h < 1e-4) ? '0' : (y / (1 - h) * 100).toFixed(2);
    return `background-image:url('${d.image}');background-size:${sizeW}% ${sizeH}%;background-position:${posX}% ${posY}%;background-repeat:no-repeat;background-color:#EDE4D3;`;
  }
  const y = (c && typeof c.y === 'number') ? c.y : 50;
  return `background-image:url('${d.image || ''}');background-size:cover;background-position:50% ${y}%;background-repeat:no-repeat;background-color:#EDE4D3;`;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// —— 共享样式（带图版 + 无图版 通用部分）——
const css = `
:root{
  --bg:#F5F0E6; --surface:#FFFFFF; --ink:#3A2E26; --muted:#A88A5E;
  --primary:#B23A2E; --primary-deep:#8F2A20; --primary-soft:#F6E9D8;
  --gold:#C2A15A; --gold-deep:#8A6D1F; --gold-hair:#D8C7A6; --line:#ECE3D2;
  --serif:"Noto Serif SC","Songti SC","STSong","SimSun",serif;
  --kai:"KaiTi","STKaiti","楷体",serif;
  --sans:"Microsoft YaHei","PingFang SC","微软雅黑",sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#E9E2D4;font-family:var(--sans);padding:42px 20px 80px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.stage{max-width:880px;margin:0 auto}
.cap{font-size:15px;color:#6b5c49;margin:34px 0 10px;display:flex;align-items:center;gap:10px}
.cap::before{content:"";width:5px;height:18px;background:var(--primary);border-radius:3px}
.cap small{color:#97866f;font-size:13px}

.page{
  width:210mm;min-height:297mm;background:var(--bg);color:var(--ink);
  position:relative;overflow:hidden;box-shadow:0 14px 42px rgba(60,45,25,.28);
  margin:0 auto;font-family:var(--sans);
  padding:11mm 16mm 12mm;display:flex;flex-direction:column;
}
.frame{position:absolute;left:8mm;top:8mm;right:8mm;bottom:8mm;border:1px solid var(--gold-hair);border-radius:4mm;pointer-events:none}
.topband{position:absolute;left:0;top:0;width:100%;height:5mm;background:var(--primary)}
.topband::after{content:"";position:absolute;left:0;top:5mm;width:100%;height:.8mm;background:linear-gradient(90deg,var(--gold),#E5D4A8,var(--gold))}

/* —— 抬头 —— */
.hd{display:flex;align-items:flex-start;justify-content:space-between;margin-top:2mm}
.brand{display:flex;align-items:center;gap:4mm}
.mark{width:13mm;height:13mm;border-radius:3mm;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:8mm;font-weight:700;flex:none}
.bleft .bname{font-family:var(--kai);font-size:7.4mm;font-weight:700;color:var(--primary);letter-spacing:.8mm;line-height:1.15}
.bsub{font-size:2.8mm;color:var(--muted);letter-spacing:1.6mm;margin-top:1mm}
.ttl{text-align:right}
.ttl h1{font-family:var(--kai);font-size:9.5mm;font-weight:700;color:var(--ink);letter-spacing:1.6mm;line-height:1.2}
.ttl .en{font-size:2.8mm;color:var(--gold-deep);letter-spacing:1.8mm;margin-top:1.4mm}

/* —— 信息条（无标签 · 客户/宴席直写 · 价格高亮）—— */
.info{display:flex;align-items:center;margin-top:4mm;background:#FFFDF7;border:1px solid var(--line);border-radius:2.6mm;overflow:hidden;padding:3.5mm 5mm}
.info .who{flex:1;min-width:0}
.info .who .name{font-family:var(--serif);font-size:6.2mm;font-weight:700;color:var(--ink);line-height:1.2}
.info .who .type{font-size:3.2mm;color:var(--primary);letter-spacing:.3mm;margin-top:1.4mm}
.info .price{flex:none;background:var(--primary);border-radius:2.6mm;padding:2.2mm 5mm;text-align:center;color:#fff}
.info .price .pl{font-size:2.6mm;letter-spacing:1mm;opacity:.92;margin-bottom:.8mm}
.info .price .pv{font-family:var(--serif);font-size:9mm;font-weight:700;line-height:1}
.info .price .pv .unit{font-size:3mm;font-weight:400;margin-left:1mm}

/* —— 分类段标题 —— */
.cat{display:flex;align-items:center;gap:3mm;margin:4mm 0 3mm}
.cat:first-of-type{margin-top:6mm}
.cat .tick{width:3mm;height:3mm;background:var(--primary);transform:rotate(45deg);flex:none}
.cat h2{font-family:var(--kai);font-size:6mm;font-weight:700;color:var(--primary);letter-spacing:1mm;white-space:nowrap}
.cat .cnt{font-size:2.8mm;color:var(--muted);letter-spacing:.3mm;white-space:nowrap}
.cat .rule{flex:1;height:.55mm;background:linear-gradient(90deg,var(--gold),transparent)}

/* —— 带图卡片（4 列 · 居中 · 缩小图） —— */
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm 4mm;justify-items:center;margin-bottom:2mm}
.card{max-width:38mm;width:100%;background:var(--surface);border:1px solid var(--gold-hair);border-radius:3mm;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 1mm 3mm rgba(120,90,40,.06)}
.thumb{position:relative;margin:1.2mm;aspect-ratio:4/3;border-radius:2mm;overflow:hidden;background:#EDE4D3;background-size:cover;background-position:50% 50%}
.card .meta{padding:1.4mm 2mm 1.8mm;display:flex;flex-direction:column;gap:.7mm;min-height:11mm;justify-content:center}
.card .cn{font-family:var(--serif);font-size:3.5mm;font-weight:700;color:var(--ink);line-height:1.4;letter-spacing:.05mm}
.card .nt{font-size:2.7mm;color:var(--primary);letter-spacing:.1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .nt.empty{visibility:hidden}

/* —— 无图清单行 —— */
.plain{display:flex;flex-direction:column}
.prow{display:flex;align-items:baseline;gap:3mm;padding:2.6mm 0}
.prow+.prow{border-top:.35mm solid var(--line)}
.prow .no{font-family:var(--serif);font-size:3.6mm;color:var(--gold-deep);letter-spacing:.3mm;flex:none;width:8mm}
.prow .cn{font-family:var(--serif);font-size:4.6mm;font-weight:700;color:var(--ink);letter-spacing:.2mm;white-space:nowrap}
.prow .lead{flex:1;border-bottom:.6mm dotted var(--gold-hair);transform:translateY(-1.2mm)}
.prow .nt{font-size:3mm;color:var(--primary);letter-spacing:.2mm;flex:none;white-space:nowrap}
.prow .none{flex:none;width:0}

/* —— 页脚 —— */
.ft{margin-top:auto;padding-top:6mm;display:flex;align-items:center;gap:5mm}
.ft .line{flex:1;height:.5mm;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
.ft .mid{text-align:center;flex:none}
.ft .orn{width:2.4mm;height:2.4mm;background:var(--gold);transform:rotate(45deg);margin:0 auto 1.2mm}
.ft .disc{font-size:2.9mm;color:var(--muted);letter-spacing:.6mm;white-space:nowrap}

@media print{
  body{background:#fff;padding:0}
  .stage{max-width:none}
  .cap{display:none}
  .page{box-shadow:none;margin:0;page-break-after:avoid}
  @page{size:A4;margin:0}
}
`;

function catHead(cat, count) {
  return `<div class="cat"><span class="tick"></span><h2>${CAT_NUM[cat]} · ${cat}</h2><span class="cnt">共 ${count} 道</span><span class="rule"></span></div>`;
}

function card(d) {
  return `<div class="card">
    <div class="thumb" style="${cropBg(d)}"></div>
    <div class="meta">
      <div class="cn">${esc(d.cn)}</div>
      <div class="nt${d.note ? '' : ' empty'}">${d.note ? esc(d.note) : '·'}</div>
    </div>
  </div>`;
}

function plainRow(d, no) {
  return `<div class="prow">
    <span class="no">${String(no).padStart(2, '0')}</span>
    <span class="cn">${esc(d.cn)}</span>
    <span class="lead"></span>
    ${d.note ? `<span class="nt">（${esc(d.note)}）</span>` : '<span class="none"></span>'}
  </div>`;
}

// —— 带图版：分品类段 ——
function photoSections() {
  let no = 0;
  return CATS.map((cat) => {
    const rows = dishes.filter((d) => d.cat === cat);
    if (!rows.length) return '';
    no = 0;
    return catHead(cat, rows.length) +
      `<div class="grid">${rows.map((d) => card(d)).join('\n      ')}</div>`;
  }).join('\n    ');
}

// —— 无图版：分品类段清单 ——
function plainSections() {
  let no = 0;
  return CATS.map((cat) => {
    const rows = dishes.filter((d) => d.cat === cat);
    if (!rows.length) return '';
    return catHead(cat, rows.length) +
      `<div class="plain">${rows.map((d) => plainRow(d, ++no)).join('\n      ')}</div>`;
  }).join('\n    ');
}

function pageShell(inner, sub) {
  return `<div class="page">
  <div class="topband"></div>
  <div class="frame"></div>
  <div class="hd">
    <div class="brand">
      <div class="mark">S</div>
      <div class="bleft">
        <div class="bname">山水S酒店</div>
        <div class="bsub">SHANSHUI HOTEL</div>
      </div>
    </div>
    <div class="ttl">
      <h1>宴席定制单</h1>
      <div class="en">BANQUET CUSTOM ORDER</div>
    </div>
  </div>
  <div class="info">
    <div class="who">
      <div class="name">张先生</div>
      <div class="type">婚宴·百年好合</div>
    </div>
    <div class="price">
      <div class="pl">本单总价</div>
      <div class="pv">¥2,399<span class="unit">元/桌</span></div>
    </div>
  </div>
  ${inner}
  <div class="ft">
    <div class="line"></div>
    <div class="mid"><div class="orn"></div><div class="disc">本单仅作报价参考，菜品请以实物为主</div></div>
    <div class="line"></div>
  </div>
</div>`;
}

function writeHtml(file, title, sub, inner) {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<div class="stage">
  <div class="cap">${sub}<small>${sub}</small></div>
  ${pageShell(inner, sub)}
</div>
</body>
</html>`;
  const out = path.join(ROOT, 'prototype', file);
  fs.writeFileSync(out, html, 'utf8');
  console.log('written', out, (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
}

writeHtml('a4-design-v2.html', '宴席定制单 · A4 带图版 v2', '带图版 · 分品类段 · 单页', photoSections());
writeHtml('a4-design-v2-plain.html', '宴席定制单 · A4 无图版 v2', '无图版 · 分品类段 · 单页', plainSections());
