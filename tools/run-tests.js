#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const tests = [
  'tools/build-sw-cache.js --check',
  'tools/data-images.test.js',
  'tools/strategic-model.test.js',
  'tools/copy-pkg.test.js',
  'tools/custom-order.test.js',
  'tools/logo-config.test.js',
  'tools/menu-export.test.js',
  'tools/guest.test.js',
  'tools/settings-webdav-smoke.js',
  'tools/theme-smoke.js',
];

for (const entry of tests) {
  const [script, ...args] = entry.split(' ');
  console.log(`\n=== ${entry} ===`);
  const result = spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log('\n✅ 全部测试通过');
