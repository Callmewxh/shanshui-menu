#!/usr/bin/env node
/**
 * publish-menu.js —— 把「导出配置」下载的菜单 JSON 同步进仓库的 data/menu-config.json
 *
 * 背景：菜单数据存在展示设备的浏览器 localStorage 里，磁盘上读不到。
 * 唯一的搬运通道是 App 设置里的「导出配置」（下载 menu-config.json）。
 * 本脚本负责：自动找到那份最新导出 → 校验结构 → 汇报差异 → 覆盖 data/menu-config.json。
 * 之后 git push + 重新部署，其它设备「从云端拉取菜单」拿到的就是这一份。
 *
 * 用法：
 *   node tools/publish-menu.js              自动扫描候选目录，取最新的一份
 *   node tools/publish-menu.js --src <path> 指定源文件
 *   node tools/publish-menu.js --dry        只比对不写入
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { externalizeImages } = require('./lib/externalize-images');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'data', 'menu-config.json');
const HOME = os.homedir();

// 候选目录：按常见程度排列，全部扫一遍取 mtime 最新
const SEARCH_DIRS = [
  'D:\\Downloads',
  path.join(HOME, 'Downloads'),
  path.join(HOME, 'Desktop'),
  path.join(HOME, '下载'),
  ROOT,
  path.join(HOME, 'Documents'),
];

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { dry: a.includes('--dry'), force: a.includes('--force'), src: null };
  const i = a.indexOf('--src');
  if (i >= 0 && a[i + 1]) out.src = a[i + 1];
  return out;
}

// 在目录里找 menu-config*.json，最多下钻 2 层（覆盖微信接收文件那种 msg/file/2026-08 结构太深，只在显式目录里找）
function collect(dir, depth = 0, acc = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return acc; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isFile() && /^menu-config.*\.json$/i.test(e.name)) {
      try { acc.push({ path: p, mtime: fs.statSync(p).mtimeMs }); } catch (_) {}
    } else if (e.isDirectory() && depth < 1 && !e.name.startsWith('.') && e.name !== 'node_modules') {
      collect(p, depth + 1, acc);
    }
  }
  return acc;
}

function findLatest() {
  const all = [];
  for (const d of SEARCH_DIRS) collect(d, 0, all);
  // 排除目标文件自身
  const cand = all.filter((f) => path.resolve(f.path) !== path.resolve(TARGET));
  if (!cand.length) return null;
  cand.sort((x, y) => y.mtime - x.mtime);
  return cand[0];
}

// 结构校验：必须是 App exportConfig 的产物 { menu, library }（可选附带顶层 logo / logoCrop 品牌徽标）
function validate(data) {
  if (!data || typeof data !== 'object') return '不是合法的 JSON 对象';
  if (!Array.isArray(data.library)) return '缺少 library 数组';
  if (!data.menu || typeof data.menu !== 'object') return '缺少 menu 对象';
  if (!data.library.length) return 'library 为空，拒绝发布（避免误清空线上菜单）';
  const hasPkg = Object.values(data.menu).some(
    (b) => b && Array.isArray(b.packages) && b.packages.length
  );
  if (!hasPkg) return 'menu 里没有任何套餐，拒绝发布';
  return null;
}

function summarize(data) {
  const lib = data.library || [];
  const banquets = [];
  for (const [k, b] of Object.entries(data.menu || {})) {
    if (!b || !Array.isArray(b.packages)) continue;
    banquets.push({
      id: k,
      name: b.name || k,
      packages: b.packages.map((p) => ({ id: p.id, dishes: (p.dishes || []).length })),
    });
  }
  return {
    libCount: lib.length,
    imgCount: lib.filter((d) => d && d.image).length,
    hasLogo: !!(typeof data.logo === 'string' && data.logo),
    banquets,
    pkgCount: banquets.reduce((n, b) => n + b.packages.length, 0),
  };
}

function fmtSummary(s) {
  const lines = [
    `  菜品库 ${s.libCount} 道（含图片 ${s.imgCount} 道）`,
    `  品牌LOGO：${s.hasLogo ? '有（将随菜单一起搬运）' : '无'}`,
    `  宴席 ${s.banquets.length} 类 / 套餐 ${s.pkgCount} 个`,
  ];
  for (const b of s.banquets) {
    lines.push(`    · ${b.name}：${b.packages.map((p) => `${p.id}(${p.dishes}道)`).join(' ') || '无套餐'}`);
  }
  return lines.join('\n');
}

function main() {
  const args = parseArgs();

  let srcPath = args.src;
  if (!srcPath) {
    const latest = findLatest();
    if (!latest) {
      console.error('[跳过] 没找到任何 menu-config*.json 导出文件。');
      console.error('       请先在主编辑设备打开 App → 设置 → 导出配置，再重试。');
      console.error('       扫描过的目录：\n         ' + SEARCH_DIRS.join('\n         '));
      process.exit(2);
    }
    srcPath = latest.path;
    console.log(`[源] ${srcPath}`);
    console.log(`     导出时间 ${new Date(latest.mtime).toLocaleString('zh-CN')}`);
  } else {
    console.log(`[源] ${srcPath}（手动指定）`);
  }

  let raw;
  try { raw = fs.readFileSync(srcPath, 'utf8'); } catch (e) {
    console.error(`[失败] 读不了源文件：${e.message}`); process.exit(1);
  }

  let data;
  try { data = JSON.parse(raw); } catch (e) {
    console.error(`[失败] JSON 解析出错：${e.message}`); process.exit(1);
  }

  const err = validate(data);
  if (err) { console.error(`[失败] 校验不通过：${err}`); process.exit(1); }

  // 发布时自动把 App 导出的 base64 菜图落到 data/img；JSON 只保存同源路径。
  // dry-run 只模拟字段变化，不写图片文件。
  const imageResult = externalizeImages(data, ROOT, { dry: args.dry });
  if (imageResult.extracted) {
    console.log(`[图片] 外置 ${imageResult.extracted} 张（${(imageResult.bytes / 1048576).toFixed(2)} MB）到 data/img/`);
  }

  const next = summarize(data);
  console.log('\n[新版本]');
  console.log(fmtSummary(next));

  let prevRaw = null;
  try { prevRaw = fs.readFileSync(TARGET, 'utf8'); } catch (_) {}
  if (prevRaw) {
    try {
      const prevData = JSON.parse(prevRaw);
      const prev = summarize(prevData);
      console.log('\n[线上当前]');
      console.log(fmtSummary(prev));
      const d = (a, b) => (b - a >= 0 ? `+${b - a}` : `${b - a}`);
      console.log(
        `\n[差异] 菜品 ${d(prev.libCount, next.libCount)} · 图片 ${d(prev.imgCount, next.imgCount)} · 套餐 ${d(prev.pkgCount, next.pkgCount)}`
      );
      const sameTenant = !prevData.tenant || !data.tenant || prevData.tenant.id === data.tenant.id;
      if (!args.force && sameTenant && (+prevData.revision || 0) > (+data.syncedRevision || 0)) {
        console.error(`\n[冲突] 仓库版本 r${prevData.revision} 新于本设备上次同步版本 r${data.syncedRevision || 0}。`);
        console.error('       请先导入仓库最新配置后合并修改；确认覆盖可显式使用 --force。');
        process.exit(4);
      }
    } catch (_) { console.log('\n[线上当前] 解析失败，将直接覆盖'); }
  } else {
    console.log('\n[线上当前] 文件不存在，将新建');
  }

  // 与 App exportConfig 保持一致的序列化方式（2 空格缩进），并保留顶层 logo / logoCrop
  // （品牌徽标随菜单一起搬运，否则导出带 logo 也会在搬运环节被丢掉）
  const outObj = JSON.parse(JSON.stringify(data));
  if (typeof data.logo === 'string' && data.logo) {
    outObj.logo = data.logo;
    outObj.logoCrop = data.logoCrop || null;
  }
  const out = JSON.stringify(outObj, null, 2);

  if (prevRaw !== null && out === prevRaw) {
    console.log('\n[跳过] 内容与线上完全一致，无需更新。');
    process.exit(3);
  }

  if (args.dry) { console.log('\n[dry-run] 未写入。'); process.exit(0); }

  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, out, 'utf8');
  console.log(`\n[完成] 已写入 ${TARGET}（${(out.length / 1048576).toFixed(2)} MB）`);
  console.log('       接下来：git add -A && git commit && git push，然后重新部署 CloudStudio。');
}

main();
