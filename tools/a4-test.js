#!/usr/bin/env node
/**
 * tools/a4-test.js —— 校验 A4 导出版式是否能装入单页，并生成预览 SVG。
 * 版式逻辑与 assets/custom.js 的 buildSVG 保持一致（同一套 mm→px 计算），
 * 此处仅用真实菜品数据跑一遍，打印尺寸诊断并输出 prototype/a4-export-test.svg 供预览。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'menu-config.json'), 'utf8'));
const byId = Object.fromEntries(cfg.library.map((x) => [x.id, x]));

const CATS = ['凉菜', '主菜', '主食点心'];
const CAT_NUM = { '凉菜': '壹', '主菜': '贰', '主食点心': '叁' };

// —— 取一个真实套餐（婚宴 A1）作为样本 ——
const pkg = cfg.menu.wedding.packages.find((p) => p.id === 'A1');
const notes = { lib05: '可换清蒸 / 豉汁', lib08: '蒜蓉另上', lib15: '可做热 / 冷', lib19: '忌口请提前告知' };
const SAMPLE = {
  client: '张先生',
  type: '婚宴·百年好合',
  total: '2399',
  lines: pkg.dishes
    .map((id) => byId[id])
    .filter(Boolean)
    .map((d) => ({ cn: (pkg.nameOverrides && pkg.nameOverrides[d.id]) || d.cn, cat: d.cat, image: d.image || null, crop: d.crop || null, note: notes[d.id] || '' })),
};

// ============ 版式核心（与 custom.js buildSVG 同源）============
function composeA4(opts) {
  const k = opts.k || 1;
  const MM = 5.90476; // px per mm @ k=1
  const m = (mm) => +(mm * MM * k).toFixed(2);
  const PAGE_W = m(210), PAGE_H = m(297);

  const C = {
    bg: '#F5F0E6', surface: '#FFFFFF', ink: '#3A2E26', muted: '#A88A5E',
    primary: '#B23A2E', gold: '#C2A15A', goldDeep: '#8A6D1F', goldHair: '#D8C7A6', line: '#ECE3D2',
  };
  const FS = '&quot;Noto Serif SC&quot;, &quot;Songti SC&quot;, &quot;STSong&quot;, &quot;SimSun&quot;, serif';
  const FK = '&quot;KaiTi&quot;, &quot;STKaiti&quot;, &quot;楷体&quot;, serif';
  const FN = '&quot;PingFang SC&quot;, &quot;Microsoft YaHei&quot;, sans-serif';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // 裁剪背景（与菜品库一致）：返回 style 串（用于 SVG 内置 image 的 preserveAspectRatio 等价计算由调用方处理）
  function cropRect(d, boxW, boxH) {
    // 返回 drawImage 等价的 SVG image 参数：用 background-size/position 反推
    const c = d && d.crop ? d.crop : null;
    if (c && typeof c.w === 'number') {
      const w = clamp(c.w, 0.05, 1), h = clamp((typeof c.h === 'number' ? c.h : w * 0.75), 0.05, 1);
      const x = clamp(c.x, 0, 1 - w), y = clamp(c.y, 0, 1 - h);
      const sizeW = (100 / w).toFixed(3), sizeH = (100 / h).toFixed(3);
      const posX = (1 - w < 1e-4) ? '0' : (x / (1 - w) * 100).toFixed(2);
      const posY = (1 - h < 1e-4) ? '0' : (y / (1 - h) * 100).toFixed(2);
      return { size: sizeW + '% ' + sizeH + '%', pos: posX + '% ' + posY + '%' };
    }
    const y = (c && typeof c.y === 'number') ? c.y : 50;
    return { size: 'cover', pos: '50% ' + y + '%' };
  }

  const client = (opts.client || '').trim() || '贵宾';
  const type = (opts.type || '').trim() || '宴席';
  const total = (opts.total || '').toString().trim();
  const totalStr = total ? '¥' + total : '—';

  const SX = 16;                       // 左右页边距 mm
  const contentL = SX, contentR = 210 - SX;
  const contentW = contentR - contentL; // 178
  const PAD_T = 11;                    // 顶部内容区距顶 mm
  const topBandH = 5;

  // —— 页脚位置（固定贴底）——
  const footerY = 297 - 12 - 8;        // 距底 12 留白 + 区块 8
  const secTop = PAD_T + 2 + 16 + 20 + 6; // 标题区 + info + 间距
  const secBottom = footerY - 6;
  const secH = secBottom - secTop;     // 分类段可用高度 mm

  // —— 分类段计算 ——
  const segs = CATS.map((cat) => {
    const rows = opts.lines.filter((l) => l.cat === cat);
    return { cat, rows };
  }).filter((s) => s.rows.length);

  const nCats = segs.length;
  const isPhoto = opts.ver !== 'plain';

  // 列数 / 行数
  const cols = isPhoto ? 4 : 1;
  let rowsTotal = 0;
  segs.forEach((s) => { rowsTotal += Math.ceil(s.rows.length / cols); });

  // 卡片自然尺寸（mm，仅带图版用于自适应缩放）
  const catHeadH = 9;
  const gapRow = 3;
  let scale = 1, cardW, thumbHnat, metaHnat, cardHnat, naturalH = 0;
  if (isPhoto) {
    cardW = (contentW - (cols - 1) * 4) / cols;
    thumbHnat = (cardW - 2 * 1.2) * 0.75;
    metaHnat = 10;
    cardHnat = 1.2 * 2 + thumbHnat + metaHnat;
    naturalH = nCats * catHeadH + rowsTotal * (cardHnat + gapRow) - gapRow;
    scale = naturalH > secH ? clamp(secH / naturalH, 0.5, 1) : 1;
  }
  const cardH = (cardHnat || 0) * scale;
  const thumbH = (thumbHnat || 0) * scale;
  const metaH = (metaHnat || 0) * scale;
  const gapRowS = gapRow * scale;
  const catHeadHS = catHeadH * scale;
  const fScale = scale;

  // —— 组装 SVG ——
  const parts = [];
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + PAGE_W + '" height="' + PAGE_H + '" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '">');
  parts.push('<rect width="' + PAGE_W + '" height="' + PAGE_H + '" fill="' + C.bg + '"/>');
  // 外框
  parts.push('<rect x="' + m(8) + '" y="' + m(8) + '" width="' + (PAGE_W - 2 * m(8)) + '" height="' + (PAGE_H - 2 * m(8)) + '" rx="' + m(4) + '" fill="none" stroke="' + C.goldHair + '" stroke-width="' + m(0.4) + '"/>');
  // 顶条
  parts.push('<rect x="0" y="0" width="' + PAGE_W + '" height="' + m(topBandH) + '" fill="' + C.primary + '"/>');
  parts.push('<rect x="0" y="' + m(topBandH) + '" width="' + PAGE_W + '" height="' + m(0.8) + '" fill="' + C.gold + '"/>');

  // 抬头
  const hy = PAD_T + 2;
  // 品牌标
  parts.push('<rect x="' + m(SX) + '" y="' + m(hy) + '" width="' + m(13) + '" height="' + m(13) + '" rx="' + m(3) + '" fill="' + C.primary + '"/>');
  parts.push('<text x="' + m(SX + 6.5) + '" y="' + m(hy + 9.5) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(8) + '" font-weight="700" fill="#fff">S</text>');
  parts.push('<text x="' + m(SX + 17) + '" y="' + m(hy + 9) + '" font-family="' + FK + '" font-size="' + m(7.4) + '" font-weight="700" fill="' + C.primary + '" letter-spacing="' + m(0.8) + '">山水S酒店</text>');
  parts.push('<text x="' + m(SX + 17) + '" y="' + m(hy + 13) + '" font-family="' + FN + '" font-size="' + m(2.8) + '" fill="' + C.muted + '" letter-spacing="' + m(1.6) + '">SHANSHUI HOTEL</text>');
  parts.push('<text x="' + m(contentR) + '" y="' + m(hy + 9) + '" text-anchor="end" font-family="' + FK + '" font-size="' + m(9.5) + '" font-weight="700" fill="' + C.ink + '" letter-spacing="' + m(1.6) + '">宴席定制单</text>');
  parts.push('<text x="' + m(contentR) + '" y="' + m(hy + 13.5) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(2.8) + '" fill="' + C.goldDeep + '" letter-spacing="' + m(1.8) + '">BANQUET CUSTOM ORDER</text>');

  // 信息条
  const iy = hy + 16;
  const infoH = 20;
  parts.push('<rect x="' + m(SX) + '" y="' + m(iy) + '" width="' + m(contentW) + '" height="' + m(infoH) + '" rx="' + m(2.6) + '" fill="#FFFDF7" stroke="' + C.line + '" stroke-width="' + m(0.4) + '"/>');
  parts.push('<text x="' + m(SX + 5) + '" y="' + m(iy + 8) + '" font-family="' + FS + '" font-size="' + m(6.2) + '" font-weight="700" fill="' + C.ink + '">' + esc(client) + '</text>');
  parts.push('<text x="' + m(SX + 5) + '" y="' + m(iy + 14.5) + '" font-family="' + FN + '" font-size="' + m(3.2) + '" fill="' + C.primary + '" letter-spacing="' + m(0.3) + '">' + esc(type) + '</text>');
  const pw = 42;
  const px = contentR - pw;
  parts.push('<rect x="' + m(px) + '" y="' + m(iy) + '" width="' + m(pw) + '" height="' + m(infoH) + '" rx="' + m(2.6) + '" fill="' + C.primary + '"/>');
  parts.push('<text x="' + m(px + pw / 2) + '" y="' + m(iy + 6) + '" text-anchor="middle" font-family="' + FN + '" font-size="' + m(2.6) + '" fill="#fff" letter-spacing="' + m(1) + '">本单总价</text>');
  parts.push('<text x="' + m(px + pw / 2) + '" y="' + m(iy + 15) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(9) + '" font-weight="700" fill="#fff">' + esc(totalStr) + '<tspan font-size="' + m(3) + '" font-weight="400" dx="' + m(1) + '">元/桌</tspan></text>');

  // 分类段
  let y = secTop;
  segs.forEach((s) => {
    // 段标题
    parts.push('<rect x="' + m(SX) + '" y="' + m(y + 3) + '" width="' + m(3) + '" height="' + m(3) + '" fill="' + C.primary + '" transform="rotate(45 ' + m(SX + 1.5) + ' ' + m(y + 4.5) + ')"/>');
    parts.push('<text x="' + m(SX + 7) + '" y="' + m(y + 6.5) + '" font-family="' + FK + '" font-size="' + m(6 * fScale) + '" font-weight="700" fill="' + C.primary + '" letter-spacing="' + m(1) + '">' + CAT_NUM[s.cat] + ' · ' + esc(s.cat) + '</text>');
    parts.push('<text x="' + m(SX + 38) + '" y="' + m(y + 6.5) + '" font-family="' + FN + '" font-size="' + m(2.8 * fScale) + '" fill="' + C.muted + '">共 ' + s.rows.length + ' 道</text>');
    parts.push('<rect x="' + m(SX + 55) + '" y="' + m(y + 5.5) + '" width="' + m(contentW - 55) + '" height="' + m(0.5) + '" fill="' + C.gold + '"/>');
    y += catHeadHS + 2;

    if (isPhoto) {
      const gapCol = 4;
      const cw = (contentW - (cols - 1) * gapCol) / cols;
      const thumbW = cw - 2 * 1.2;
      s.rows.forEach((l, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const cx = SX + col * (cw + gapCol);
        const cy = y + row * (cardH + gapRowS);
        // 卡片
        parts.push('<rect x="' + m(cx) + '" y="' + m(cy) + '" width="' + m(cw) + '" height="' + m(cardH) + '" rx="' + m(3) + '" fill="' + C.surface + '" stroke="' + C.goldHair + '" stroke-width="' + m(0.4) + '"/>');
        // 缩略图（用 crop 等价绘制：先铺底，再用 clip + image 按 size/pos 定位）
        const tx = cx + 1.2, ty = cy + 1.2, tw = thumbW, th = thumbH;
        const clipId = 'c' + s.cat.replace(/[^a-z0-9]/gi, '') + i;
        parts.push('<clipPath id="' + clipId + '"><rect x="' + m(tx) + '" y="' + m(ty) + '" width="' + m(tw) + '" height="' + m(th) + '" rx="' + m(2) + '"/></clipPath>');
        parts.push('<rect x="' + m(tx) + '" y="' + m(ty) + '" width="' + m(tw) + '" height="' + m(th) + '" rx="' + m(2) + '" fill="#EDE4D3"/>');
        const src = l._thumb || l.image;
        if (src) {
          const cr = cropRect(l, tw, th);
          // 用嵌套 svg + image + background 模拟：SVG <image> 不支持 background，故用 preserveAspectRatio + 计算后的 transform 近似 cover
          // 简化：用 <image> + preserveAspectRatio="xMidYMid slice" 居中裁切（与旧逻辑一致，位置由裁切算法另处理见 app）
          parts.push('<g clip-path="url(#' + clipId + ')"><image href="' + src + '" xlink:href="' + src + '" x="' + m(tx) + '" y="' + m(ty) + '" width="' + m(tw) + '" height="' + m(th) + '" preserveAspectRatio="xMidYMid slice"/></g>');
        }
        // 菜名 + 备注
        const maxChars = Math.floor((cw - 4) / 3); // ~13mm /3mm
        let cn = l.cn || '未命名菜品';
        if (cn.length > maxChars) cn = cn.slice(0, maxChars - 1) + '…';
        const metaY = cy + 1.2 + thumbH + metaH * 0.5;
        parts.push('<text x="' + m(cx + 2) + '" y="' + m(metaY) + '" font-family="' + FS + '" font-size="' + m(3.3 * fScale) + '" font-weight="700" fill="' + C.ink + '" text-anchor="middle">' + esc(cn) + '</text>');
        if (l.note) {
          let nt = l.note; if (nt.length > maxChars) nt = nt.slice(0, maxChars - 1) + '…';
          parts.push('<text x="' + m(cx + 2) + '" y="' + m(metaY + 4 * fScale) + '" font-family="' + FN + '" font-size="' + m(2.6 * fScale) + '" fill="' + C.primary + '" text-anchor="middle">' + esc(nt) + '</text>');
        }
      });
      const rowN = Math.ceil(s.rows.length / cols);
      y += rowN * (cardH + gapRowS);
    } else {
      // 无图清单
      const rowH = 8;
      s.rows.forEach((l, i) => {
        const cy = y + i * rowH;
        parts.push('<text x="' + m(SX) + '" y="' + m(cy + 5) + '" font-family="' + FS + '" font-size="' + m(3.6) + '" fill="' + C.goldDeep + '">' + String(i + 1).padStart(2, '0') + '</text>');
        parts.push('<text x="' + m(SX + 10) + '" y="' + m(cy + 5) + '" font-family="' + FS + '" font-size="' + m(4.6) + '" font-weight="700" fill="' + C.ink + '">' + esc(l.cn || '未命名菜品') + '</text>');
        if (l.note) {
          parts.push('<text x="' + m(contentR) + '" y="' + m(cy + 5) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(3) + '" fill="' + C.primary + '">（' + esc(l.note) + '）</text>');
        }
        if (i < s.rows.length - 1) parts.push('<line x1="' + m(SX) + '" y1="' + m(cy + rowH - 2) + '" x2="' + m(contentR) + '" y2="' + m(cy + rowH - 2) + '" stroke="' + C.line + '" stroke-width="' + m(0.35) + '"/>');
      });
      y += s.rows.length * rowH;
    }
    y += 4; // 段间距
  });

  // 页脚
  const fy = footerY;
  parts.push('<line x1="' + m(SX) + '" y1="' + m(fy) + '" x2="' + m(70) + '" y2="' + m(fy) + '" stroke="' + C.gold + '" stroke-width="' + m(0.5) + '"/>');
  parts.push('<line x1="' + m(140) + '" y1="' + m(fy) + '" x2="' + m(contentR) + '" y2="' + m(fy) + '" stroke="' + C.gold + '" stroke-width="' + m(0.5) + '"/>');
  parts.push('<rect x="' + (PAGE_W / 2 - m(1.2)) + '" y="' + m(fy - 2.4) + '" width="' + m(2.4) + '" height="' + m(2.4) + '" fill="' + C.gold + '" transform="rotate(45 ' + (PAGE_W / 2) + ' ' + m(fy - 1.2) + ')"/>');
  parts.push('<text x="' + (PAGE_W / 2) + '" y="' + m(fy + 4) + '" text-anchor="middle" font-family="' + FN + '" font-size="' + m(2.9) + '" fill="' + C.muted + '" letter-spacing="' + m(0.6) + '">本单仅作报价参考，菜品请以实物为主</text>');

  parts.push('</svg>');
  return { svg: parts.join(''), diag: { naturalH, secH, scale, cardH, rowsTotal, secBottom, totalBottom: y } };
}

// —— 跑样本 ——
['thumb', 'plain'].forEach((ver) => {
  const r = composeA4({ ...SAMPLE, ver, k: 1 });
  const fits = r.diag.totalBottom <= 297 + 0.5;
  console.log('[' + ver + '] totalBottomMM=' + r.diag.totalBottom.toFixed(1) + ' secH=' + r.diag.secH.toFixed(1) + ' scale=' + r.diag.scale.toFixed(3) + ' rows=' + r.diag.rowsTotal + ' fits(A4 297)=' + fits);
  const out = path.join(ROOT, 'prototype', 'a4-export-test-' + ver + '.svg');
  fs.writeFileSync(out, r.svg, 'utf8');
  console.log('  written', out, (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
});
