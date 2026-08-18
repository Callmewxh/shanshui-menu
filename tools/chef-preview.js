#!/usr/bin/env node
// 生成总厨定制单 SVG 预览（含换菜/加菜/价格变化），用于快速验收排版
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');

const fakeEl = () => ({
  setAttribute() {}, getAttribute() { return null; }, appendChild() {},
  classList: { add() {}, remove() {} }, style: {}, addEventListener() {},
  querySelector: () => null, querySelectorAll: () => [], hidden: false, textContent: '', value: '',
});
global.document = {
  querySelector: () => null, querySelectorAll: () => [],
  readyState: 'complete', addEventListener: () => {},
  createElement: fakeEl, getElementById: () => null, body: { appendChild() {} },
};
global.window = {};
global.localStorage = { getItem: () => null, setItem() {} };

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'menu-config.json'), 'utf8'));
const byId = Object.fromEntries(cfg.library.map((x) => [x.id, x]));
const pkg = cfg.menu.wedding.packages.find((p) => p.id === 'A1') || cfg.menu.wedding.packages[0];
global.Store = {
  getBanquet: () => ({ name: '婚宴' }),
  getPackage: () => pkg,
  resolvePackage: () => pkg.dishes.map((id) => byId[id]).filter(Boolean),
  getLibDish: (id) => byId[id],
};

require(path.join(ROOT, 'assets', 'custom.js'));
const CO = global.window.CustomOrder;
if (!CO || !CO._buildChefSVG) { console.error('FAIL'); process.exit(1); }

CO.enter('wedding', pkg.id);
CO._setTotal('2599');

const dr = CO._getDraft();
if (dr && dr.lines && dr.lines.length >= 4) {
  // 模拟换菜：把第 3 道菜换成另一道菜
  const line = dr.lines[2];
  line.swappedFrom = line.libId;
  line.swappedFromCn = line.cn;
  const swapTarget = byId['lib06'] || byId[pkg.dishes[pkg.dishes.length - 1]];
  line.libId = swapTarget.id;
  line.cn = swapTarget.cn;
  line.en = swapTarget.en;
  line.cat = swapTarget.cat;
  // 模拟加菜：最后一道改为新增
  const addLine = dr.lines[dr.lines.length - 1];
  addLine.added = true;
}

const svg = CO._buildChefSVG();
const outSvg = path.join(ROOT, 'prototype', 'preview-chef.svg');
fs.writeFileSync(outSvg, svg, 'utf8');
console.log('wrote', outSvg);
