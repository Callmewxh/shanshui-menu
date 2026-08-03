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

  // 持久化（异步：配额超限时自动把图片再压一轮后重试）
  async function save() {
    // TODO 后端接入点：将 STATE 提交至服务端
    // return fetch('/api/menu', { method:'PUT', body: JSON.stringify(STATE), headers:{'Content-Type':'application/json'} });
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(STATE));
    } catch (e) {
      const shrunk = await shrinkImages();
      if (shrunk) { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); return; }
      throw new Error('本地存储已满（图片过多/过大）。建议接入服务端保存大图，或删除部分菜品图片。');
    }
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
  function resolvePackage(banquetId, pkgId) {
    const p = getPackage(banquetId, pkgId);
    if (!p || !Array.isArray(p.dishes)) return [];
    return p.dishes.map((id) => getLibDish(id)).filter(Boolean);
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

  // 从 Excel 数据导入（与「下载 Excel 模板」结构对应）：
  //  - rowsLib: [{编号,中文名,英文名,分类,图标,描述}] 按「编号」upsert 到菜品库
  //  - rowsPkg: [{宴席,套餐编号,套餐名称,价格,是否示例,菜品编号}] 按 宴席+套餐编号 upsert 套餐
  async function applyExcelData(rowsLib, rowsPkg) {
    const byNum = {};
    STATE.library.forEach((d) => { if (d.num) byNum[d.num] = d.id; });
    (rowsLib || []).forEach((r) => {
      const num = (r.编号 != null ? String(r.编号) : (r.num != null ? String(r.num) : '')).trim();
      const cn = (r.中文名 != null ? String(r.中文名) : (r.cn != null ? String(r.cn) : '')).trim();
      if (!cn) return;
      const data = {
        num, cn,
        en: (r.英文名 != null ? String(r.英文名) : (r.en != null ? String(r.en) : '')).trim(),
        cat: (r.分类 != null ? String(r.分类) : (r.cat != null ? String(r.cat) : '')) || '主菜',
        icon: (r.图标 != null ? String(r.图标) : (r.icon != null ? String(r.icon) : '')) || 'platter',
        desc: (r.描述 != null ? String(r.描述) : (r.desc != null ? String(r.desc) : '')).trim(),
      };
      if (byNum[num]) { Object.assign(getLibDish(byNum[num]), data); }
      else {
        const id = nextLibId();
        STATE.library.push(Object.assign({ id, image: null, crop: null, en: '', desc: '' }, data));
        byNum[num] = id;
      }
    });
    (rowsPkg || []).forEach((r) => {
      const bName = (r.宴席 != null ? String(r.宴席) : (r.banquet != null ? String(r.banquet) : '')).trim();
      const b = BANQUET_LIST.find((x) => x.name === bName || x.id === bName);
      if (!b) return;
      ensureBanquet(b.id, b.name);
      const pid = (r.套餐编号 != null ? String(r.套餐编号) : (r.id != null ? String(r.id) : '')).trim();
      const name = (r.套餐名称 != null ? String(r.套餐名称) : (r.name != null ? String(r.name) : '')).trim();
      const price = parseFloat(r.价格 != null ? r.价格 : r.price) || 0;
      const demo = /^(是|yes|true|1|y)$/i.test((r.是否示例 != null ? String(r.是否示例) : (r.demo != null ? String(r.demo) : '')).trim());
      let p = getPackage(b.id, pid);
      if (!p) { p = { id: pid, name, price, demo, dishes: [] }; STATE.menu[b.id].packages.push(p); }
      else { p.name = name || p.name; p.price = price; p.demo = demo; if (!Array.isArray(p.dishes)) p.dishes = []; }
      const nums = (r.菜品编号 != null ? String(r.菜品编号) : (r.dishNums != null ? String(r.dishNums) : ''))
        .split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);
      p.dishes = nums.map((n) => byNum[n]).filter(Boolean);
    });
    await save();
    return { ok: true, dishes: STATE.library.length };
  }

  return {
    get STATE() { return STATE; },
    get MENU() { return STATE.menu; },        // 兼容旧调用
    get LIBRARY() { return STATE.library; },
    get BANQUETS() { return BANQUET_LIST; },
    save,
    getBanquet, ensureBanquet,
    getPackage, addPackage, updatePackage, removePackage,
    getLibDish, addLibDish, updateLibDish, removeLibDish, usageCount,
    addDishesToPackage, removeDishRef, reorderPackage, resolvePackage,
    uploadImage, importConfig, applyExcelData, reset,
  };
})();
