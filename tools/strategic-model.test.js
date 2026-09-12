const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/menu-config.json'), 'utf8'));
const app = fs.readFileSync(path.join(ROOT, 'assets/app.js'), 'utf8');
const store = fs.readFileSync(path.join(ROOT, 'assets/store.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const custom = fs.readFileSync(path.join(ROOT, 'assets/custom.js'), 'utf8');
let failures = 0;
const check = (ok, msg) => ok ? console.log('  ✓ ' + msg) : (console.error('  ✗ FAIL: ' + msg), failures++);

console.log('\n[战略数据模型守卫]');
check(data.schemaVersion === 3, '配置 schemaVersion=3');
check(Array.isArray(data.banquets) && data.banquets.length > 0, '宴席类型由配置提供');
check(Array.isArray(data.categories) && data.categories.length > 0, '菜品分类由配置提供');
check(data.tenant && data.tenant.id && data.tenant.name, 'tenant/门店身份完整');
check(Number.isFinite(data.revision) && Number.isFinite(data.syncedRevision), '配置包含发布冲突版本字段');
check(data.banquets.every((item) => data.menu[item.id] && data.menu[item.id].name === item.name), '菜单对象与宴席目录使用同一中文名称');
check(data.banquets.every((item) => /[\u3400-\u9fff]/.test(item.name) && !/^(baby|housewarming|engagement|yearEnd)$/i.test(item.name)), '宴席显示名不泄漏英文技术 ID');
check(/get BANQUETS\(\) \{ return STATE\.banquets; \}/.test(store), '运行时宴席不再读取固定常量');
check(/get CATEGORIES\(\) \{ return STATE\.categories; \}/.test(store), '运行时分类不再读取固定常量');
check(/remote\.revision/.test(store) && /syncedRevision/.test(store), 'WebDAV 发布包含覆盖冲突检测');
check(/id="setBanquets"/.test(html) && /id="setCategories"/.test(html) && /setCatalogConfig/.test(store), '运营可在设置中维护宴席与分类');
check(!/ePitch|eTalkingPoint|m-pitch|m-talking-point/.test(html + app), '展示与编辑界面不含弹药库/推广模块');
check(/settings-nav-item/.test(html) && /settings-save-state/.test(html), '设置界面具备分类导航与保存状态反馈');
check(/settings-export/.test(html) && /settings-advanced/.test(html), '导出与危险操作已拆为独立分类');

console.log('\n[导出物数据驱动守卫]');
check(/function cats\(\)/.test(custom) && !/var CATS =/.test(custom), '导出物分类数据驱动（不再写死 CATS）');
check(/getBrandName\(\)/.test(custom) && !/esc2?\('山水S酒店'\)/.test(custom), '导出物品牌名数据驱动（不再写死）');
check(/active < 3/.test(custom) && /短生命周期副本/.test(custom) && /pages\.length !== pkgs\.length/.test(custom), '整份导出限制图片并发、逐套餐释放并校验页数');

console.log(failures ? `\n❌ 失败 ${failures} 项` : '\n✅ 战略数据模型守卫通过');
process.exit(failures ? 1 : 0);
