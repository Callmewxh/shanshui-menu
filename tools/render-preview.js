#!/usr/bin/env node
// 真实调用 CustomOrder._buildSVG，生成 A4 SVG 并用 resvg 栅格化为 PNG，
// 便于在迭代中直接查看导出排版（间距 / 左右对称）。
const path = require('path');
const fs = require('fs');
let Resvg;
try { ({ Resvg } = require('@resvg/resvg-js')); } catch (_) { Resvg = null; }
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
const a1 = cfg.menu.wedding.packages.find((p) => p.id === 'A1');
global.Store = {
  getBanquet: () => ({ name: '婚宴' }),
  getPackage: () => a1,
  resolvePackage: () => a1.dishes.map((id) => byId[id]).filter(Boolean),
  getLibDish: (id) => byId[id],
};

require(path.join(ROOT, 'assets', 'custom.js'));
const CO = global.window.CustomOrder;
if (!CO || !CO._buildSVG) { console.error('FAIL'); process.exit(1); }

function render(ver, k, label) {
  CO.enter('wedding', 'A1');
  CO._setTotal('2399');
  const svg = CO._buildSVG(ver, k);
  const outSvg = path.join(ROOT, 'prototype', 'preview-' + label + '.svg');
  const outPng = path.join(ROOT, 'prototype', 'preview-' + label + '.png');
  fs.writeFileSync(outSvg, svg, 'utf8');
  if (!Resvg) { console.log('wrote', outSvg, '(PNG renderer unavailable)'); return; }
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1240 } });
  const png = resvg.render();
  fs.writeFileSync(outPng, png.asPng());
  console.log('wrote', outPng, '(' + (png.width) + 'x' + png.height + ')');
}

function renderLandscape(k) {
  CO.enter('wedding', 'A1');
  CO._setTotal('2399');
  const svg = CO._buildPhotoLandscapeSVG(k);
  const outSvg = path.join(ROOT, 'prototype', 'preview-landscape-a4.svg');
  const outPng = path.join(ROOT, 'prototype', 'preview-landscape-a4.png');
  fs.writeFileSync(outSvg, svg, 'utf8');
  if (!Resvg) { console.log('wrote', outSvg, '(PNG renderer unavailable)'); return; }
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1600 } });
  const png = resvg.render();
  fs.writeFileSync(outPng, png.asPng());
  console.log('wrote', outPng, '(' + png.width + 'x' + png.height + ')');
}

render('thumb', 1, 'thumb-k1');
render('plain', 1, 'plain-k1');
renderLandscape(1);
