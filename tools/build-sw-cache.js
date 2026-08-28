#!/usr/bin/env node
// 根据核心静态文件内容生成 Service Worker 缓存键，避免发布时手动递增版本号。
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SW_PATH = path.join(ROOT, 'sw.js');
const HASH_FILES = [
  'index.html',
  'assets/style.css',
  'assets/data.js',
  'assets/store.js',
  'assets/app.js',
  'assets/custom.js',
  'data/menu-config.json',
];

const imageDir = path.join(ROOT, 'data', 'img');
const imageFiles = fs.existsSync(imageDir)
  ? fs.readdirSync(imageDir).filter((file) => /\.(jpe?g|png|webp)$/i.test(file)).sort().map((file) => `data/img/${file}`)
  : [];
HASH_FILES.push(...imageFiles);

const hash = crypto.createHash('sha256');
for (const file of HASH_FILES) {
  hash.update(file);
  hash.update('\0');
  hash.update(fs.readFileSync(path.join(ROOT, file)));
  hash.update('\0');
}
const cacheName = `ss-menu-${hash.digest('hex').slice(0, 12)}`;
const source = fs.readFileSync(SW_PATH, 'utf8');
const generatedAssets = imageFiles.map((file) => `  './${file.replace(/\\/g, '/')}',`).join('\n');
let next = source.replace(
  /  \/\/ BEGIN GENERATED IMAGE ASSETS\r?\n[\s\S]*?  \/\/ END GENERATED IMAGE ASSETS/,
  `  // BEGIN GENERATED IMAGE ASSETS\n${generatedAssets}${generatedAssets ? '\n' : ''}  // END GENERATED IMAGE ASSETS`
);
next = next.replace(/const CACHE = 'ss-menu-[^']+';/, `const CACHE = '${cacheName}';`);

if (next === source && !source.includes(`const CACHE = '${cacheName}';`)) {
  console.error('无法定位 sw.js 中的 CACHE 常量');
  process.exit(1);
}

if (process.argv.includes('--check')) {
  if (source !== next) {
    console.error(`sw.js 缓存键已过期，应为 ${cacheName}；请运行 npm run build:cache`);
    process.exit(1);
  }
  console.log(`✓ Service Worker 缓存键有效：${cacheName}`);
} else {
  fs.writeFileSync(SW_PATH, next);
  console.log(`✓ Service Worker 缓存键已更新：${cacheName}`);
}
