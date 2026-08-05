(function () {
  'use strict';

  // ---------- 菜品插画（占位，已上传图片时由真实照片替代） ----------
  const ICONS = {
    platter: `<svg viewBox="0 0 80 80"><ellipse cx="40" cy="52" rx="30" ry="9" fill="#fff" opacity=".45"/><ellipse cx="40" cy="50" rx="28" ry="7.5" fill="none" stroke="#fff" stroke-width="1.2" opacity=".85"/><circle cx="30" cy="45" r="4" fill="#fff" opacity=".85"/><circle cx="44" cy="41" r="5" fill="#fff" opacity=".9"/><circle cx="52" cy="49" r="3.5" fill="#fff" opacity=".8"/><circle cx="36" cy="51" r="4" fill="#fff" opacity=".85"/></svg>`,
    bird: `<svg viewBox="0 0 80 80"><ellipse cx="42" cy="48" rx="22" ry="13" fill="#fff" opacity=".88"/><circle cx="58" cy="38" r="7.5" fill="#fff" opacity=".9"/><path d="M66 38 L73 36 L66 40Z" fill="#5a3a2e" opacity=".7"/><path d="M28 56 Q30 60 33 56" stroke="#fff" stroke-width="1.5" fill="none" opacity=".75"/><path d="M35 58 Q37 62 40 58" stroke="#fff" stroke-width="1.5" fill="none" opacity=".75"/></svg>`,
    lobster: `<svg viewBox="0 0 80 80"><ellipse cx="42" cy="44" rx="20" ry="9" fill="#fff" opacity=".8"/><path d="M20 44 Q10 38 7 30 Q14 33 21 41Z" fill="#fff" opacity=".7"/><path d="M20 44 Q10 50 7 58 Q14 55 21 47Z" fill="#fff" opacity=".7"/><ellipse cx="62" cy="40" rx="4" ry="3" fill="#fff" opacity=".8"/><ellipse cx="62" cy="48" rx="4" ry="3" fill="#fff" opacity=".8"/><path d="M62 44 L73 44" stroke="#fff" stroke-width="1.5" opacity=".6"/></svg>`,
    fish: `<svg viewBox="0 0 80 80"><path d="M10 40 Q22 28 50 32 Q62 34 62 40 Q62 46 50 48 Q22 52 10 40Z" fill="#fff" opacity=".82"/><path d="M62 40 L74 30 L74 50Z" fill="#fff" opacity=".7"/><circle cx="20" cy="39" r="1.6" fill="#5a3a2e"/><path d="M26 36 Q34 33 42 36" stroke="#5a3a2e" stroke-width=".8" fill="none" opacity=".5"/></svg>`,
    shell: `<svg viewBox="0 0 80 80"><path d="M40 16 Q66 36 64 58 Q40 66 16 58 Q14 36 40 16Z" fill="#fff" opacity=".85"/><ellipse cx="40" cy="42" rx="18" ry="22" fill="none" stroke="#5a3a2e" stroke-width="1" opacity=".5"/><ellipse cx="40" cy="42" rx="11" ry="15" fill="none" stroke="#5a3a2e" stroke-width=".9" opacity=".5"/><ellipse cx="40" cy="42" rx="5" ry="8" fill="#fff" opacity=".75"/></svg>`,
    bowl: `<svg viewBox="0 0 80 80"><path d="M16 40 Q40 36 64 40 L60 56 Q40 60 20 56Z" fill="#fff" opacity=".78"/><path d="M28 30 Q30 26 28 22" stroke="#fff" stroke-width="1.5" fill="none" opacity=".7" stroke-linecap="round"/><path d="M40 28 Q42 22 40 16" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8" stroke-linecap="round"/><path d="M52 30 Q54 26 52 22" stroke="#fff" stroke-width="1.5" fill="none" opacity=".7" stroke-linecap="round"/></svg>`,
    leaf: `<svg viewBox="0 0 80 80"><path d="M40 14 Q22 30 22 50 Q22 62 40 66 Q58 62 58 50 Q58 30 40 14Z" fill="#fff" opacity=".82"/><path d="M40 14 L40 66" stroke="#5a3a2e" stroke-width="1" opacity=".45"/></svg>`,
    mound: `<svg viewBox="0 0 80 80"><path d="M16 56 Q40 20 64 56Z" fill="#fff" opacity=".82"/><path d="M26 50 Q32 46 36 50" stroke="#5a3a2e" stroke-width=".8" fill="none" opacity=".5"/><path d="M38 44 Q46 40 52 44" stroke="#5a3a2e" stroke-width=".8" fill="none" opacity=".5"/></svg>`,
    heart: `<svg viewBox="0 0 80 80"><path d="M40 62 C40 62 16 46 16 32 C16 24 22 20 28 20 C34 20 40 26 40 30 C40 26 46 20 52 20 C58 20 64 24 64 32 C64 46 40 62 40 62Z" fill="#fff" opacity=".85"/></svg>`,
    fruit: `<svg viewBox="0 0 80 80"><circle cx="32" cy="42" r="12" fill="#fff" opacity=".85"/><circle cx="48" cy="38" r="11" fill="#fff" opacity=".8"/><circle cx="44" cy="54" r="11" fill="#fff" opacity=".8"/><path d="M36 28 Q40 22 44 28" stroke="#5a3a2e" stroke-width="1" fill="none" opacity=".5"/></svg>`,
  };

  // 分类底色（仅三类）
  const CAT_COLORS = {
    '凉菜': '#F7D9A0',
    '主菜': '#F0B8A0',
    '主食点心': '#E6C58F',
  };
  // 缩略图定位样式：仅垂直方向（crop.y，0-100），固定比例 4:3，不变形
  const objPos = (d) => {
    const c = (d && d.crop) ? d.crop : null;
    const y = (c && typeof c.y === 'number') ? c.y : 50;
    return `object-position:50% ${y}%;`;
  };
  // 管理端缩略图：统一居中裁切，不随展示位置调整而变
  const objPosFixed = () => `object-position:50% 50%;`;
  // 展示裁剪：支持 2D 平移 + 缩放的 4:3 截图框（方案 B：完整图上拖 4:3 框 + 缩放）。
  // 新模型 crop = {x,y,w,h}（图片归一化裁剪矩形：x/y=左上角占宽/高比例，w=宽比例，h=高比例；h=w*0.75*图片宽高比 以保证 4:3）。
  // 用 background-size/position 精确还原，保证编辑框与展示端所见即所得。
  const cropBg = (d) => {
    const c = (d && d.crop) ? d.crop : null;
    if (c && typeof c.w === 'number') {
      const w = clamp(c.w, 0.05, 1), h = clamp((typeof c.h === 'number' ? c.h : w * 0.75), 0.05, 1);
      const x = clamp(c.x, 0, 1 - w), y = clamp(c.y, 0, 1 - h);
      const sizeW = (100 / w).toFixed(3), sizeH = (100 / h).toFixed(3);
      const posX = (1 - w < 1e-4) ? '0' : (x / (1 - w) * 100).toFixed(2);
      const posY = (1 - h < 1e-4) ? '0' : (y / (1 - h) * 100).toFixed(2);
      return `background-image:url('${d.image}');background-size:${sizeW}% ${sizeH}%;background-position:${posX}% ${posY}%;background-repeat:no-repeat;background-color:#efe8dc;`;
    }
    // 旧模型 {y} / 无 crop：cover + 垂直平移（向后兼容）
    const y = (c && typeof c.y === 'number') ? c.y : 50;
    return `background-image:url('${d.image}');background-size:cover;background-position:50% ${y}%;background-repeat:no-repeat;background-color:#efe8dc;`;
  };
  // 统一展示：所有有图窗口（点菜页/详情/菜品库/菜单/选择器）共用同一裁剪渲染，保证所见一致
  const dishCropThumb = (d) => `<div class="cropimg" style="${cropBg(d)}"></div>`;
  const defaultCrop = () => ({ x: 0.1667, y: 0.1667, w: 0.6667 });  // 居中、约 150% 缩放
  const ICON_KEYS = Object.keys(ICONS);
  const randomIcon = () => ICON_KEYS[Math.floor(Math.random() * ICON_KEYS.length)];

  // ---------- 状态 ----------
  let state = { banquet: 'wedding', pkg: 'B', search: '', mode: 'order' };
  let viewList = [];      // 当前点菜页可见菜品的展示顺序（大图循环浏览用）
  let cropTemp = null; // 图片展示位置临时值 {x,y,w,h}
  let cropAspect = 1;  // 当前编辑图片宽高比（IW/IH），用于把 4:3 裁剪框换算成图片归一化高度
  // management 子状态
  const mg = {
    tab: 'lib',            // 'lib' 菜品库 | 'menu' 菜单
    banquet: 'wedding',
    pkg: 'B',
    pkgMode: 'edit',
    libEditId: null,       // 正在编辑的菜品库 id（null=新增）
    libIsNew: false,
    pendingImage: null,
    pendingCrop: { y: 50 },
    pendingAddToPkg: null, // {banquet, pkg}：从选择器“新建并加入”时暂存
  };

  const $ = (s) => document.querySelector(s);
  const MENU = () => Store.STATE.menu;

  // ---------- 轻提示 ----------
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---------- 数据访问（统一走 Store 层） ----------
  const banquet = () => MENU()[state.banquet] || null;
  const pkg = () => { const b = banquet(); return b ? (b.packages.find((p) => p.id === state.pkg) || b.packages[0]) : null; };
  // 点菜端：解析当前套餐的菜品引用为菜品主数据
  function resolvedDishes() {
    const p = pkg();
    return p ? Store.resolvePackage(state.banquet, p.id) : [];
  }

  // ---------- 点菜模式渲染 ----------
  function renderTopTabs() {
    const cur = Store.BANQUETS.find((b) => b.id === state.banquet);
    const name = cur ? cur.name : '婚宴';
    const trig = $('#bsCurrentName'); if (trig) trig.textContent = name;
    const menu = $('#bsMenu');
    if (menu) {
      menu.innerHTML = Store.BANQUETS.map(
        (b) => `<button class="bs-item ${b.id === state.banquet ? 'on' : ''}" data-b="${b.id}">${b.name}</button>`
      ).join('');
      menu.hidden = true;
    }
  }

  function renderPkg() {
    const b = banquet();
    const bar = $('#pkgbar');
    if (!b) {
      bar.innerHTML = '<div class="pkg-empty">该宴席类型暂未配置菜单，请在「管理 · 菜单」中添加套餐</div>';
      $('#hero').hidden = true;
      $('#banner').hidden = true;
      $('#list').innerHTML = '';
      return;
    }
    bar.innerHTML = b.packages.map(
      (p) => `<button class="chip ${p.id === state.pkg ? 'on' : ''}" data-p="${p.id}">
        <span class="chip-name">${p.name}</span>
        <span class="chip-price">¥${p.price}<i>/桌</i></span>
      </button>`
    ).join('');
  }

  function renderBanner() {
    const p = pkg();
    const h = $('#banner');
    if (p && p.demo) { h.hidden = false; h.textContent = '本套餐为示例菜品，正式菜单待补充'; }
    else { h.hidden = true; }
  }

  function renderHero() {
    const p = pkg();
    const h = $('#hero');
    if (!p) { h.hidden = true; return; }
    h.hidden = false;
    h.innerHTML = `<div class="hero-card">
      <div class="hero-l">
        <div class="hero-kicker">WEDDING MENU ${p.id}</div>
        <div class="hero-title">${p.name}</div>
        <div class="hero-sub">人民币 ¥${p.price} / 桌 · 供 10 位用 · 另收 10% 服务费</div>
      </div>
      <div class="hero-r">
        <div class="hero-count">${p.dishes.length}</div>
        <div class="hero-label">道经典菜品</div>
      </div>
    </div>`;
  }

  // 缩略图：有图片用 img（固定 4:3 + object-fit:cover 不变形），否则用占位插画
  function thumbHTML(d) {
    if (d.image) {
      return `<div class="thumb">${dishCropThumb(d)}</div>`;
    }
    const col = CAT_COLORS[d.cat] || '#eee';
    return `<div class="thumb" style="background:${col}">${ICONS[d.icon] || ''}<span class="num">${d.num}</span></div>`;
  }

  function cardHTML(d) {
    return `<article class="card" data-num="${d.num}">
      ${thumbHTML(d)}
      <div class="info">
        <div class="cn">${d.cn}</div>
        <div class="en">${d.en}</div>
        <span class="cat-tag">${d.cat}</span>
      </div>
    </article>`;
  }

  function renderList() {
    const list = $('#list');
    const q = state.search.trim().toLowerCase();
    let ds = resolvedDishes();
    if (q) ds = ds.filter((d) => (d.cn + d.en).toLowerCase().includes(q));

    if (!ds.length) { list.innerHTML = '<div class="empty-state">未找到相关菜品</div>'; viewList = []; return; }

    // 点菜页不再分类，全部菜品直接铺满一个网格（跨菜品打通循环浏览）
    viewList = ds.slice();
    list.innerHTML = `<div class="grid">${ds.map(cardHTML).join('')}</div>`;
  }

  function renderAll() {
    renderTopTabs();
    renderPkg();
    renderHero();
    renderBanner();
    renderList();
  }

  // 点菜页不再有分类侧边栏，无需分类滚动联动

  // ---------- 上滑隐藏顶部 ----------
  // 点菜页：手机端隐藏顶栏/档位条/分类条（沉浸式看菜）
  // 管理页：所有尺寸都隐藏顶部操作区（平板上腾出更多编辑空间），手机端额外隐藏顶栏
  function initImmersive() {
    const app = document.querySelector('.app');
    if (!app) return;
    const mq = window.matchMedia('(max-width: 820px)');
    let lastOrderY = 0, lastMgY = 0;

    function onOrderScroll(el) {
      if (!mq.matches) { app.classList.remove('chrome-hidden'); lastOrderY = el.scrollTop; return; }
      const y = el.scrollTop;
      if (y <= 4) app.classList.remove('chrome-hidden');
      else if (y > lastOrderY + 4) app.classList.add('chrome-hidden');
      else if (y < lastOrderY - 4) app.classList.remove('chrome-hidden');
      lastOrderY = y;
    }

    function onMgScroll(el) {
      const y = el.scrollTop;
      let hide = null;                                  // null=不变，true=隐藏，false=显示
      if (y <= 4) hide = false;
      else if (y > lastMgY + 6) hide = true;
      else if (y < lastMgY - 6) hide = false;
      lastMgY = y;
      if (hide === null) return;
      // 拖动套餐 / 设置菜单展开时不收起，避免操作被打断
      if (hide && (pkgDrag || !$('#mgSetMenu').hidden)) return;
      app.classList.toggle('mg-chrome-hidden', hide);
      if (mq.matches) app.classList.toggle('chrome-hidden', hide);
      else app.classList.remove('chrome-hidden');
    }

    const c = $('#content'), mb = $('#mgBody');
    if (c) c.addEventListener('scroll', () => onOrderScroll(c), { passive: true });
    if (mb) mb.addEventListener('scroll', () => onMgScroll(mb), { passive: true });
  }

  // ---------- 详情弹窗（整份菜单打通、循环左右切换） ----------
  const viewer = { list: [], index: 0 };
  function openModal(num, list) {
    viewer.list = (list && list.length) ? list : (viewList.length ? viewList : resolvedDishes());
    const i = viewer.list.findIndex((x) => x.num === num);
    viewer.index = i < 0 ? 0 : i;
    renderModal();
    $('#modal').hidden = false;
  }
  function renderModal(dir) {
    const d = viewer.list[viewer.index];
    if (!d) return;
    const m = $('#modal');
    const thumb = m.querySelector('.modal-thumb');
    if (d.image) {
      thumb.style.background = 'transparent';
      thumb.innerHTML = dishCropThumb(d);
    } else { thumb.style.background = CAT_COLORS[d.cat] || '#eee'; thumb.innerHTML = ICONS[d.icon] || ''; }
    m.querySelector('.m-num').textContent = 'NO. ' + d.num;
    m.querySelector('.m-cn').textContent = d.cn;
    m.querySelector('.m-en').textContent = d.en;
    m.querySelector('.m-cat').textContent = d.cat;
    m.querySelector('.m-desc').textContent = d.desc || '介绍待补充';
    // 循环浏览：仅当只有 1 道菜时才禁用左右键
    const only = viewer.list.length <= 1;
    const prev = m.querySelector('.m-prev'); const next = m.querySelector('.m-next');
    if (prev) prev.disabled = only;
    if (next) next.disabled = only;
    const cnt = m.querySelector('.modal-counter');
    if (cnt) cnt.textContent = (viewer.index + 1) + ' / ' + viewer.list.length;
    // 切换时给一点方向感（左右淡入位移）
    if (dir) {
      const card = m.querySelector('.modal-card');
      const cls = dir > 0 ? 'slide-l' : 'slide-r';
      card.classList.remove('slide-l', 'slide-r');
      void card.offsetWidth;
      card.classList.add(cls);
    }
  }
  // 循环切换：到头自动接回另一端，整份菜单可一直滑
  function viewerGo(delta) {
    const len = viewer.list.length;
    if (len < 2) return;
    viewer.index = (viewer.index + delta + len) % len;
    renderModal(delta);
  }
  let swipeGuard = false, swipeTimer = null;   // 滑动后短暂屏蔽 click，避免误触关闭
  const closeModal = () => {
    $('#modal').hidden = true;
    const app = document.querySelector('.app'); if (app) app.classList.remove('chrome-hidden');
  };

  // ================= 管理模式 =================
  function setMode(mode) {
    const app = document.querySelector('.app');
    if (app) app.classList.remove('chrome-hidden', 'mg-chrome-hidden');
    closeSettings();
    state.mode = mode;
    const order = mode === 'order';
    $('#orderScreen').hidden = !order;
    $('#manageScreen').hidden = order;
    document.querySelectorAll('#modeSwitch button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));

    if (order) {
      // 切回点菜：同步管理端当前宴席/套餐，并校验合法
      state.banquet = mg.banquet;
      const b = banquet();
      if (!b || !b.packages.length) { state.banquet = 'wedding'; const bb = banquet(); state.pkg = bb && bb.packages[0] ? bb.packages[0].id : null; }
      else if (!b.packages.some((p) => p.id === state.pkg)) state.pkg = b.packages[0].id;
      renderAll();
    } else {
      // 进入管理：同步点菜端当前宴席/套餐
      mg.banquet = state.banquet;
      const b = banquet();
      mg.pkg = (b && b.packages.some((p) => p.id === state.pkg)) ? state.pkg : (b && b.packages[0] ? b.packages[0].id : null);
      renderManage();
    }
  }

  function renderManage() {
    document.querySelectorAll('#mgTabs button').forEach((b) => b.classList.toggle('on', b.dataset.mgtab === mg.tab));
    if (mg.tab === 'lib') {
      $('#mgCtxbar').hidden = true;
      $('#mgLibbar').hidden = false;
      $('#mgList').hidden = true;
      $('#mgLibList').hidden = false;
      renderLibList();
    } else {
      $('#mgCtxbar').hidden = false;
      $('#mgLibbar').hidden = true;
      $('#mgList').hidden = false;
      $('#mgLibList').hidden = true;
      $('#mgBanquet').innerHTML = Store.BANQUETS.map(
        (b) => `<option value="${b.id}" ${b.id === mg.banquet ? 'selected' : ''}>${b.name}</option>`
      ).join('');
      renderPkgRow();
      renderMgList();
    }
  }

  // ---------- 套餐条：点击切换 + 拖动排序 ----------
  function renderPkgRow() {
    const b = MENU()[mg.banquet];
    const pkgs = b ? b.packages : [];
    const row = $('#mgPkgRow');
    if (!pkgs.length) {
      row.innerHTML = '<span class="mg-pkgrow-empty">该宴席暂无套餐，点右上「+ 新增套餐」开始配置</span>';
      return;
    }
    row.innerHTML = pkgs.map((p) => `<div class="mg-pkgchip ${p.id === mg.pkg ? 'on' : ''}" data-pkg="${p.id}" title="${p.name} · ¥${p.price}/桌 · ${(p.dishes || []).length} 道（按住可拖动排序）">
      <span class="pc-grip" aria-hidden="true">⠿</span>
      <span class="pc-name">${p.name}</span>
      <span class="pc-meta">¥${p.price}·${(p.dishes || []).length}道</span>
    </div>`).join('');
  }

  // 找到离指针最近的套餐卡片，并判断应插在其前还是其后（兼容换行布局）
  function nearestChip(row, x, y, exclude) {
    const chips = Array.from(row.querySelectorAll('.mg-pkgchip')).filter((c) => c !== exclude);
    let best = null, bestD = Infinity;
    chips.forEach((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestD) { bestD = d; best = { el, before: x < cx }; }
    });
    return best;
  }

  let pkgDrag = null;
  function onPkgPointerDown(e) {
    const chip = e.target.closest('.mg-pkgchip');
    if (!chip) return;
    pkgDrag = { chip, id: chip.dataset.pkg, x: e.clientX, y: e.clientY, moved: false };
    window.addEventListener('pointermove', onPkgPointerMove);
    window.addEventListener('pointerup', onPkgPointerUp);
    window.addEventListener('pointercancel', onPkgPointerUp);
  }
  function onPkgPointerMove(e) {
    if (!pkgDrag) return;
    if (!pkgDrag.moved) {
      if (Math.hypot(e.clientX - pkgDrag.x, e.clientY - pkgDrag.y) < 8) return; // 抖动容差：小位移仍算点击
      pkgDrag.moved = true;
      pkgDrag.chip.classList.add('dragging');
      $('#mgPkgRow').classList.add('dragging-row');
    }
    e.preventDefault();
    const row = $('#mgPkgRow');
    const t = nearestChip(row, e.clientX, e.clientY, pkgDrag.chip);
    if (!t) return;
    if (t.before) row.insertBefore(pkgDrag.chip, t.el);
    else row.insertBefore(pkgDrag.chip, t.el.nextSibling);
  }
  async function onPkgPointerUp() {
    if (!pkgDrag) return;
    window.removeEventListener('pointermove', onPkgPointerMove);
    window.removeEventListener('pointerup', onPkgPointerUp);
    window.removeEventListener('pointercancel', onPkgPointerUp);
    const row = $('#mgPkgRow');
    const { moved, id, chip } = pkgDrag;
    pkgDrag = null;
    chip.classList.remove('dragging');
    row.classList.remove('dragging-row');
    if (!moved) { // 未拖动 → 视为点击：切换当前套餐
      if (mg.pkg !== id) { mg.pkg = id; renderPkgRow(); renderMgList(); }
      return;
    }
    const ids = Array.from(row.querySelectorAll('.mg-pkgchip')).map((c) => c.dataset.pkg);
    await Store.reorderPackages(mg.banquet, ids);
    renderPkgRow();
    toast('套餐顺序已保存');
  }

  // ---------- 菜品库视图 ----------
  function renderLibList() {
    const cat = $('#libCat').value;
    const list = Store.LIBRARY.filter((d) => !cat || d.cat === cat);
    // 按编号升序排列，无编号的菜品排在末尾，保证整体顺序稳定
    list.sort((a, b) => {
      const na = parseInt(a.num, 10), nb = parseInt(b.num, 10);
      return (isNaN(na) ? Infinity : na) - (isNaN(nb) ? Infinity : nb);
    });
    const el = $('#mgLibList');
    if (!list.length) {
      el.innerHTML = '<div class="mg-empty">菜品库暂无菜品，点击右上角「+ 新增菜品」开始录入（图片只存一份，多个菜单可共用）。</div>';
      return;
    }
    el.innerHTML = `<div class="mg-grid">${list.map(libCardHTML).join('')}</div>`;
  }

  function libCardHTML(d) {
    const n = Store.usageCount(d.id);
    const inner = d.image
      ? dishCropThumb(d)
      : `<div class="thumb" style="background:${CAT_COLORS[d.cat] || '#eee'}">${ICONS[d.icon] || ''}</div>`;
    return `<div class="mg-card lib-card" data-id="${d.id}">
      <div class="mg-thumb lib-thumb">
        ${inner}
        <button class="lib-del" data-libdel="${d.id}" title="删除" aria-label="删除">✕</button>
      </div>
      <div class="mg-info">
        <div class="mg-cn" data-name="${d.id}" title="点击直接改名">${d.num} · ${d.cn}</div>
        <div class="mg-en">${d.en || ''}</div>
        <span class="cat-tag">${d.cat}</span>
        <span class="lib-usage">用于 ${n} 个菜单</span>
      </div>
    </div>`;
  }

  // ---------- 菜单（套餐）视图 ----------
  // 菜品增删后套餐条上的「N 道」需同步，故统一用此入口刷新
  function renderMenuTab() { renderPkgRow(); renderMgList(); }

  function renderMgList() {
    const b = MENU()[mg.banquet];
    const p = b ? b.packages.find((x) => x.id === mg.pkg) : null;
    const list = $('#mgList');
    if (!b || !p) {
      list.innerHTML = '<div class="mg-empty">该宴席/套餐暂无数据。点击「+ 新增套餐」开始配置，再用「从菜品库添加」勾选菜品。</div>';
      return;
    }
    const cards = (p.dishes || []).map((id) => {
      const d = Store.getLibDish(id);
      if (!d) return `<div class="mg-card missing" data-id="${id}"><div class="mg-info"><div class="mg-cn">⚠ 菜品缺失（${id}）</div></div></div>`;
      const inner = d.image
        ? dishCropThumb(d)
        : `<div class="thumb" style="background:${CAT_COLORS[d.cat] || '#eee'}">${ICONS[d.icon] || ''}</div>`;
      // 一卡一交互：点卡片=编辑菜品，右上 ✕=移出本菜单，左上 ⠿=拖动排序
      return `<div class="mg-card" data-id="${id}" data-libedit="${id}">
        <div class="mg-handle" title="按住拖动排序" data-handle>⠿</div>
        <div class="mg-thumb">
          ${inner}
          <button class="lib-del" data-ref="${id}" title="移出本菜单" aria-label="移出本菜单">✕</button>
        </div>
        <div class="mg-info">
          <div class="mg-cn" data-name="${id}" title="点击直接改名">${d.num} · ${d.cn}</div>
          <div class="mg-en">${d.en || ''}</div>
          <span class="cat-tag">${d.cat}</span>
        </div>
      </div>`;
    }).join('');
    list.innerHTML = `
      <div class="mg-pkghead">
        <div class="mg-pkg-meta">
          <span class="mg-pkg-name">${p.name}</span>
          <span class="mg-pkg-price">¥${p.price}/桌</span>
          ${p.demo ? '<span class="mg-tag">示例</span>' : ''}
          <span class="mg-pkg-count">${p.dishes.length} 道（引用菜品库）</span>
        </div>
        <div class="mg-pkg-ops">
          <button class="mg-btn" id="mgEditPkg">编辑套餐</button>
        </div>
      </div>
      <div class="mg-grid" id="mgGrid">${cards}</div>
      <p class="mg-footnote">点卡片编辑菜品 · 右上「✕」移出本菜单 · 按住「⠿」拖动排序</p>`;
  }

  // ---------- 套餐内菜品排序（拖拽） ----------
  // 拖拽排序：基于 Pointer Events，按住手柄在网格内拖动即可重排
  let mgDrag = null;
  function onMgPointerDown(e) {
    const handle = e.target.closest('[data-handle]');
    if (!handle) return;
    const card = handle.closest('.mg-card[data-id]');
    if (!card) return;
    e.preventDefault();
    const grid = $('#mgGrid');
    mgDrag = { card, pointerId: e.pointerId };
    card.classList.add('dragging');
    try { grid.setPointerCapture(e.pointerId); } catch (_) {}
    window.addEventListener('pointermove', onMgPointerMove);
    window.addEventListener('pointerup', onMgPointerUp);
    window.addEventListener('pointercancel', onMgPointerUp);
  }
  function onMgPointerMove(e) {
    if (!mgDrag) return;
    e.preventDefault();
    const grid = $('#mgGrid');
    const y = e.clientY;
    const card = mgDrag.card;
    const siblings = Array.from(grid.querySelectorAll('.mg-card[data-id]')).filter((c) => c !== card);
    let placed = false;
    for (const s of siblings) {
      const r = s.getBoundingClientRect();
      if (y < r.top + r.height / 2) { grid.insertBefore(card, s); placed = true; break; }
    }
    if (!placed) grid.appendChild(card);
  }
  async function onMgPointerUp() {
    if (!mgDrag) return;
    const grid = $('#mgGrid');
    try { grid.releasePointerCapture(mgDrag.pointerId); } catch (_) {}
    window.removeEventListener('pointermove', onMgPointerMove);
    window.removeEventListener('pointerup', onMgPointerUp);
    window.removeEventListener('pointercancel', onMgPointerUp);
    mgDrag.card.classList.remove('dragging');
    const ids = Array.from(grid.querySelectorAll('.mg-card[data-id]')).map((c) => c.dataset.id);
    mgDrag = null;
    await Store.reorderPackage(mg.banquet, mg.pkg, ids);
    renderMgList();
    toast('顺序已保存');
  }

  // ---------- 菜品库编辑（新增/编辑菜品主数据） ----------
  function openLibEditor(id) {
    mg.libIsNew = !id;
    mg.libEditId = id || null;
    clearCnError();
    const d = id ? Store.getLibDish(id) : null;
    $('#editTitle').textContent = (id ? '编辑' : '新增') + '菜品（菜品库）';
    $('#eCn').value = d ? d.cn : '';
    $('#eEn').value = d ? d.en : '';
    $('#eCat').value = d ? d.cat : '主菜';
    $('#eDesc').value = d ? (d.desc || '') : '';
    mg.pendingImage = d ? (d.image || null) : null;
    mg.pendingCrop = (d && d.crop && typeof d.crop.w === 'number') ? { x: d.crop.x, y: d.crop.y, w: d.crop.w, h: (typeof d.crop.h === 'number' ? d.crop.h : undefined) } : defaultCrop();
    renderImgPrev();
    $('#editDelete').hidden = !id;
    let seen = false;
    try { seen = localStorage.getItem('ss_ob_edit') === '1'; } catch (_) {}
    $('#editOnboard').hidden = seen;
    $('#editModal').hidden = false;
  }

  function renderImgPrev() {
    const el = $('#imgPrev');
    if (mg.pendingImage) {
      const d = { image: mg.pendingImage, crop: mg.pendingCrop };
      el.innerHTML =
        `<div id="cropPrevImg" class="cropimg" style="${cropBg(d)}" title="点击调整展示位置"></div>` +
        `<button type="button" id="imgClear" class="mg-btn small ghost">移除图片</button>`;
      const pv = $('#cropPrevImg'); if (pv) pv.onclick = openCrop;
      const c = $('#imgClear'); if (c) c.onclick = () => { mg.pendingImage = null; mg.pendingCrop = defaultCrop(); renderImgPrev(); };
    } else {
      el.innerHTML = '<span class="hint">未设置图片，将使用占位插画</span>';
    }
  }

  // 中文名重复校验：同菜品库内不能有同名（排除正在编辑的这道本身）
  function showCnError(msg) {
    const err = $('#cnErr');
    if (err) { err.textContent = msg; err.hidden = false; }
    const inp = $('#eCn'); if (inp) inp.classList.add('invalid');
  }
  function clearCnError() {
    const err = $('#cnErr');
    if (err) { err.hidden = true; err.textContent = ''; }
    const inp = $('#eCn'); if (inp) inp.classList.remove('invalid');
  }
  function checkCnDuplicate() {
    const cn = $('#eCn').value.trim();
    if (!cn) { clearCnError(); return; }
    const dup = Store.LIBRARY.find((d) => d.cn === cn && d.id !== mg.libEditId);
    if (dup) showCnError(`已存在同名菜品「${cn}」，请修改名称后再保存`);
    else clearCnError();
  }

  async function saveLibDish(e) {
    e.preventDefault();
    const cn = $('#eCn').value.trim();
    if (!cn) { alert('请填写中文名'); return; }
    // 重名校验：菜品库内不允许中文名重复（排除正在编辑的这道本身）
    const dup = Store.LIBRARY.find((d) => d.cn === cn && d.id !== mg.libEditId);
    if (dup) {
      showCnError(`已存在同名菜品「${cn}」，请修改名称后再保存`);
      $('#eCn').focus();
      return;
    }
    const existing = mg.libEditId ? Store.getLibDish(mg.libEditId) : null;
    const num = existing && existing.num ? existing.num : Store.nextNum();
    const icon = existing && existing.icon ? existing.icon : randomIcon();
    const data = {
      num, cn,
      en: $('#eEn').value.trim(),
      cat: $('#eCat').value,
      icon,
      desc: $('#eDesc').value.trim(),
      image: mg.pendingImage || null,
      crop: (mg.pendingImage && mg.pendingCrop && typeof mg.pendingCrop.w === 'number') ? { x: +mg.pendingCrop.x.toFixed(4), y: +mg.pendingCrop.y.toFixed(4), w: +mg.pendingCrop.w.toFixed(4), h: (typeof mg.pendingCrop.h === 'number' ? +mg.pendingCrop.h.toFixed(4) : +(mg.pendingCrop.w * 0.75).toFixed(4)) } : null,
    };
    try {
      if (mg.libIsNew) {
        const res = await Store.addLibDish(data);
        if (!res.ok) { alert(res.msg); return; }
        if (mg.pendingAddToPkg) {
          await Store.addDishesToPackage(mg.pendingAddToPkg.banquet, mg.pendingAddToPkg.pkg, [res.id]);
        }
      } else {
        await Store.updateLibDish(mg.libEditId, data);
      }
    } catch (err) { alert(err.message || '保存失败'); return; }
    $('#editModal').hidden = true;
    const back = mg.pendingAddToPkg ? 'menu' : mg.tab;
    mg.pendingAddToPkg = null;
    if (back === 'lib') renderLibList(); else renderMenuTab();
    toast('已保存到本地');
  }

  // ---------- 菜品库：批量导入图片，自动建立若干「待命名」菜品 ----------
  async function handleBatchFiles(files) {
    const imgs = Array.from(files || []).filter((f) => f.type && f.type.startsWith('image/'));
    if (!imgs.length) { toast('没有检测到图片文件'); return; }
    const cat = $('#libCat').value || '主菜';
    toast(`正在导入 ${imgs.length} 张图片…`);
    const base = parseInt(Store.nextNum(), 10) - 1;
    const entries = [];
    for (let i = 0; i < imgs.length; i++) {
      try {
        const dataUrl = await Store.uploadImage(imgs[i]);
        entries.push({
          num: String(base + i + 1),
          cn: '待命名' + (i + 1),
          en: '',
          cat,
          icon: randomIcon(),
          desc: '',
          image: dataUrl,
          crop: null,
        });
      } catch (err) {
        console.warn('批量导入图片失败：', imgs[i].name, err);
      }
    }
    let n = 0;
    // 按拖入/选择顺序追加到菜品库末尾，配合列表按编号排序后自然排在最后
    for (let i = 0; i < entries.length; i++) {
      try {
        const res = await Store.addLibDish(entries[i]);
        if (res.ok) n++;
      } catch (err) { console.warn(err); }
    }
    renderLibList();
    const mb = $('#mgBody'); if (mb) mb.scrollTop = mb.scrollHeight;
    if (n) toast(`已新增 ${n} 道菜（待命名1…${n}），已排到列表末尾，点开即可改名`);
    else toast('图片导入失败，请重试');
  }

  // ---------- 套餐编辑 ----------
  function openPkgEditor() {
    if (mg.pkgMode === 'new') {
      $('#pkgTitle').textContent = '新增套餐';
      $('#pkgForm').reset();
      $('#pId').disabled = false;
      $('#pkgDelete').hidden = true;
    } else {
      const b = MENU()[mg.banquet];
      const p = b && b.packages.find((x) => x.id === mg.pkg);
      if (!p) { mg.pkgMode = 'new'; return openPkgEditor(); }
      $('#pkgTitle').textContent = '编辑套餐';
      $('#pId').value = p.id; $('#pId').disabled = true;
      $('#pName').value = p.name;
      $('#pPrice').value = p.price;
      $('#pDemo').checked = !!p.demo;
      $('#pkgDelete').hidden = false;
    }
    $('#pkgModal').hidden = false;
  }

  async function savePkg(e) {
    e.preventDefault();
    const id = $('#pId').value.trim();
    const name = $('#pName').value.trim();
    const price = parseFloat($('#pPrice').value) || 0;
    const demo = $('#pDemo').checked;
    if (!id || !name) { alert('请填写编号与名称'); return; }
    try {
      if (mg.pkgMode === 'new') {
        const res = await Store.addPackage(mg.banquet, { id, name, price, demo, dishes: [] });
        if (!res.ok) { alert(res.msg); return; }
        mg.pkg = id;
      } else {
        await Store.updatePackage(mg.banquet, id, { name, price, demo });
      }
    } catch (err) { alert(err.message || '保存失败'); return; }
    mg.pkgMode = 'edit';
    $('#pkgModal').hidden = true;
    renderManage();
    toast('已保存到本地');
  }

  // ---------- 从菜品库选择（组建菜单，支持批量应用到多个套餐） ----------
  function openPicker() {
    const b = MENU()[mg.banquet];
    const p = b && b.packages.find((x) => x.id === mg.pkg);
    if (!p) { alert('请先新增或选择套餐'); return; }
    $('#pickCat').value = '';
    $('#pickSearch').value = '';
    renderPickTargets();
    renderPickGrid();
    $('#pickModal').hidden = false;
  }

  // 渲染「目标套餐」多选列表（跨宴席的所有套餐，默认勾选当前套餐）
  function renderPickTargets() {
    const wrap = $('#pickTargets');
    const items = [];
    Store.BANQUETS.forEach((b) => {
      const banq = MENU()[b.id];
      if (!banq || !banq.packages) return;
      banq.packages.forEach((p) => {
        const on = b.id === mg.banquet && p.id === mg.pkg;
        items.push(`<label class="pick-target ${on ? 'on' : ''}">
          <input type="checkbox" data-banquet="${b.id}" data-pkg="${p.id}" ${on ? 'checked' : ''}>
          <span class="pt-name">${b.name} · ${p.name}</span>
        </label>`);
      });
    });
    wrap.innerHTML = items.length
      ? items.join('')
      : '<span class="pick-empty">暂无可选套餐</span>';
  }

  function pickTargets() {
    return Array.from(document.querySelectorAll('#pickTargets input:checked')).map((i) => ({
      banquet: i.dataset.banquet,
      pkg: i.dataset.pkg,
    }));
  }

  function renderPickGrid() {
    const cat = $('#pickCat').value;
    const q = $('#pickSearch').value.trim().toLowerCase();
    const b = MENU()[mg.banquet];
    const p = b && b.packages.find((x) => x.id === mg.pkg);
    const inPkg = new Set((p && p.dishes) || []);
    const list = Store.LIBRARY.filter((d) => (!cat || d.cat === cat) && (!q || (d.cn + d.en).toLowerCase().includes(q)));
    const grid = $('#pickGrid');
    if (!list.length) { grid.innerHTML = '<div class="pick-empty">菜品库暂无菜品，请先到「菜品库」录入。</div>'; return; }
    grid.innerHTML = list.map((d) => {
      const inner = d.image
        ? dishCropThumb(d)
        : `<div class="thumb" style="background:${CAT_COLORS[d.cat] || '#eee'}">${ICONS[d.icon] || ''}</div>`;
      return `<label class="pick-card ${inPkg.has(d.id) ? 'in' : ''}">
        <input type="checkbox" value="${d.id}" ${inPkg.has(d.id) ? 'checked' : ''}>
        <div class="pick-thumb">${inner}</div>
        <div class="pick-cn">${d.num} · ${d.cn}</div>
        ${inPkg.has(d.id) ? '<span class="pick-badge">已在菜单</span>' : ''}
      </label>`;
    }).join('');
  }

  async function confirmPicker() {
    const ids = Array.from(document.querySelectorAll('#pickGrid input:checked')).map((i) => i.value);
    const targets = pickTargets();
    if (!targets.length) { alert('请至少勾选一个目标套餐'); return; }
    for (const t of targets) await Store.addDishesToPackage(t.banquet, t.pkg, ids);
    $('#pickModal').hidden = true;
    renderMenuTab();
    toast(`已加入 ${targets.length} 个套餐`);
  }

  async function removeFromTargets() {
    const ids = Array.from(document.querySelectorAll('#pickGrid input:checked')).map((i) => i.value);
    if (!ids.length) { alert('请先勾选要移除的菜品'); return; }
    const targets = pickTargets();
    if (!targets.length) { alert('请至少勾选一个目标套餐'); return; }
    for (const t of targets) for (const id of ids) await Store.removeDishRef(t.banquet, t.pkg, id);
    $('#pickModal').hidden = true;
    renderMenuTab();
    toast(`已从 ${targets.length} 个套餐移除`);
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify({ menu: Store.MENU, library: Store.LIBRARY }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'menu-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // 从同源 JSON 拉取已发布的菜单（仓库/部署目录中的 data/menu-config.json）。
  // 用途：1) 新设备首次打开自动加载；2) 设置里手动「从云端拉取菜单」覆盖本机。
  // 与 exportConfig 互为导入/导出：JSON 结构为 { library, menu }，正好匹配 Store.importConfig。
  async function pullFromCloud(opts) {
    opts = opts || {};
    try {
      const res = await fetch('./data/menu-config.json?t=' + Date.now(), { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const r = await Store.importConfig(data);
      if (!r.ok) throw new Error(r.msg || '配置格式不正确');
      if (state.mode === 'order') renderAll(); else renderManage();
      if (!opts.silent) toast('已从云端拉取菜单');
      return true;
    } catch (e) {
      if (!opts.silent) toast('拉取失败：' + e.message);
      return false;
    }
  }

  // ---------- 设置：折叠菜单（不弹独立窗口） ----------
  function toggleSettings(force) {
    const m = $('#mgSetMenu');
    m.hidden = (typeof force === 'boolean') ? !force : !m.hidden;
  }
  function closeSettings() { $('#mgSetMenu').hidden = true; }

  // ---------- 恢复默认（保留居中二次确认弹窗，防误触） ----------
  function openResetConfirm() {
    closeSettings();
    $('#resetConfirmModal').hidden = false;
  }
  async function confirmReset() {
    $('#resetConfirmModal').hidden = true;
    Store.reset();
    mg.tab = 'lib'; mg.banquet = 'wedding'; mg.pkg = 'B'; mg.pkgMode = 'edit';
    if (state.mode === 'order') { state.banquet = 'wedding'; state.pkg = 'B'; renderAll(); }
    renderManage();
    toast('已恢复默认');
  }

  // ---------- 图片展示位置编辑（截图框式：4:3 框可上下左右拖动 + 缩放） ----------
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function openCrop() {
    if (!mg.pendingImage) { alert('请先上传图片再调整展示位置'); return; }
    const img = $('#cropImg');
    const c = (mg.pendingCrop && typeof mg.pendingCrop.w === 'number') ? mg.pendingCrop : defaultCrop();
    const apply = () => {
      const win = $('#cropWin');
      if (win && img.naturalWidth) {
        cropAspect = img.naturalWidth / img.naturalHeight;
        win.style.aspectRatio = cropAspect.toFixed(4);
      }
      const h = (typeof c.h === 'number') ? c.h : c.w * 0.75 * (cropAspect || 1);
      cropTemp = { x: c.x, y: c.y, w: c.w, h: clamp(h, 0.05, 1) };
      syncZoomSlider();
      positionCropFrame();
    };
    img.onload = apply;
    img.src = mg.pendingImage;
    $('#cropModal').hidden = false;
    if (img.complete && img.naturalWidth) apply();   // dataURL 可能同步完成
  }

  // 取景框：4:3，可在完整图上拖动（上下左右）+ 缩放；dark 遮罩用 box-shadow 实现
  function positionCropFrame() {
    const win = $('#cropWin'); const frame = $('#cropFrame');
    if (!win || !frame || !cropTemp) return;
    const r = win.getBoundingClientRect();
    if (!r.width) return;
    const fw = cropTemp.w * r.width;
    const fh = cropTemp.h * r.height;
    const fx = cropTemp.x * r.width;
    const fy = cropTemp.y * r.height;
    frame.style.width = fw + 'px';
    frame.style.height = fh + 'px';
    frame.style.left = fx + 'px';
    frame.style.top = fy + 'px';
  }

  function setCropXY(x, y) {
    if (!cropTemp) return;
    const w = cropTemp.w, h = cropTemp.h;
    cropTemp.x = clamp(x, 0, 1 - w);
    cropTemp.y = clamp(y, 0, 1 - h);
    positionCropFrame();
  }

  function setCropZoom(zoomPct) {
    if (!cropTemp) return;
    const nw = clamp(100 / zoomPct, 0.05, 1);
    const nh = nw * 0.75 * cropAspect;
    const cx = cropTemp.x + cropTemp.w / 2;
    const cy = cropTemp.y + cropTemp.h / 2;
    cropTemp.w = nw; cropTemp.h = nh;
    cropTemp.x = clamp(cx - nw / 2, 0, 1 - nw);
    cropTemp.y = clamp(cy - nh / 2, 0, 1 - nh);
    const zv = $('#cropZoomVal'); if (zv) zv.textContent = Math.round(zoomPct) + '%';
    positionCropFrame();
  }

  function syncZoomSlider() {
    const z = $('#cropZoom'); if (!z || !cropTemp) return;
    const zoom = clamp(Math.round(100 / cropTemp.w), 100, 400);
    z.value = String(zoom);
    const zv = $('#cropZoomVal'); if (zv) zv.textContent = zoom + '%';
  }

  // 一次性绑定（启动期调用）：框内拖动平移、右下角手柄缩放、缩放滑块
  function initCrop() {
    const win = $('#cropWin'); const frame = $('#cropFrame');
    if (!win || !frame) return;
    let mode = null, sx = 0, sy = 0, sc = null;
    const down = (e) => {
      if (!cropTemp) return;
      mode = (e.target && e.target.id === 'cropGrip') ? 'zoom' : 'pan';
      sx = e.clientX; sy = e.clientY;
      sc = { x: cropTemp.x, y: cropTemp.y, w: cropTemp.w };
      if (frame.setPointerCapture) try { frame.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    };
    const move = (e) => {
      if (!mode || !cropTemp) return;
      e.preventDefault();
      const r = win.getBoundingClientRect();
      if (mode === 'pan') {
        setCropXY(sc.x + (e.clientX - sx) / r.width, sc.y + (e.clientY - sy) / r.height);
      } else {
        const dd = ((e.clientX - sx) + (e.clientY - sy)) / 2;   // 拖右下角手柄往外 = 框变大（zoom out）；往内 = 框变小（放大）
        const nw = clamp(sc.w + dd / r.width, 0.05, 1);
        const nh = nw * 0.75 * cropAspect;
        cropTemp = { x: clamp(sc.x, 0, 1 - nw), y: clamp(sc.y, 0, 1 - nh), w: nw, h: nh };
        syncZoomSlider();
        positionCropFrame();
      }
    };
    const up = () => { mode = null; };
    frame.addEventListener('pointerdown', down);
    frame.addEventListener('pointermove', move);
    frame.addEventListener('pointerup', up);
    frame.addEventListener('pointercancel', up);
    const z = $('#cropZoom'); if (z) z.addEventListener('input', () => setCropZoom(parseFloat(z.value)));
  }

  function applyCrop() {
    if (!cropTemp) return;
    mg.pendingCrop = { x: +cropTemp.x.toFixed(4), y: +cropTemp.y.toFixed(4), w: +cropTemp.w.toFixed(4), h: +cropTemp.h.toFixed(4) };
    renderImgPrev();
    $('#cropModal').hidden = true;
    toast('展示位置已调整');
  }

  // ---------- 管理端：点击菜品名直接改名（内联编辑） ----------
  function inlineEditName(id, el) {
    if (!el || el.querySelector('input')) return;
    const cur = Store.getLibDish(id);
    if (!cur) return;
    const input = document.createElement('input');
    input.className = 'mg-cn-edit';
    input.value = cur.cn;
    el.textContent = '';
    el.appendChild(input);
    input.focus(); input.select();
    let done = false;
    const commit = async () => {
      if (done) return; done = true;
      const v = input.value.trim();
      if (!v) { toast('名称不能为空'); renderLibList(); renderMgList(); return; }
      if (v !== cur.cn) {
        const dup = Store.LIBRARY.find((d) => d.cn === v && d.id !== id);
        if (dup) { toast(`已存在同名菜品「${v}」`); renderLibList(); renderMgList(); return; }
        await Store.updateLibDish(id, { cn: v });
        toast('已改名');
      }
      renderLibList(); renderMgList();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { done = true; renderLibList(); renderMgList(); }
    });
    input.addEventListener('blur', commit);
  }

  // ---------- 事件绑定 ----------
  function bindStatic() {
    // 模式切换
    $('#modeSwitch').addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      setMode(t.dataset.mode);
    });

    // 点菜模式：宴席折叠下拉（默认只显示当前宴席，避免客人看到其他宴席）
    $('#bsTrigger').addEventListener('click', (e) => {
      e.stopPropagation();
      const m = $('#bsMenu');
      m.hidden = !m.hidden;
    });
    $('#bsMenu').addEventListener('click', (e) => {
      const t = e.target.closest('.bs-item'); if (!t) return;
      state.banquet = t.dataset.b;
      const b = banquet();
      state.pkg = b ? b.packages[0].id : null;
      $('#bsMenu').hidden = true;
      renderAll();
    });
    document.addEventListener('click', (e) => {
      const sel = $('#banquetSelect');
      if (sel && !sel.contains(e.target)) { const m = $('#bsMenu'); if (m) m.hidden = true; }
    });
    $('#pkgbar').addEventListener('click', (e) => {
      const t = e.target.closest('.chip'); if (!t) return;
      state.pkg = t.dataset.p;
      renderHero(); renderPkg(); renderBanner(); renderList();
    });
    $('#search').addEventListener('input', (e) => { state.search = e.target.value; renderList(); });
    $('#list').addEventListener('click', (e) => {
      const c = e.target.closest('.card'); if (!c) return;
      // 打通整份菜单：不再按分类切片，大图里可循环浏览本套餐全部菜品
      openModal(c.dataset.num, viewList);
    });
    $('#modal').addEventListener('click', (e) => {
      if (e.target.closest('.m-prev')) { viewerGo(-1); return; }
      if (e.target.closest('.m-next')) { viewerGo(1); return; }
      if (swipeGuard) return;   // 刚滑动过：本次 click 不当作“点遮罩关闭”
      if (e.target.id === 'modal' || e.target.closest('.modal-close')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (!$('#modal').hidden) {
        if (e.key === 'ArrowLeft') { viewerGo(-1); return; }
        if (e.key === 'ArrowRight') { viewerGo(1); return; }
      }
      if (e.key === 'Escape') { closeModal(); closeSettings(); $('#editModal').hidden = true; $('#pkgModal').hidden = true; $('#pickModal').hidden = true; $('#resetConfirmModal').hidden = true; }
    });
    // 详情弹窗：左右滑动循环切换菜品（横向位移明显大于纵向才算滑动）
    const mEl = $('#modal');
    let touchX = 0, touchY = 0;
    mEl.addEventListener('touchstart', (e) => {
      touchX = e.changedTouches[0].clientX; touchY = e.changedTouches[0].clientY;
    }, { passive: true });
    mEl.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        viewerGo(dx < 0 ? 1 : -1);
        swipeGuard = true;
        clearTimeout(swipeTimer);
        swipeTimer = setTimeout(() => { swipeGuard = false; }, 350);
      }
    }, { passive: true });

    // 管理模式：子标签 + 上下文栏
    $('#mgTabs').addEventListener('click', (e) => { const t = e.target.closest('button'); if (!t) return; mg.tab = t.dataset.mgtab; renderManage(); });

    // —— 菜品库标签 ——
    $('#libCat').addEventListener('change', renderLibList);
    $('#mgAddLibDish').addEventListener('click', () => openLibEditor(null));
    $('#mgLibList').addEventListener('click', (e) => {
      const dl = e.target.closest('[data-libdel]');
      if (dl) {
        const id = dl.dataset.libdel;
        const n = Store.usageCount(id);
        if (n > 0 && !confirm(`该菜品正用于 ${n} 个菜单，删除后这些菜单也将移出此菜品，确定删除？`)) return;
        (async () => { await Store.removeLibDish(id); renderLibList(); toast('已删除'); })();
        return;
      }
      const nm = e.target.closest('[data-name]');
      if (nm) { e.stopPropagation(); inlineEditName(nm.dataset.name, nm); return; }
      const card = e.target.closest('.lib-card');
      if (card) openLibEditor(card.dataset.id);
    });

    // —— 菜品库：批量导入图片（入口在「设置 → 批量新建菜品」）——
    $('#setBatch').addEventListener('click', () => { closeSettings(); $('#batchImgInput').click(); });
    $('#batchImgInput').addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length) handleBatchFiles(files);
      e.target.value = '';
    });
    const dtHasFiles = (dt) => !!(dt && (Array.from(dt.types || []).includes('Files') || (dt.files && dt.files.length)));
    let dragDepth = 0;
    document.addEventListener('dragenter', (e) => {
      if (!dtHasFiles(e.dataTransfer)) return;
      e.preventDefault();
      if (mg.tab !== 'lib') return;
      dragDepth++;
      $('#mgDrop').hidden = false;
    });
    document.addEventListener('dragover', (e) => {
      if (!dtHasFiles(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    document.addEventListener('dragleave', (e) => {
      if (mg.tab !== 'lib') return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) $('#mgDrop').hidden = true;
    });
    document.addEventListener('drop', (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      dragDepth = 0;
      $('#mgDrop').hidden = true;
      if (mg.tab === 'lib') handleBatchFiles(e.dataTransfer.files);
    });

    // —— 菜单标签 ——
    $('#mgBanquet').addEventListener('change', (e) => {
      mg.banquet = e.target.value;
      const b = MENU()[mg.banquet];
      mg.pkg = (b && b.packages[0]) ? b.packages[0].id : null;
      renderManage();
    });
    $('#mgAddPkg').addEventListener('click', () => { mg.pkgMode = 'new'; openPkgEditor(); });
    $('#mgAddFromLib').addEventListener('click', openPicker);
    $('#mgList').addEventListener('click', (e) => {
      if (e.target.closest('[data-handle]')) return;          // 拖动手柄不触发编辑
      const nm = e.target.closest('[data-name]');
      if (nm) { e.stopPropagation(); inlineEditName(nm.dataset.name, nm); return; }
      const rf = e.target.closest('[data-ref]');              // 先判删除，再判编辑
      if (rf) {
        const id = rf.dataset.ref;
        (async () => { await Store.removeDishRef(mg.banquet, mg.pkg, id); renderMenuTab(); toast('已移出本菜单'); })();
        return;
      }
      if (e.target.closest('#mgEditPkg')) { mg.pkgMode = 'edit'; openPkgEditor(); return; }
      const ed = e.target.closest('[data-libedit]');
      if (ed) openLibEditor(ed.dataset.libedit);
    });
    // 拖拽排序：在网格上委托 pointerdown，手柄触发
    $('#mgList').addEventListener('pointerdown', onMgPointerDown);
    // 套餐条：点击切换套餐、按住拖动排序
    $('#mgPkgRow').addEventListener('pointerdown', onPkgPointerDown);

    // 导入配置（JSON）：由「设置 → 导入配置」触发
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Store.importConfig(data).then((res) => {
            if (!res.ok) { alert(res.msg); return; }
            mg.banquet = 'wedding';
            const b = MENU()[mg.banquet];
            mg.pkg = b && b.packages[0] ? b.packages[0].id : null;
            if (state.mode === 'order') { state.banquet = 'wedding'; state.pkg = mg.pkg; renderAll(); }
            renderManage();
            closeSettings();
            toast('配置已导入');
          });
        } catch (err) { alert('解析失败：' + err.message); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // —— 顶部说明条：关闭后永久记住（本设备） ——
    $('#mgHintClose').addEventListener('click', () => {
      $('#mgHint').style.display = 'none';
      try { localStorage.setItem('ss_hint_off', '1'); } catch (_) {}
    });

    // —— 编辑弹窗首次引导：看过一次后不再出现 ——
    $('#editOnboardX').addEventListener('click', () => {
      $('#editOnboard').hidden = true;
      try { localStorage.setItem('ss_ob_edit', '1'); } catch (_) {}
    });

    // —— 设置折叠菜单（导出 / 导入 / 恢复默认） ——
    $('#mgSettings').addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(); });
    $('#setExport').addEventListener('click', () => { exportConfig(); closeSettings(); });
    $('#setImportJson').addEventListener('click', () => { closeSettings(); $('#importFile').click(); });
    $('#setReset').addEventListener('click', openResetConfirm);
    $('#setPull').addEventListener('click', async () => {
      closeSettings();
      if (!confirm('将从云端拉取已发布的菜单，并覆盖本设备当前菜单。确定继续？')) return;
      await pullFromCloud();
    });
    document.addEventListener('click', (e) => {
      const w = $('#mgSetWrap');
      if (w && !w.contains(e.target)) closeSettings();
    });

    // 恢复默认二次确认
    $('#resetConfirm').addEventListener('click', confirmReset);
    $('#resetCancel').addEventListener('click', () => { $('#resetConfirmModal').hidden = true; });

    // —— 选择器弹窗 ——
    $('#pickCat').addEventListener('change', renderPickGrid);
    $('#pickSearch').addEventListener('input', renderPickGrid);
    $('#pickTargets').addEventListener('change', (e) => {
      const l = e.target.closest('.pick-target');
      if (l && e.target.matches('input')) l.classList.toggle('on', e.target.checked);
    });
    $('#pickNew').addEventListener('click', () => {
      $('#pickModal').hidden = true;
      mg.pendingAddToPkg = { banquet: mg.banquet, pkg: mg.pkg };
      openLibEditor(null);
    });
    $('#pickConfirm').addEventListener('click', confirmPicker);
    $('#pickRemove').addEventListener('click', removeFromTargets);
    $('#pickCancel').addEventListener('click', () => { $('#pickModal').hidden = true; });
    $('#pickCancel2').addEventListener('click', () => { $('#pickModal').hidden = true; });

    // 图片上传（含进度条）
    $('#imgInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const prog = $('#imgProgress'); const bar = prog.querySelector('.bar');
      prog.hidden = false; bar.style.width = '8%';
      Store.uploadImage(file, (p) => { bar.style.width = Math.max(8, Math.round(p * 100)) + '%'; })
        .then((url) => { mg.pendingImage = url; renderImgPrev(); })
        .catch((err) => alert('图片处理失败：' + err.message))
        .finally(() => { setTimeout(() => { prog.hidden = true; bar.style.width = '0%'; }, 400); });
    });

    // 菜品库表单
    $('#editForm').addEventListener('submit', saveLibDish);
    $('#eCn').addEventListener('input', checkCnDuplicate);
    $('#editDelete').addEventListener('click', async () => {
      if (mg.libEditId) {
        const n = Store.usageCount(mg.libEditId);
        if (n > 0 && !confirm(`该菜品正用于 ${n} 个菜单，删除后这些菜单也将移出此菜品，确定删除？`)) return;
        await Store.removeLibDish(mg.libEditId);
      }
      $('#editModal').hidden = true;
      if (mg.tab === 'lib') renderLibList(); else renderMenuTab();
      toast('已删除');
    });

    // 套餐表单
    $('#pkgForm').addEventListener('submit', savePkg);
    $('#pkgDelete').addEventListener('click', async () => {
      if (confirm('删除该套餐及其所有菜品引用？')) {
        await Store.removePackage(mg.banquet, mg.pkg);
        const b = MENU()[mg.banquet];
        mg.pkg = b && b.packages[0] ? b.packages[0].id : null;
        $('#pkgModal').hidden = true;
        renderManage();
        toast('已删除');
      }
    });

    // 图片展示位置编辑器
    $('#cropApply').addEventListener('click', applyCrop);
    initCrop();

    // 弹窗关闭（data-close 按钮 & 点击遮罩）
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => { $('#' + btn.dataset.close).hidden = true; });
    });
    // 「恢复默认」确认框刻意不加点遮罩关闭，必须显式选择，防误触
    ['editModal', 'pkgModal', 'cropModal', 'pickModal'].forEach((id) => {
      $('#' + id).addEventListener('click', (e) => { if (e.target.id === id) $('#' + id).hidden = true; });
    });
  }

  // ---------- 启动 ----------
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (localStorage.getItem('ss_hint_off') === '1') { $('#mgHint').style.display = 'none'; }
    } catch (_) {}
    bindStatic();
    // 首次打开（本地无菜单数据）：尝试从云端 JSON 拉取已发布菜单；失败则回退 data.js 种子
    try {
      if (!localStorage.getItem('ss_menu_v1')) await pullFromCloud({ silent: true });
    } catch (_) {}
    renderAll();
    initImmersive();
  });
})();
