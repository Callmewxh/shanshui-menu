// 发布数据守卫：JSON 不得重新内嵌菜图，且所有图片路径必须存在。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const configPath = path.join(ROOT, 'data', 'menu-config.json');
const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let failures = 0;
const assert = (ok, msg) => ok ? console.log('  ✓ ' + msg) : (console.error('  ✗ FAIL: ' + msg), failures++);

console.log('\n[菜品图片外置守卫]');
const withImages = data.library.filter((dish) => dish && dish.image);
const embedded = withImages.filter((dish) => /^data:image\//.test(dish.image));
const missing = withImages.filter((dish) => {
  if (!/^\.\/data\/img\//.test(dish.image)) return true;
  return !fs.existsSync(path.join(ROOT, dish.image.slice(2)));
});

assert(embedded.length === 0, 'menu-config.json 不含 base64 菜图');
assert(missing.length === 0, '所有菜图路径均指向存在的 data/img 文件');
assert(fs.statSync(configPath).size < 1024 * 1024, 'menu-config.json 小于 1 MB');
assert(withImages.length > 0, `菜图引用有效（${withImages.length} 张）`);

console.log(failures ? `\n❌ 失败 ${failures} 项` : '\n✅ 菜品图片外置守卫通过');
process.exit(failures ? 1 : 0);
