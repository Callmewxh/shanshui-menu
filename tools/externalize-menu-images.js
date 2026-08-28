#!/usr/bin/env node
// 将 menu-config.json 内的 base64 菜图提取到 data/img，JSON 仅保留同源路径。
const fs = require('fs');
const path = require('path');
const { externalizeImages } = require('./lib/externalize-images');

const ROOT = path.resolve(__dirname, '..');
const target = path.join(ROOT, 'data', 'menu-config.json');
const dry = process.argv.includes('--dry');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const result = externalizeImages(data, ROOT, { dry });

if (!dry && result.extracted) fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8');
console.log(`${dry ? '[dry-run] ' : ''}外置 ${result.extracted} 张图片，释放 JSON ${(result.bytes / 1048576).toFixed(2)} MB`);
