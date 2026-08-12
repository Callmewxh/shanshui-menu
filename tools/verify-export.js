#!/usr/bin/env node
// 用最小 DOM 桩加载 assets/custom.js，真实调用 CustomOrder 的 enter + _buildSVG，
// 校验 A4 导出在当前代码下能正常产出 SVG（带图/无图两版），并做基本健全性检查。
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');

// —— 最小桩 ——
const fakeEl = () => ({
  setAttribute() {}, getAttribute() { return null; }, appendChild() {},
  classList: { add() {}, remove() {} }, style: {}, addEventListener() {},
  querySelector: () => null, querySelectorAll: () => [], hidden: false, textContent: '', value: '',
});
global.document = {
  querySelector: () => null, querySelectorAll: () => [],
  readyState: 'complete', addEventListener: () => {},
  createElement: fakeEl, getElementById: () => null,
  body: { appendChild() {} },
};
global.window = {};
global.localStorage = { getItem: () => null, setItem() {} };

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'menu-config.json'), 'utf8'));
const byId = Object.fromEntries(cfg.library.map((x) => [x.id, x]));
const a1 = cfg.menu.wedding.packages.find((p) => p.id === 'A1');
global.Store = {
  getBanquet: () => ({ name: '婚宴' }),
  getPackage: () => a1,
  resolvePackage: () => a1.dishes.map((id) => byId[id]).filter(Boolean),
  getLibDish: (id) => byId[id],
};

require(path.join(ROOT, 'assets', 'custom.js'));
const CO = global.window.CustomOrder;
if (!CO || !CO.enter || !CO._buildSVG) { console.error('FAIL: CustomOrder not exposed'); process.exit(1); }

CO.enter('wedding', 'A1');
CO._setTotal('2399');

['thumb', 'plain'].forEach((ver) => {
  const svg = CO._buildSVG(ver, 1);
  const bad = /NaN|undefined|Infinity/.test(svg);
  const okHead = svg.startsWith('<svg') && svg.trim().endsWith('</svg>');
  // 估算高度是否 A4：viewBox 宽高比应≈0.707（竖版）
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const ratio = vb ? (+(vb[2]) / +(vb[1])).toFixed(4) : '?';
  const imgCount = (svg.match(/<image/g) || []).length;
  fs.writeFileSync(path.join(ROOT, 'prototype', 'a4-real-' + ver + '.svg'), svg, 'utf8');
  console.log('[' + ver + '] len=' + svg.length + ' okHead=' + okHead + ' badToken=' + bad + ' a4ratio=' + ratio + ' images=' + imgCount);
});
