// 山水S酒店 · 数据访问层（菜单存储）
// 设计（v2 · 菜品库模式）：
//  - state = { library: [菜品主数据...], menu: { 宴席: { packages:[...] } } }
//  - 套餐只保存菜品库 id 引用；渲染时按 id 解析出菜品主数据，图片仅存一份。
//  - 当前实现：以 localStorage 持久化（无后端）。所有增删改查都经本层，
//    已标注「后端接入点」，后续接入服务端只需替换对应 localStorage 调用为 API 请求。
//
// ⚠️ 本地存储配额约 5MB。菜品图片压缩后存为 base64；过多/过大导致写入失败时，
//    save() 会自动再压一轮；仍失败才向上抛错。接后端后大图应走服务端，本地只存 URL。

const Store = (function () {
  'use strict';

  const LS_KEY = 'ss_menu_v1'; // 沿用 v1 键名，load 时自动把旧版内嵌数据迁移为菜品库
  const BACKUP_KEY = 'ss_menu_v1_backup'; // 自动备份（防丢）：每次保存后同步一份带时间戳的副本到独立键

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function seed() {
    return {
      library: deepClone(typeof LIBRARY_SEED !== 'undefined' ? LIBRARY_SEED : []),
      menu: deepClone(typeof MENU_DATA !== 'undefined' ? MENU_DATA : {}),
    };
  }

  // 载入：优先读取已保存副本；旧版（菜品内嵌）自动迁移；否则以种子数据初始化
  let STATE = load();

  const BANQUET_LIST = deepClone(typeof BANQUETS !== 'undefined' ? BANQUETS : []);

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // 旧版：state 顶层就是 menu，且菜品内嵌在套餐里 → 迁移
        if (needsMigration(parsed)) return migrate(parsed);
        // 已是新结构（含 library）
        if (parsed && parsed.library) return parsed;
        // 兼容：旧版但已被外部改造成 {menu:...}
        if (parsed && parsed.menu) return { library: [], menu: parsed.menu };
      }
    } catch (e) { /* 忽略损坏数据 */ }
    return seed();
  }

  // 判断是否需要迁移：任一套餐的 dishes 元素是对象（而非 libId 字符串）
  function needsMigration(state) {
    const menu = state.menu || state; // 旧版 state 即 menu
    for (const bid in menu) {
      const b = menu[bid];
      if (!b || !b.packages) continue;
      for (const p of b.packages) {
        if (Array.isArray(p.dishes) && p.dishes.length && typeof p.dishes[0] === 'object') return true;
      }
    }
    return false;
  }

  // 迁移：把内嵌菜品去重汇入菜品库，套餐 dishes 改为 libId 数组
  function migrate(oldMenu) {
    const menu = oldMenu.menu || oldMenu;
    const library = [];
    const byCn = {};
    const findOrCreate = (d) => {
      if (byCn[d.cn]) return byCn[d.cn];
      const id = nextLibId(library);
      const entry = {
        id,
        num: d.num || '',
        cn: d.cn,
        en: d.en || '',
        cat: d.cat || '主菜',
        icon: d.icon || 'platter',
        desc: d.desc || '',
        image: d.image || null,
        crop: d.crop || null,
      };
      library.push(entry);
      byCn[d.cn] = id;
      return id;
    };
    for (const bid in menu) {
      const b = menu[bid];
      if (!b || !b.packages) continue;
      b.packages.forEach((p) => {
        if (Array.isArray(p.dishes)) {
          p.dishes = p.dishes.map((d) => (typeof d === 'object' ? findOrCreate(d) : d));
          // 去除同一套餐内的重复引用（保留首次出现顺序）
          p.dishes = p.dishes.filter((id, i, arr) => arr.indexOf(id) === i);
        }
      });
    }
    return { library, menu };
  }

  function nextLibId(library) {
    let max = 0;
    (library || STATE.library || []).forEach((d) => {
      const m = /^lib(\d+)$/.exec(d.id || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'lib' + String(max + 1).padStart(3, '0');
  }

  // 自动编号：取菜品库当前最大数值编号 + 1（新增菜品时使用，避免手动填号）
  function nextNum() {
    let max = 0;
    (STATE.library || []).forEach((d) => {
      const n = parseInt(d.num, 10);
      if (!isNaN(n)) max = Math.max(max, n);
    });
    return String(max + 1);
  }

  // 持久化（异步：配额超限时自动把图片再压一轮后重试）
  async function save() {
    // TODO 后端接入点：将 STATE 提交至服务端
    // return fetch('/api/menu', { method:'PUT', body: JSON.stringify(STATE), headers:{'Content-Type':'application/json'} });
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(STATE));
    } catch (e) {
      const shrunk = await shrinkImages();
      if (shrunk) { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); }
      else throw new Error('本地存储已满（图片过多/过大）。建议接入服务端保存大图，或删除部分菜品图片。');
    }
    // 自动备份（防丢）：每次保存后同步一份带时间戳的副本到独立键，便于一键恢复
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ ts: Date.now(), library: STATE.library, menu: STATE.menu }));
    } catch (_) { /* 备份失败不影响主流程 */ }
  }

  // 配额超限兜底：把菜品库图片重新压缩到更小尺寸
  async function shrinkImages() {
    let changed = false;
    const tasks = [];
    STATE.library.forEach((d) => {
      if (d.image && d.image.indexOf('data:image') === 0) {
        tasks.push(
          compressImage(d.image, 560, 0.6).then((small) => {
            if (small && small.length < d.image.length) { d.image = small; changed = true; }
          }).catch(() => {})
        );
      }
    });
    await Promise.all(tasks);
    return changed;
  }

  // ================= 菜品库（主数据） =================
  function getLibDish(id) { return STATE.library.find((d) => d.id === id) || null; }

  async function addLibDish(data) {
    if (!data || !data.cn) return { ok: false, msg: '请填写中文名' };
    const entry = Object.assign({ id: nextLibId(), image: null, crop: null, en: '', desc: '' }, data);
    if (!entry.num) entry.num = '';
    STATE.library.push(entry);
    await save();
    return { ok: true, id: entry.id };
  }

  async function updateLibDish(id, patch) {
    const d = getLibDish(id);
    if (!d) return { ok: false, msg: '菜品不存在' };
    Object.assign(d, patch);
    await save();
    return { ok: true };
  }

  async function removeLibDish(id) {
    STATE.library = STATE.library.filter((d) => d.id !== id);
    // 同步从所有套餐中移除该引用
    for (const bid in STATE.menu) {
      const b = STATE.menu[bid];
      if (!b || !b.packages) continue;
      b.packages.forEach((p) => {
        if (Array.isArray(p.dishes)) p.dishes = p.dishes.filter((x) => x !== id);
      });
    }
    await save();
    return { ok: true };
  }

  // 统计某菜品被多少个套餐引用（用于「用于 N 个菜单」提示）
  function usageCount(id) {
    let n = 0;
    for (const bid in STATE.menu) {
      const b = STATE.menu[bid];
      if (!b || !b.packages) continue;
      b.packages.forEach((p) => { if (Array.isArray(p.dishes) && p.dishes.includes(id)) n++; });
    }
    return n;
  }

  // ================= 宴席 / 套餐 =================
  function getBanquet(id) { return STATE.menu[id] || null; }
  function ensureBanquet(id, name) {
    if (!STATE.menu[id]) STATE.menu[id] = { name: name || id, packages: [] };
    return STATE.menu[id];
  }
  function getPackage(banquetId, pkgId) {
    const b = getBanquet(banquetId);
    return b ? b.packages.find((p) => p.id === pkgId) : null;
  }
  async function addPackage(banquetId, pkg) {
    const b = ensureBanquet(banquetId);
    if (b.packages.some((p) => p.id === pkg.id)) return { ok: false, msg: '套餐编号已存在' };
    b.packages.push(pkg);
    await save();
    return { ok: true };
  }
  async function updatePackage(banquetId, pkgId, patch) {
    const p = getPackage(banquetId, pkgId);
    if (!p) return { ok: false, msg: '套餐不存在' };
    Object.assign(p, patch);
    await save();
    return { ok: true };
  }
  async function removePackage(banquetId, pkgId) {
    const b = getBanquet(banquetId);
    if (b) { b.packages = b.packages.filter((p) => p.id !== pkgId); await save(); }
    return { ok: true };
  }
  // 重排宴席下的套餐顺序（ids 为完整的新顺序，全部为套餐 id）
  // 管理端「套餐条」拖动排序调用；点菜页档位条顺序随之变化。
  async function reorderPackages(banquetId, ids) {
    const b = getBanquet(banquetId);
    if (!b || !Array.isArray(b.packages)) return { ok: false, msg: '宴席不存在' };
    const map = {};
    b.packages.forEach((p) => { map[p.id] = p; });
    const next = [];
    ids.forEach((id) => { if (map[id]) { next.push(map[id]); delete map[id]; } });
    // 兜底：ids 中未出现的套餐（异常情况）按原顺序追加到末尾，避免丢数据
    b.packages.forEach((p) => { if (map[p.id]) next.push(p); });
    b.packages = next;
    await save();
    return { ok: true };
  }

  // 调整套餐档位顺序（up/down）：保留给键盘/无障碍等场景调用
  async function movePackage(banquetId, pkgId, dir) {
    const b = getBanquet(banquetId);
    if (!b || !Array.isArray(b.packages)) return { ok: false, msg: '宴席不存在' };
    const arr = b.packages;
    const i = arr.findIndex((p) => p.id === pkgId);
    if (i < 0) return { ok: false, msg: '套餐不存在' };
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= arr.length) return { ok: false, msg: '已到边界' };
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    await save();
    return { ok: true };
  }

  // ================= 套餐中的菜品引用 =================
  // 往套餐追加菜品库引用（去重）
  async function addDishesToPackage(banquetId, pkgId, ids) {
    const p = getPackage(banquetId, pkgId);
    if (!p) return { ok: false, msg: '套餐不存在' };
    if (!p.dishes) p.dishes = [];
    ids.forEach((id) => { if (!p.dishes.includes(id)) p.dishes.push(id); });
    await save();
    return { ok: true };
  }
  // 从套餐移除某道菜的引用（不影响菜品库）
  async function removeDishRef(banquetId, pkgId, libId) {
    const p = getPackage(banquetId, pkgId);
    if (p && Array.isArray(p.dishes)) { p.dishes = p.dishes.filter((x) => x !== libId); await save(); }
    return { ok: true };
  }
  // 重排套餐内菜品顺序（ids 为完整的新顺序，全部为 libId）
  async function reorderPackage(banquetId, pkgId, ids) {
    const p = getPackage(banquetId, pkgId);
    if (!p) return { ok: false, msg: '套餐不存在' };
    p.dishes = ids.filter((x) => p.dishes.includes(x)); // 仅保留合法引用
    await save();
    return { ok: true };
  }
  // 解析套餐的菜品引用为菜品主数据（供渲染）
  // 若套餐含 nameOverrides[libId]，则显示名以覆盖名为准（仅影响展示，不改菜品库主数据）
  // nameOverrides[libId] 兼容两种形态：
  //   - 旧数据：字符串（仅中文名覆盖）
  //   - 新数据：对象 { cn, en }（中文名 + 英文名分别覆盖）
  function resolvePackage(banquetId, pkgId) {
    const p = getPackage(banquetId, pkgId);
    if (!p || !Array.isArray(p.dishes)) return [];
    const ov = (p.nameOverrides) || {};
    return p.dishes.map((id) => {
      const d = getLibDish(id);
      if (!d) return null;
      const o = ov[id];
      if (o === undefined || o === null || o === '') return d;
      const merged = Object.assign({}, d);
      if (typeof o === 'string') {
        merged.cn = o; merged._overridden = true;
      } else {
        if (o.cn !== undefined && o.cn !== null && o.cn !== '') { merged.cn = o.cn; merged._overridden = true; }
        if (o.en !== undefined && o.en !== null && o.en !== '') { merged.en = o.en; merged._enOverridden = true; }
      }
      return merged;
    }).filter(Boolean);
  }

  // 写入某个菜在某套餐内的覆盖名（cn 或 en），保留另一字段；空值/等于菜品库原名则剔除该字段
  // nameOverrides[libId] 统一存对象 { cn, en }
  function applyOverride(p, libId, lib, field, name) {
    if (!p.nameOverrides) p.nameOverrides = {};
    const cur = (typeof p.nameOverrides[libId] === 'object' && p.nameOverrides[libId] !== null)
      ? Object.assign({}, p.nameOverrides[libId]) : {};
    const libVal = field === 'cn' ? (lib && lib.cn) : (lib && lib.en);
    const v = (name || '').trim();
    if (!v || (libVal !== undefined && v === libVal)) delete cur[field];
    else cur[field] = v;
    if (!Object.keys(cur).length) delete p.nameOverrides[libId];
    else p.nameOverrides[libId] = cur;
  }

  // 菜单内菜品改中文名：仅覆盖「当前套餐」展示名，不影响菜品库主数据
  async function setDishNameOverride(banquetId, pkgId, libId, name) {
    const p = getPackage(banquetId, pkgId);
    if (!p) return { ok: false, msg: '套餐不存在' };
    const lib = getLibDish(libId);
    applyOverride(p, libId, lib, 'cn', name);
    await save();
    return { ok: true };
  }
  // 菜单内菜品改英文名：同上，仅覆盖当前套餐英文名，不影响菜品库主数据
  async function setDishEnOverride(banquetId, pkgId, libId, name) {
    const p = getPackage(banquetId, pkgId);
    if (!p) return { ok: false, msg: '套餐不存在' };
    const lib = getLibDish(libId);
    applyOverride(p, libId, lib, 'en', name);
    await save();
    return { ok: true };
  }
  async function clearDishNameOverride(banquetId, pkgId, libId) {
    const p = getPackage(banquetId, pkgId);
    if (p && p.nameOverrides) { delete p.nameOverrides[libId]; await save(); }
    return { ok: true };
  }

  // ================= 图片上传 =================
  // 当前：本地压缩后转 base64 dataURL 存于菜品库菜品.image（前端即时预览，体积小不超配额）。
  // onProgress(p): p∈[0,1] 用于进度条。
  // TODO 后端接入点：替换为真实上传接口，返回图片 URL 后写入菜品.image。
  function uploadImage(file, onProgress) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('未选择文件'));
      if (onProgress) onProgress(0.05);
      const reader = new FileReader();
      reader.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(0.05 + (e.loaded / e.total) * 0.45); };
      reader.onload = () => {
        if (onProgress) onProgress(0.55);
        compressImage(reader.result)
          .then((url) => { if (onProgress) onProgress(1); resolve(url); })
          .catch((err) => reject(err));
      };
      reader.onerror = () => reject(new Error('读取失败'));
      reader.readAsDataURL(file);
    });
  }

  // 压缩：等比缩放至最长边 ≤ 900px，输出 JPEG(0.7)，base64 体积约 60–140KB
  function compressImage(dataUrl, maxSize, quality) {
    maxSize = maxSize || 900; quality = quality || 0.7;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
        else if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try { resolve(canvas.toDataURL('image/jpeg', quality)); }
        catch (e) { resolve(dataUrl); } // 退化：直接用原图
      };
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = dataUrl;
    });
  }

  // 自动备份：读取备份元信息（时间戳），用于「恢复自动备份」前展示时间
  function getBackupMeta() {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      return { ts: (typeof o.ts === 'number') ? o.ts : null, has: Array.isArray(o.library) && typeof o.menu === 'object' };
    } catch (_) { return null; }
  }
  // 一键恢复最近一次自动备份
  async function restoreBackup() {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return { ok: false, msg: '没有可用的自动备份' };
      const o = JSON.parse(raw);
      if (!o || !Array.isArray(o.library) || typeof o.menu !== 'object') return { ok: false, msg: '自动备份格式不正确' };
      STATE.library = o.library; STATE.menu = o.menu;
      await save();
      return { ok: true, ts: (typeof o.ts === 'number') ? o.ts : null };
    } catch (e) { return { ok: false, msg: e.message || '恢复失败' }; }
  }
  // 删除撤销：查询某菜品被哪些套餐引用（用于删除后「撤销」恢复引用）
  function getUsages(id) {
    const arr = [];
    for (const bid in STATE.menu) {
      const b = STATE.menu[bid];
      if (!b || !b.packages) continue;
      b.packages.forEach((p) => { if (Array.isArray(p.dishes) && p.dishes.includes(id)) arr.push({ banquetId: bid, pkgId: p.id, id }); });
    }
    return arr;
  }
  // 撤销：按原 id 把菜品重新放回菜品库（不改编号/id）
  async function restoreLibDish(dish) {
    if (!dish || !dish.id) return { ok: false, msg: '无效菜品' };
    if (!STATE.library.find((d) => d.id === dish.id)) STATE.library.push(dish);
    await save();
    return { ok: true };
  }
  // 撤销：恢复菜品被套餐的引用
  async function restoreRefs(usages) {
    for (const u of (usages || [])) {
      const p = getPackage(u.banquetId, u.pkgId);
      if (p && Array.isArray(p.dishes) && !p.dishes.includes(u.id)) p.dishes.push(u.id);
    }
    await save();
    return { ok: true };
  }
  // 撤销：把套餐重新放回宴席（保留原 id 与菜品引用）
  async function restorePackage(banquetId, pkg) {
    if (!pkg || !pkg.id) return { ok: false, msg: '无效套餐' };
    const b = ensureBanquet(banquetId);
    if (!b.packages.some((p) => p.id === pkg.id)) b.packages.push(pkg);
    await save();
    return { ok: true };
  }

  function reset() {
    localStorage.removeItem(LS_KEY);
    STATE = seed();
  }

  // 导入整份配置（与 exportConfig 配对）：用于跨设备搬运菜单（各设备独立存储时）
  async function importConfig(data) {
    if (!data || !Array.isArray(data.library) || typeof data.menu !== 'object') {
      return { ok: false, msg: '配置格式不正确（需包含 library 与 menu）' };
    }
    STATE.library = data.library;
    STATE.menu = data.menu;
    await save();
    return { ok: true };
  }

  return {
    get STATE() { return STATE; },
    get MENU() { return STATE.menu; },        // 兼容旧调用
    get LIBRARY() { return STATE.library; },
    get BANQUETS() { return BANQUET_LIST; },
    save,
    getBanquet, ensureBanquet, nextNum,
    getPackage, addPackage, updatePackage, removePackage, movePackage, reorderPackages,
    getLibDish, addLibDish, updateLibDish, removeLibDish, usageCount,
    addDishesToPackage, removeDishRef, reorderPackage, resolvePackage,
    setDishNameOverride, setDishEnOverride, clearDishNameOverride,
    uploadImage, importConfig, reset,
    getBackupMeta, restoreBackup, getUsages, restoreLibDish, restoreRefs, restorePackage,
  };
})();
