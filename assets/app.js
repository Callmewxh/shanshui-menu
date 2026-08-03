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
  const objPos = (d) => (d && d.crop ? `${d.crop.x}% ${d.crop.y}%` : '50% 50%');

  // ---------- 状态 ----------
  let state = { banquet: 'wedding', pkg: 'B', search: '', mode: 'order' };
  let spy = null;
  let cropTemp = null; // 图片展示位置临时值 {x,y}
  // management 子状态
  const mg = {
    tab: 'lib',            // 'lib' 菜品库 | 'menu' 菜单
    banquet: 'wedding',
    pkg: 'B',
    pkgMode: 'edit',
    libEditId: null,       // 正在编辑的菜品库 id（null=新增）
    libIsNew: false,
    pendingImage: null,
    pendingCrop: { x: 50, y: 50 },
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
    $('#banquetTabs').innerHTML = Store.BANQUETS.map(
      (b) => `<button class="tab ${b.id === state.banquet ? 'on' : ''}" data-b="${b.id}">${b.name}</button>`
    ).join('');
  }

  function renderPkg() {
    const b = banquet();
    const bar = $('#pkgbar');
    if (!b) {
      bar.innerHTML = '<div class="pkg-empty">该宴席类型暂未配置菜单，请在「管理 · 菜单」中添加套餐</div>';
      $('#hero').hidden = true;
      $('#banner').hidden = true;
      $('#list').innerHTML = '';
      renderRail();
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

  function renderRail() {
    const cats = ['全部', ...CATEGORIES];
    $('#rail').innerHTML = cats.map(
      (c, i) => `<button class="rail-item ${i === 0 ? 'on' : ''}" data-c="${c}"><span>${c}</span></button>`
    ).join('');
  }

  // 缩略图：有图片用 img（固定 4:3 + object-fit:cover 不变形），否则用占位插画
  function thumbHTML(d) {
    if (d.image) {
      return `<div class="thumb"><img src="${d.image}" alt="${d.cn}" style="object-position:${objPos(d)}"></div>`;
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

    if (!ds.length) { list.innerHTML = '<div class="empty-state">未找到相关菜品</div>'; return; }

    if (q) {
      list.innerHTML = `<section class="sec"><div class="sec-head"><h3>搜索结果</h3><span>${ds.length} 道</span></div>
        <div class="grid">${ds.map(cardHTML).join('')}</div></section>`;
      return;
    }

    const groups = CATEGORIES
      .map((c) => ({ c, items: ds.filter((d) => d.cat === c) }))
      .filter((g) => g.items.length);

    list.innerHTML = groups.map(
      (g) => `<section class="sec" id="sec-${g.c}">
        <div class="sec-head"><h3>${g.c}</h3><span>${g.items.length} 道</span></div>
        <div class="grid">${g.items.map(cardHTML).join('')}</div>
      </section>`
    ).join('');
  }

  function renderAll() {
    renderTopTabs();
    renderPkg();
    renderHero();
    renderBanner();
    renderRail();
    renderList();
  }

  // ---------- 滚动联动 ----------
  function setRail(cat) {
    document.querySelectorAll('.rail-item').forEach((i) =>
      i.classList.toggle('on', i.dataset.c === (CATEGORIES.includes(cat) ? cat : '全部'))
    );
  }

  function setupSpy() {
    if (spy) spy.disconnect();
    spy = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setRail(e.target.id.replace('sec-', '')); }),
      { root: $('#content'), rootMargin: '-12% 0px -70% 0px', threshold: 0 }
    );
    document.querySelectorAll('.sec[id^="sec-"]').forEach((s) => spy.observe(s));
  }

  // ---------- 详情弹窗 ----------
  function openModal(num) {
    const d = resolvedDishes().find((x) => x.num === num);
    if (!d) return;
    const m = $('#modal');
    const thumb = m.querySelector('.modal-thumb');
    if (d.image) {
      thumb.style.background = 'transparent';
      thumb.innerHTML = `<img src="${d.image}" alt="${d.cn}" style="width:100%;height:100%;object-fit:cover;object-position:${objPos(d)}">`;
    } else { thumb.style.background = CAT_COLORS[d.cat] || '#eee'; thumb.innerHTML = ICONS[d.icon] || ''; }
    m.querySelector('.m-num').textContent = 'NO. ' + d.num;
    m.querySelector('.m-cn').textContent = d.cn;
    m.querySelector('.m-en').textContent = d.en;
    m.querySelector('.m-cat').textContent = d.cat;
    m.querySelector('.m-desc').textContent = d.desc || '介绍待补充';
    m.hidden = false;
  }
  const closeModal = () => { $('#modal').hidden = true; };

  // ================= 管理模式 =================
  function setMode(mode) {
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
      renderAll(); setupSpy();
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
      const b = MENU()[mg.banquet];
      const pkgs = b ? b.packages : [];
      $('#mgPkg').innerHTML = pkgs.length
        ? pkgs.map((p) => `<option value="${p.id}" ${p.id === mg.pkg ? 'selected' : ''}>${p.name}（¥${p.price}）</option>`).join('')
        : '<option value="">— 暂无套餐，请新增 —</option>';
      renderMgList();
    }
  }

  // ---------- 菜品库视图 ----------
  function renderLibList() {
    const cat = $('#libCat').value;
    const list = Store.LIBRARY.filter((d) => !cat || d.cat === cat);
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
      ? `<img src="${d.image}" alt="${d.cn}" style="object-position:${objPos(d)}">`
      : `<div class="thumb" style="background:${CAT_COLORS[d.cat] || '#eee'}">${ICONS[d.icon] || ''}</div>`;
    return `<div class="mg-card">
      <div class="mg-thumb">${inner}</div>
      <div class="mg-info">
        <div class="mg-cn">${d.num} · ${d.cn}</div>
        <div class="mg-en">${d.en || ''}</div>
        <span class="cat-tag">${d.cat}</span>
        <span class="lib-usage">用于 ${n} 个菜单</span>
      </div>
      <div class="mg-ops">
        <button class="mg-btn small" data-libedit="${d.id}">编辑</button>
        <button class="mg-btn small danger" data-libdel="${d.id}">删除</button>
      </div>
    </div>`;
  }

  // ---------- 菜单（套餐）视图 ----------
  function renderMgList() {
    const b = MENU()[mg.banquet];
    const p = b ? b.packages.find((x) => x.id === mg.pkg) : null;
    const list = $('#mgList');
    if (!b || !p) {
      list.innerHTML = '<div class="mg-empty">该宴席/套餐暂无数据。点击「+ 新增套餐」开始配置，再用「从菜品库添加」勾选菜品。</div>';
      return;
    }
    const total = (p.dishes || []).length;
    const cards = (p.dishes || []).map((id, idx) => {
      const d = Store.getLibDish(id);
      if (!d) return `<div class="mg-card missing" data-id="${id}"><div class="mg-info"><div class="mg-cn">⚠ 菜品缺失（${id}）</div></div></div>`;
      const inner = d.image
        ? `<img src="${d.image}" alt="${d.cn}" style="object-position:${objPos(d)}">`
        : `<div class="thumb" style="background:${CAT_COLORS[d.cat] || '#eee'}">${ICONS[d.icon] || ''}</div>`;
      const disUp = idx === 0 ? 'disabled' : '';
      const disDown = idx === total - 1 ? 'disabled' : '';
      return `<div class="mg-card" data-id="${id}">
        <div class="mg-handle" title="按住拖动排序" data-handle>⠿</div>
        <div class="mg-thumb">${inner}</div>
        <div class="mg-info">
          <div class="mg-cn">${d.num} · ${d.cn}</div>
          <div class="mg-en">${d.en || ''}</div>
          <span class="cat-tag">${d.cat}</span>
        </div>
        <div class="mg-ops">
          <button class="mg-btn small" data-libedit="${id}">编辑</button>
          <button class="mg-btn small ghost" data-ref="${id}">移出本菜单</button>
          <span class="mg-spacer"></span>
          <button class="mg-btn small move" data-mv="up" data-id="${id}" ${disUp} title="上移">↑</button>
          <button class="mg-btn small move" data-mv="down" data-id="${id}" ${disDown} title="下移">↓</button>
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
        <button class="mg-btn" id="mgEditPkg">编辑套餐</button>
      </div>
      <div class="mg-grid" id="mgGrid">${cards}</div>
      <p class="mg-footnote">拖动卡片左上角「⠿」可排序，或用每道菜的「↑ / ↓」按钮；顺序会同步保存到本地。编辑某道菜会同步到所有含该菜品的菜单。</p>`;
  }

  // ---------- 套餐内菜品排序（上/下移 + 拖拽） ----------
  async function moveRef(libId, dir) {
    const b = MENU()[mg.banquet];
    const p = b && b.packages.find((x) => x.id === mg.pkg);
    if (!p || !Array.isArray(p.dishes)) return;
    const arr = p.dishes.slice();
    const i = arr.indexOf(libId);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= arr.length) return;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    await Store.reorderPackage(mg.banquet, mg.pkg, arr);
    renderMgList();
  }

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
    const d = id ? Store.getLibDish(id) : null;
    $('#editTitle').textContent = (id ? '编辑' : '新增') + '菜品（菜品库）';
    $('#eNum').value = d ? d.num : '';
    $('#eCn').value = d ? d.cn : '';
    $('#eEn').value = d ? d.en : '';
    $('#eCat').value = d ? d.cat : '主菜';
    $('#eIcon').value = d ? (d.icon || 'platter') : 'platter';
    $('#eDesc').value = d ? (d.desc || '') : '';
    mg.pendingImage = d ? (d.image || null) : null;
    mg.pendingCrop = d && d.crop ? { x: d.crop.x, y: d.crop.y } : { x: 50, y: 50 };
    renderImgPrev();
    $('#editDelete').hidden = !id;
    $('#editModal').hidden = false;
  }

  function renderImgPrev() {
    const el = $('#imgPrev');
    const op = objPos({ crop: mg.pendingCrop });
    if (mg.pendingImage) {
      el.innerHTML =
        `<img src="${mg.pendingImage}" alt="" style="object-position:${op}">` +
        `<button type="button" id="cropOpen" class="mg-btn small">调整展示位置</button>` +
        `<button type="button" id="imgClear" class="mg-btn small ghost">移除图片</button>`;
      const co = $('#cropOpen'); if (co) co.onclick = openCrop;
      const c = $('#imgClear'); if (c) c.onclick = () => { mg.pendingImage = null; mg.pendingCrop = { x: 50, y: 50 }; renderImgPrev(); };
    } else {
      el.innerHTML = '<span class="hint">未设置图片，将使用占位插画</span>';
    }
  }

  async function saveLibDish(e) {
    e.preventDefault();
    const num = $('#eNum').value.trim();
    const cn = $('#eCn').value.trim();
    if (!num || !cn) { alert('请填写编号与中文名'); return; }
    const data = {
      num, cn,
      en: $('#eEn').value.trim(),
      cat: $('#eCat').value,
      icon: $('#eIcon').value,
      desc: $('#eDesc').value.trim(),
      image: mg.pendingImage || null,
      crop: (mg.pendingImage && mg.pendingCrop) ? { x: mg.pendingCrop.x, y: mg.pendingCrop.y } : null,
    };
    try {
      if (mg.libIsNew) {
        const res = Store.addLibDish(data);
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
    if (back === 'lib') renderLibList(); else renderMgList();
    toast('已保存到本地');
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
        ? `<img src="${d.image}" style="object-position:${objPos(d)}">`
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
    renderMgList();
    toast(`已加入 ${targets.length} 个套餐`);
  }

  async function removeFromTargets() {
    const ids = Array.from(document.querySelectorAll('#pickGrid input:checked')).map((i) => i.value);
    if (!ids.length) { alert('请先勾选要移除的菜品'); return; }
    const targets = pickTargets();
    if (!targets.length) { alert('请至少勾选一个目标套餐'); return; }
    for (const t of targets) for (const id of ids) await Store.removeDishRef(t.banquet, t.pkg, id);
    $('#pickModal').hidden = true;
    renderMgList();
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

  // ---------- 设置弹窗 ----------
  function openSettings() { $('#settingsModal').hidden = false; }
  function closeSettings() { $('#settingsModal').hidden = true; }

  // ---------- 恢复默认（二次确认） ----------
  function openResetConfirm() {
    $('#settingsModal').hidden = true;
    $('#resetConfirmModal').hidden = false;
  }
  async function confirmReset() {
    $('#resetConfirmModal').hidden = true;
    Store.reset();
    mg.tab = 'lib'; mg.banquet = 'wedding'; mg.pkg = 'B'; mg.pkgMode = 'edit';
    if (state.mode === 'order') { state.banquet = 'wedding'; state.pkg = 'B'; renderAll(); setupSpy(); }
    renderManage();
    toast('已恢复默认');
  }

  // ---------- 图片展示位置（焦点）编辑 ----------
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function ptOf(e) { return { x: e.clientX, y: e.clientY, id: e.pointerId }; }

  function openCrop() {
    if (!mg.pendingImage) { alert('请先上传图片再调整展示位置'); return; }
    const img = $('#cropImg');
    const c = mg.pendingCrop || { x: 50, y: 50 };
    img.src = mg.pendingImage;
    img.style.objectPosition = c.x + '% ' + c.y + '%';
    cropTemp = { x: c.x, y: c.y };
    $('#cropModal').hidden = false;
  }

  function initCrop() {
    const win = $('#cropWin');
    const img = $('#cropImg');
    if (!win) return;
    let dragging = false, lastX = 0, lastY = 0;
    const down = (e) => { dragging = true; const p = ptOf(e); lastX = p.x; lastY = p.y; if (win.setPointerCapture) try { win.setPointerCapture(p.id); } catch (_) {} };
    const move = (e) => {
      if (!dragging || !cropTemp) return;
      const p = ptOf(e);
      const dx = p.x - lastX, dy = p.y - lastY; lastX = p.x; lastY = p.y;
      const r = win.getBoundingClientRect();
      cropTemp.x = clamp(cropTemp.x + (dx / r.width) * 100, 0, 100);
      cropTemp.y = clamp(cropTemp.y + (dy / r.height) * 100, 0, 100);
      img.style.objectPosition = cropTemp.x + '% ' + cropTemp.y + '%';
    };
    const up = () => { dragging = false; };
    win.addEventListener('pointerdown', down);
    win.addEventListener('pointermove', move);
    win.addEventListener('pointerup', up);
    win.addEventListener('pointercancel', up);
  }

  function applyCrop() {
    if (!cropTemp) return;
    mg.pendingCrop = { x: Math.round(cropTemp.x), y: Math.round(cropTemp.y) };
    renderImgPrev();
    $('#cropModal').hidden = true;
    toast('展示位置已调整');
  }

  // ---------- 事件绑定 ----------
  function bindStatic() {
    // 模式切换
    $('#modeSwitch').addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      setMode(t.dataset.mode);
    });

    // 点菜模式
    $('#banquetTabs').addEventListener('click', (e) => {
      const t = e.target.closest('.tab'); if (!t) return;
      state.banquet = t.dataset.b;
      const b = banquet();
      state.pkg = b ? b.packages[0].id : null;
      renderAll();
    });
    $('#pkgbar').addEventListener('click', (e) => {
      const t = e.target.closest('.chip'); if (!t) return;
      state.pkg = t.dataset.p;
      renderHero(); renderPkg(); renderBanner(); renderRail(); renderList(); setupSpy();
    });
    $('#rail').addEventListener('click', (e) => {
      const t = e.target.closest('.rail-item'); if (!t) return;
      const c = t.dataset.c;
      if (c === '全部') { $('#content').scrollTo({ top: 0, behavior: 'smooth' }); setRail(''); }
      else { const s = document.getElementById('sec-' + c); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    $('#search').addEventListener('input', (e) => { state.search = e.target.value; renderList(); setupSpy(); });
    $('#list').addEventListener('click', (e) => {
      const c = e.target.closest('.card'); if (!c) return;
      openModal(c.dataset.num);
    });
    $('#modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal' || e.target.closest('.modal-close')) closeModal();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); $('#editModal').hidden = true; $('#pkgModal').hidden = true; $('#pickModal').hidden = true; $('#settingsModal').hidden = true; $('#resetConfirmModal').hidden = true; } });

    // 管理模式：子标签 + 上下文栏
    $('#mgTabs').addEventListener('click', (e) => { const t = e.target.closest('button'); if (!t) return; mg.tab = t.dataset.mgtab; renderManage(); });

    // —— 菜品库标签 ——
    $('#libCat').addEventListener('change', renderLibList);
    $('#mgAddLibDish').addEventListener('click', () => openLibEditor(null));
    $('#mgLibList').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-libedit]');
      if (ed) { openLibEditor(ed.dataset.libedit); return; }
      const dl = e.target.closest('[data-libdel]');
      if (dl) {
        const id = dl.dataset.libdel;
        const n = Store.usageCount(id);
        if (n > 0 && !confirm(`该菜品正用于 ${n} 个菜单，删除后这些菜单也将移出此菜品，确定删除？`)) return;
        (async () => { await Store.removeLibDish(id); renderLibList(); toast('已删除'); })();
      }
    });

    // —— 菜单标签 ——
    $('#mgBanquet').addEventListener('change', (e) => {
      mg.banquet = e.target.value;
      const b = MENU()[mg.banquet];
      mg.pkg = (b && b.packages[0]) ? b.packages[0].id : null;
      renderManage();
    });
    $('#mgPkg').addEventListener('change', (e) => { mg.pkg = e.target.value; renderMgList(); });
    $('#mgAddPkg').addEventListener('click', () => { mg.pkgMode = 'new'; openPkgEditor(); });
    $('#mgAddFromLib').addEventListener('click', openPicker);
    $('#mgList').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-libedit]');
      if (ed) { openLibEditor(ed.dataset.libedit); return; }
      const mv = e.target.closest('[data-mv]');
      if (mv) {
        if (mv.disabled) return;
        moveRef(mv.dataset.id, mv.dataset.mv);
        return;
      }
      const rf = e.target.closest('[data-ref]');
      if (rf) {
        const id = rf.dataset.ref;
        (async () => { await Store.removeDishRef(mg.banquet, mg.pkg, id); renderMgList(); toast('已移出本菜单'); })();
        return;
      }
      if (e.target.closest('#mgEditPkg')) { mg.pkgMode = 'edit'; openPkgEditor(); }
    });
    // 拖拽排序：在网格上委托 pointerdown，手柄触发
    $('#mgList').addEventListener('pointerdown', onMgPointerDown);

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
            if (state.mode === 'order') { state.banquet = 'wedding'; state.pkg = mg.pkg; renderAll(); setupSpy(); }
            renderManage();
            closeSettings();
            toast('配置已导入');
          });
        } catch (err) { alert('解析失败：' + err.message); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // —— 提示栏可关闭 ——
    $('#mgHintClose').addEventListener('click', () => { $('#mgHint').style.display = 'none'; });

    // —— 设置入口（整合 导出 / 导入 / 恢复默认） ——
    $('#mgSettings').addEventListener('click', openSettings);
    $('#setExport').addEventListener('click', () => { exportConfig(); closeSettings(); });
    $('#setImportJson').addEventListener('click', () => { closeSettings(); $('#importFile').click(); });
    $('#setReset').addEventListener('click', openResetConfirm);

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
    $('#editDelete').addEventListener('click', async () => {
      if (mg.libEditId) {
        const n = Store.usageCount(mg.libEditId);
        if (n > 0 && !confirm(`该菜品正用于 ${n} 个菜单，删除后这些菜单也将移出此菜品，确定删除？`)) return;
        await Store.removeLibDish(mg.libEditId);
      }
      $('#editModal').hidden = true;
      if (mg.tab === 'lib') renderLibList(); else renderMgList();
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
    ['editModal', 'pkgModal', 'cropModal', 'pickModal', 'settingsModal', 'resetConfirmModal'].forEach((id) => {
      $('#' + id).addEventListener('click', (e) => { if (e.target.id === id) $('#' + id).hidden = true; });
    });
  }

  // ---------- 启动 ----------
  document.addEventListener('DOMContentLoaded', () => {
    bindStatic();
    renderAll();
    setupSpy();
  });
})();
