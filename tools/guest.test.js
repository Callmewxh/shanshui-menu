// 产品范围守卫：禁止已废弃的客人端、远程分享与自动导出深链回流。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = ['index.html', 'assets/app.js', 'assets/custom.js'];
let failures = 0;

function assert(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ FAIL: ' + msg); failures++; }
}

console.log('\n[内部工具产品范围守卫]');
const source = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]));
const runtime = files.map((file) => source[file]).join('\n');

assert(!/id=["']guestBar["']|id=["']guestDownload["']|guest-mode/.test(runtime), '不存在客人模式 UI 与样式钩子');
assert(!/function\s+(shareUrl|guestUrl|makeQRCanvas|burnQR)\b/.test(runtime), '不存在远程分享/二维码生成函数');
assert(!/[?&](guest|data|export)=/.test(runtime.replace(/旧的[^\n]*/g, '')), '运行代码不生成 guest/data/export 深链');
assert(!/assets\/qrcode\.js/.test(source['index.html']), '页面不加载二维码运行库');
assert(/function\s+handleDeepLink\s*\(/.test(source['assets/app.js']), '内部宴席/套餐快速定位仍保留');

console.log(failures === 0 ? '\n✅ 产品范围守卫通过' : '\n❌ 失败 ' + failures + ' 项');
process.exit(failures === 0 ? 0 : 1);
