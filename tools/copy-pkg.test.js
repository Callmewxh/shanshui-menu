// 复制套餐到其他宴席 — 数据层验证（T2）
// 覆盖核心正确性：buildPackageCopy 深拷贝/两形态 nameOverrides、dishes 引用、price/demo，
// 以及 Store.addPackage 跨宴席写入 + 编号冲突拦截。
// 运行：node tools/copy-pkg.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- fixtures ----------
const BANQUETS = [
  { id: 'baby', name: '宝宝宴' },
  { id: 'housewarming', name: '乔迁宴' },
  { id: 'wedding', name: '婚宴' },
];
const MENU_DATA = {
  baby: {
    name: '宝宝宴',
    packages: [
      {
        id: 'A', name: 'A菜单', price: 1888, demo: true,
        dishes: ['d1', 'd2'],
        nameOverrides: { d1: { cn: '宝宝专属名', en: 'Baby' }, d2: '老名' },
      },
    ],
  },
  housewarming: { name: '乔迁宴', packages: [] },
  wedding: {
    name: '婚宴',
    packages: [{ id: 'B', name: '佳偶天成', price: 2888, demo: false, dishes: ['d3'], nameOverrides: {} }],
  },
};
const LIBRARY_SEED = [];

// ---------- 构建 sandbox，执行 store.js ----------
const storePath = path.join(__dirname, '..', 'assets', 'store.js');
const storeSrc = fs.readFileSync(storePath, 'utf8');

const _ls = { ss_menu_v1: JSON.stringify({ library: LIBRARY_SEED, menu: MENU_DATA }) };
const sandbox = {
  console,
  localStorage: {
    getItem: (k) => (k in _ls ? _ls[k] : null),
    setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; },
  },
  BANQUETS,
  MENU_DATA,
  LIBRARY_SEED,
};
vm.createContext(sandbox);
// store.js 顶层 `const Store = (...)()` 不挂到 contextified 对象，包一层取返回值
const Store = vm.runInContext('(function(){ ' + storeSrc + '\n; return Store; })()', sandbox);

// ---------- 断言 ----------
let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL: ' + msg); failures++; }
  else { console.log('  ✓ ' + msg); }
}

(async () => {
  console.log('复制套餐到其他宴席 — 数据层验证');
  const src = Store.getPackage('baby', 'A');
  assert(!!src, '源套餐 baby·A 存在');

  // 1. buildPackageCopy：基础字段 + 引用 + 深拷贝 + 两形态
  const copy = Store.buildPackageCopy(src, '乔迁·A菜单', 'A');
  assert(copy.id === 'A', 'buildPackageCopy 写入新编号');
  assert(copy.name === '乔迁·A菜单', 'buildPackageCopy 写入新名字');
  assert(copy.price === 1888, 'price 完整复制');
  assert(copy.demo === true, 'demo 完整复制');
  assert(
    copy.dishes.length === 2 && copy.dishes[0] === 'd1' && copy.dishes[1] === 'd2',
    'dishes 逐项 === 源（id 引用，不复制菜品库主数据）'
  );
  assert(copy.dishes !== src.dishes, 'dishes 是新数组（slice，非同一引用）');
  assert(copy.nameOverrides.d1 && copy.nameOverrides.d1.cn === '宝宝专属名', 'object 形态 nameOverride 保留');
  assert(copy.nameOverrides.d2 === '老名', 'string 形态 nameOverride 保留（兼容旧数据）');

  // 2. 深拷贝独立性：改副本不影响源
  copy.nameOverrides.d1.cn = '改了';
  assert(src.nameOverrides.d1.cn === '宝宝专属名', '改副本 nameOverride 不影响源（深拷贝）');
  copy.dishes.push('dX');
  assert(src.dishes.length === 2, '改副本 dishes 不影响源（独立数组）');

  // 3. 跨宴席写入
  const before = Store.getBanquet('housewarming').packages.length;
  const res = await Store.addPackage('housewarming', copy);
  assert(res.ok === true, '跨宴席 addPackage 成功');
  const dst = Store.getBanquet('housewarming');
  assert(dst.packages.length === before + 1, '目标宴席（乔迁宴）套餐数 +1');
  const added = dst.packages[dst.packages.length - 1];
  assert(added.dishes[0] === 'd1' && added.dishes[1] === 'd2', '跨宴席复制的 dishes 逐项 === 源');
  assert(added.price === 1888 && added.demo === true, '跨宴席复制的 price/demo 正确');

  // 4. 编号冲突拦截（同宴席）
  const conflict = await Store.addPackage('baby', { id: 'A', name: 'X', dishes: [] });
  assert(conflict.ok === false && /已存在/.test(conflict.msg || ''), '同宴席编号冲突被拦截');

  // 5. 编号冲突拦截（跨宴席目标已存在）
  const conflict2 = await Store.addPackage('housewarming', { id: 'A', name: 'Y', dishes: [] });
  assert(conflict2.ok === false, '跨宴席目标编号已存在也被拦截');

  console.log('');
  if (failures) { console.error('❌ 未通过 ' + failures + ' 项'); process.exit(1); }
  console.log('✅ 全部通过');
})();
