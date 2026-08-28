#!/usr/bin/env node
/**
 * export-menu-images.js —— 把菜品库里所有有图的菜品，导出成 jpg 文件
 *
 * 数据源：data/menu-config.json（云端同步进来的最新菜单）
 * 输出口：<项目根>/导出菜单/<中文>-<英文>.jpg
 *
 * 背景：菜品库的图片以 data:image/jpeg;base64,... 形式存在菜品对象里，
 *       业务上希望拿到物理文件方便给印刷/外发/排版师使用，所以写这个搬运脚本。
 *
 * 用法：
 *   node tools/export-menu-images.js            # 默认从 data/menu-config.json 导出到 ./导出菜单
 *   node tools/export-menu-images.js --src <p>  # 指定源 menu-config.json
 *   node tools/export-menu-images.js --out <p>  # 指定输出目录
 *   node tools/export-menu-images.js --dry      # 只列出将要导出的菜品，不写盘
 *
 * 命名规则：
 *   - 有图 + 有中英文：<cn>-<en>.jpg
 *   - 有图 + 缺英文：<cn>.jpg（en 缺失/空字符串时回退）
 *   - 文件名禁用字符（Windows 限制）：\/:*?"<>| 与控制字符，全部替成 _
 *   - 重名自动加 _2 / _3 ...（虽然当前菜库不会出现，防御性处理）
 *
 * ⚠️ 仅读了「菜品库 library」字段，不动 menu/套餐结构；
 *    与 publish-menu.js 互补（一个负责云端同步，一个负责图物导出）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SRC = path.join(ROOT, 'data', 'menu-config.json');
const DEFAULT_OUT = path.join(ROOT, '导出菜单');

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { src: null, out: null, dry: a.includes('--dry') };
  const i = a.indexOf('--src'); if (i >= 0 && a[i + 1]) out.src = a[i + 1];
  const j = a.indexOf('--out'); if (j >= 0 && a[j + 1]) out.out = a[j + 1];
  return out;
}

// Windows 文件名禁用字符：\/:*?"<>| + 控制字符
function sanitize(name) {
  return String(name || '').replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_').trim();
}

function baseNameOf(d) {
  const cn = sanitize(d.cn || '');
  const en = sanitize(d.en || '');
  if (cn && en) return `${cn}-${en}`;
  if (cn) return cn;
  if (en) return en;
  return d.id || 'unknown';
}

// 解析 data:image/jpeg;base64,xxxx
function decodeDataUrl(s) {
  if (typeof s !== 'string') return null;
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(s);
  if (!m) return null;
  const mime = m[1];
  const buf = Buffer.from(m[2], 'base64');
  return { mime, buf };
}

// 从 mime 推断扩展名（目前菜品库全部是 jpeg，留扩展能力）
function extOf(mime) {
  if (!mime) return 'jpg';
  const m = /\/(\w+)/.exec(mime);
  if (!m) return 'jpg';
  const sub = m[1].toLowerCase();
  if (sub === 'jpeg') return 'jpg';
  if (sub === 'svg+xml') return 'svg';
  return sub;
}

function main() {
  const args = parseArgs();
  const SRC = args.src || DEFAULT_SRC;
  const OUT = args.out || DEFAULT_OUT;

  console.log(`[源]    ${SRC}`);
  console.log(`[输出]  ${OUT}${args.dry ? '（dry-run）' : ''}`);

  let raw, data;
  try { raw = fs.readFileSync(SRC, 'utf8'); }
  catch (e) { console.error(`[失败] 读源失败：${e.message}`); process.exit(1); }
  try { data = JSON.parse(raw); }
  catch (e) { console.error(`[失败] JSON 解析失败：${e.message}`); process.exit(1); }

  const lib = Array.isArray(data.library) ? data.library : [];
  if (!lib.length) { console.error('[失败] library 为空'); process.exit(1); }

  // 不创建空目录前先建好
  if (!args.dry) fs.mkdirSync(OUT, { recursive: true });

  // 防重名：同 base 名 → _2, _3 ...
  const nameSeen = new Set();
  function uniqueName(base) {
    if (!nameSeen.has(base)) { nameSeen.add(base); return base; }
    let i = 2;
    while (nameSeen.has(`${base}_${i}`)) i++;
    const out = `${base}_${i}`;
    nameSeen.add(out);
    return out;
  }

  const stats = { total: lib.length, withImg: 0, exported: 0, skipped: 0, failed: 0 };
  const skipped = []; // 无图菜品
  const failed = [];  // 解码或写入失败

  for (const d of lib) {
    if (!d || !d.image) {
      stats.skipped++;
      skipped.push(`${d && d.id || '?'} | ${(d && d.cn) || '(无 cn)'} | ${(d && d.en) || ''}`);
      continue;
    }
    stats.withImg++;
    const decoded = decodeDataUrl(d.image);
    if (!decoded) { stats.failed++; failed.push(`${d.id} | ${d.cn} (image 字段非 dataURL)`); continue; }

    const base = uniqueName(baseNameOf(d));
    const ext = extOf(decoded.mime);
    const file = path.join(OUT, `${base}.${ext}`);

    if (args.dry) {
      console.log(`  将写：${file}（${(decoded.buf.length/1024).toFixed(1)} KB · ${decoded.mime}）`);
      stats.exported++;
      continue;
    }

    try {
      fs.writeFileSync(file, decoded.buf);
      stats.exported++;
      console.log(`  ✓ ${path.basename(file)}（${(decoded.buf.length/1024).toFixed(1)} KB）`);
    } catch (e) {
      stats.failed++;
      failed.push(`${d.id} | ${d.cn} | ${e.message}`);
    }
  }

  console.log('\n[汇总]');
  console.log(`  菜品库共 ${stats.total} 道`);
  console.log(`  带图 ${stats.withImg} 道  ·  导出 ${stats.exported} 个  ·  失败 ${stats.failed} 个  ·  无图 ${stats.skipped} 道`);

  if (failed.length) {
    console.log('\n[失败清单]');
    failed.forEach(l => console.log('  ✗ ' + l));
  }
  if (skipped.length) {
    console.log('\n[无图菜品，未导出]');
    skipped.forEach(l => console.log('  · ' + l));
  }

  process.exit(failed.length ? 1 : 0);
}

main();
