const fs = require('fs');
const path = require('path');
const { JSDOM } = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true, beforeParse(w) {
  w.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  w.scrollTo = () => {};
  w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
  w.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
  w.alert = () => {}; w.confirm = () => true;
}});
const { window } = dom;
['assets/data.js','assets/store.js','assets/app.js','assets/custom.js'].forEach(f => {
  const s = window.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(root, f), 'utf8');
  window.document.body.appendChild(s);
});
setTimeout(() => {
  window.CustomOrder.enter('wedding', 'B');
  window.CustomOrder._setTotal('2899');
  const draft = window.CustomOrder._getDraft();
  draft.client = '贵宾'; draft.type = '婚宴';
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'data/menu-config.json'), 'utf8'));
  const byId = Object.fromEntries(cfg.library.map(d => [d.id, d]));
  draft.lines.forEach(l => {
    const d = byId[l.libId];
    if (d) { l.image = d.image || null; l.crop = d.crop || null; l._thumb = d.image || null; }
  });
  fs.writeFileSync(path.join(root, 'prototype/latest-photo.svg'), window.CustomOrder._buildSVG('thumb', 1));
  fs.writeFileSync(path.join(root, 'prototype/latest-plain.svg'), window.CustomOrder._buildSVG('plain', 1));
  console.log('latest previews written');
}, 100);
