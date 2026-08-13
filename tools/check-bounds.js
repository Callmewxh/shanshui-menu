/* 边界检查：用真实 _buildSVG 输出，解析所有 rect/image 的 x/y/w/h，
 * 验证带图版(4×4) 与 无图版 的每张卡片/图片都落在 A4 页面内（不裁切）。 */
const fs = require('fs');
const vm = require('vm');

const cfg = JSON.parse(fs.readFileSync('data/menu-config.json', 'utf8'));
const byId = Object.fromEntries(cfg.library.map(d => [d.id, d]));
const A1 = cfg.menu.wedding.packages.find(p => p.id === 'A1');
const dishes = A1.dishes.map(id => {
  const d = byId[id];
  return { id, cn: d.cn, cat: d.cat, image: d.image || null, crop: d.crop || null, en: d.en || '' };
});

// —— 浏览器最小桩 ——
const noop = () => {};
function makeEl() {
  return new Proxy(function () {}, {
    get: (t, p) => {
      if (p === 'style') return {};
      if (p === 'classList') return { add: noop, remove: noop, contains: () => false };
      if (['addEventListener','removeEventListener','appendChild','setAttribute','closest','querySelector','querySelectorAll'].includes(p)) return noop;
      if (p === 'getContext') return () => ({ fillRect: noop, drawImage: noop, fillStyle: '' });
      if (p === 'getAttribute') return () => null;
      if (p === 'value') return '';
      if (['width','height','naturalWidth','naturalHeight'].includes(p)) return 800;
      return makeEl();
    },
    set: () => true, apply: () => makeEl()
  });
}
const documentStub = {
  querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
  createElement: () => makeEl(), addEventListener: noop, readyState: 'complete', body: makeEl()
};
const Store = {
  LIBRARY: cfg.library,
  getBanquet: () => ({ name: '婚宴' }),
  getPackage: () => ({ name: 'A1' }),
  getLibDish: (id) => byId[id],
  resolvePackage: () => dishes
};
const sandbox = {
  document: documentStub, window: {}, console, Image: function(){return makeEl();},
  Blob: function(){return {};}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL: noop },
  localStorage: { getItem: () => null }, alert: noop, setTimeout: noop,
  Math, JSON, encodeURIComponent, decodeURIComponent, atob: s => s, isNaN,
  Store
};
sandbox.window = sandbox;

const code = fs.readFileSync('assets/custom.js', 'utf8');
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const CustomOrder = sandbox.window.CustomOrder;

CustomOrder.enter('wedding', 'A1');
CustomOrder._setTotal('2399');

function check(ver, k, label) {
  const svg = CustomOrder._buildSVG(ver, k);
  const PAGE_W = 210 * 5.90476 * k, PAGE_H = 297 * 5.90476 * k;
  const elemRe = /<(rect|image|text)\b([^>]*)>/g;
  let m, maxR = 0, maxB = 0, nImg = 0, nRect = 0, nText = 0;
  while ((m = elemRe.exec(svg))) {
    const tag = m[1], attrs = m[2];
    const gx = /x="(-?[\d.]+)"/.exec(attrs);
    const gy = /y="(-?[\d.]+)"/.exec(attrs);
    const gw = /width="(-?[\d.]+)"/.exec(attrs);
    const gh = /height="(-?[\d.]+)"/.exec(attrs);
    if (tag === 'image') nImg++;
    if (tag === 'rect') nRect++;
    if (tag === 'text') nText++;
    if (gx && gw) maxR = Math.max(maxR, parseFloat(gx[1]) + parseFloat(gw[1]));
    if (gy && gh) maxB = Math.max(maxB, parseFloat(gy[1]) + parseFloat(gh[1]));
  }
  const fits = maxR <= PAGE_W + 0.5 && maxB <= PAGE_H + 0.5;
  console.log(`[${label}] k=${k} page=${PAGE_W.toFixed(0)}x${PAGE_H.toFixed(0)} ` +
    `rects=${nRect} images=${nImg} texts=${nText} ` +
    `maxRight=${maxR.toFixed(0)} maxBottom=${maxB.toFixed(0)} fits=${fits}`);
  return fits;
}

let ok = true;
ok = check('thumb', 1, 'photo@std') && ok;
ok = check('thumb', 1.3, 'photo@big') && ok;
ok = check('thumb', 1.6, 'photo@xbig') && ok;
ok = check('plain', 1, 'plain@std') && ok;
console.log(ok ? 'ALL_FITS=true' : 'ALL_FITS=false');
