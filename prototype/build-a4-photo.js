#!/usr/bin/env node
/**
 * build-a4-photo.js —— 宴席定制单 A4 设计稿（v2.2 · 带图版 4×4 网格预览）
 * 读取 data/menu-config.json 真实菜品，套用新中式视觉规范，输出 A4 竖版单页带图版：
 *   单一 4×4 网格（按菜单顺序排，无分类段标题），截图与菜品库 crop 一致。
 * 用于评审「带图版按 v2.2 效果」的最终观感。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'menu-config.json'), 'utf8'));
const byId = Object.fromEntries(cfg.library.map((x) => [x.id, x]));
const pkg = cfg.menu.wedding.packages.find((p) => p.id === 'A1');

const notes = { lib05: '可换清蒸 / 豉汁', lib08: '蒜蓉另上', lib15: '可做热 / 冷', lib19: '忌口请提前告知' };
const dishes = pkg.dishes
  .map((id) => ({ id, lib: byId[id] }))
  .filter((x) => x.lib)
  .map((x) => ({ id: x.id, cat: x.lib.cat, cn: (pkg.nameOverrides && pkg.nameOverrides[x.id]) || x.lib.cn, image: x.lib.image || null, crop: x.lib.crop || null, note: notes[x.id] || '' }));

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
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const card = (d) => `
  <div class="card">
    <div class="thumb" style="${cropBg(d)}"></div>
    <div class="meta">
      <div class="cn">${esc(d.cn)}</div>
      ${d.note ? `<div class="nt">${esc(d.note)}</div>` : ''}
    </div>
  </div>`;

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>宴席定制单 · A4 带图版（v2.2 · 4×4）</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap">
<style>
  :root{ --bg:#F5F0E6; --surface:#FFFFFF; --ink:#3A2E26; --muted:#A88A5E; --primary:#B23A2E; --gold:#C2A15A; --gold-deep:#8A6D1F; --gold-hair:#D8C7A6; --line:#ECE3D2; --serif:"Noto Serif SC","Songti SC",serif; --sans:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#cdbfa6;font-family:var(--sans);display:flex;justify-content:center;padding:20px;color:var(--ink)}
  .page{width:210mm;min-height:297mm;background:var(--bg);position:relative;padding:8mm;display:flex;flex-direction:column;box-shadow:0 6mm 20mm rgba(0,0,0,.25)}
  .page::before{content:"";position:absolute;inset:8mm;border:0.4mm solid var(--gold-hair);border-radius:4mm;pointer-events:none}
  .topband{position:absolute;top:0;left:0;right:0;height:5mm;background:var(--primary)}
  .topband::after{content:"";position:absolute;top:5mm;left:0;right:0;height:0.8mm;background:var(--gold)}
  .head{display:flex;align-items:flex-start;justify-content:space-between;margin-top:4mm}
  .brand{display:flex;align-items:center;gap:3mm}
  .logo{width:13mm;height:13mm;border-radius:3mm;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-weight:900;font-size:8mm}
  .bn{font-family:var(--serif);font-weight:700;font-size:7.4mm;color:var(--primary);letter-spacing:.8mm}
  .bs{font-size:2.8mm;color:var(--muted);letter-spacing:1.6mm;margin-top:.6mm}
  .title{text-align:right}
  .tt{font-family:var(--serif);font-weight:700;font-size:9.5mm;color:var(--ink);letter-spacing:1.6mm}
  .ts{font-size:2.8mm;color:var(--gold-deep);letter-spacing:1.8mm;margin-top:.6mm}
  .info{display:flex;align-items:stretch;margin-top:6mm;background:#FFFDF7;border:0.4mm solid var(--line);border-radius:2.6mm;overflow:hidden}
  .info .l{flex:1;padding:3mm 5mm;display:flex;flex-direction:column;justify-content:center}
  .cl{font-family:var(--serif);font-size:6.2mm;font-weight:700;color:var(--ink)}
  .ct{font-size:3.2mm;color:var(--primary);letter-spacing:.3mm;margin-top:1mm}
  .price{width:42mm;background:var(--primary);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2mm}
  .pl{font-size:2.6mm;letter-spacing:1mm;opacity:.92}
  .pv{font-family:var(--serif);font-size:9mm;font-weight:700;margin-top:.6mm}
  .pv small{font-size:3mm;font-weight:400;margin-left:1mm}
  .grid{margin-top:auto;margin-bottom:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:3mm 4mm;padding-top:8mm}
  .card{background:var(--surface);border:0.4mm solid var(--gold-hair);border-radius:3mm;overflow:hidden;display:flex;flex-direction:column}
  .thumb{margin:1.2mm;aspect-ratio:4/3;border-radius:2mm;background-color:#EDE4D3;background-size:cover;background-position:center}
  .meta{padding:1.8mm 2mm 2.2mm;display:flex;flex-direction:column;gap:.8mm;min-height:9mm;justify-content:center;text-align:center}
  .cn{font-family:var(--serif);font-size:3.3mm;font-weight:700;color:var(--ink);line-height:1.4;letter-spacing:.05mm}
  .nt{font-size:2.6mm;color:var(--primary);letter-spacing:.1mm}
  .ft{margin-top:8mm;display:flex;align-items:center;gap:4mm}
  .ft .line{flex:1;height:0.5mm;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  .ft .mid{flex:none;text-align:center}
  .ft .orn{width:2.4mm;height:2.4mm;background:var(--gold);transform:rotate(45deg);margin:0 auto 1.2mm}
  .ft .pg{font-size:2.9mm;color:var(--muted);letter-spacing:.6mm}
</style></head>
<body>
  <div class="page">
    <div class="topband"></div>
    <div class="head">
      <div class="brand"><div class="logo">S</div><div><div class="bn">山水S酒店</div><div class="bs">SHANSHUI HOTEL</div></div></div>
      <div class="title"><div class="tt">宴席定制单</div><div class="ts">BANQUET CUSTOM ORDER</div></div>
    </div>
    <div class="info">
      <div class="l"><div class="cl">张先生</div><div class="ct">婚宴</div></div>
      <div class="price"><div class="pl">本单总价</div><div class="pv">¥2,399<small>元/桌</small></div></div>
    </div>
    <div class="grid">${dishes.map(card).join('')}</div>
    <div class="ft">
      <div class="line"></div>
      <div class="mid"><div class="orn"></div><div class="pg">本单仅作报价参考，菜品请以实物为主</div></div>
      <div class="line"></div>
    </div>
  </div>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'prototype', 'a4-design-photo.html'), html, 'utf8');
console.log('wrote prototype/a4-design-photo.html · dishes=' + dishes.length);
