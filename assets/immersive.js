// 沉浸 pad 外壳手势引擎（仅 body.shell-pad 激活）
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // 工具：从菜品库 id 取菜品对象（library 为数组）
  const libDish = (id) => {
    const lib = Store.STATE.library;
    if (Array.isArray(lib)) return lib.find(d => d && d.id === id);
    return lib ? lib[id] : null;
  };

  // 取套餐封面图（第一个有图的菜，否则占位）
  const pkgThumb = (pkg) => {
    for (const id of pkg.dishes || []) {
      const d = libDish(id);
      if (d && d.image) return { image: d.image, crop: d.crop, id };
    }
    return null;
  };

  // 背景样式（复用 data.js/app.js 的 crop 模型）
  const bgStyle = (thumb) => {
    if (!thumb || !thumb.image) return '';
    const c = thumb.crop;
    if (c && typeof c.w === 'number') {
      const w = Math.max(0.05, Math.min(1, c.w));
      const h = Math.max(0.05, Math.min(1, typeof c.h === 'number' ? c.h : w * 0.75));
      const x = Math.max(0, Math.min(1 - w, c.x || 0));
      const y = Math.max(0, Math.min(1 - h, c.y || 0));
      const sizeW = (100 / w).toFixed(3), sizeH = (100 / h).toFixed(3);
      const posX = (1 - w < 1e-4) ? '0' : (x / (1 - w) * 100).toFixed(2);
      const posY = (1 - h < 1e-4) ? '0' : (y / (1 - h) * 100).toFixed(2);
      return `background-image:url('${thumb.image}');background-size:${sizeW}% ${sizeH}%;background-position:${posX}% ${posY}%;background-repeat:no-repeat;background-color:var(--img-bg);`;
    }
    const y = (c && typeof c.y === 'number') ? c.y : 50;
    return `background-image:url('${thumb.image}');background-size:cover;background-position:50% ${y}%;background-repeat:no-repeat;background-color:var(--img-bg);`;
  };

  // 当前可见宴席名称
  const currentBanquetName = () => {
    const el = $('#bsCurrentName');
    return el ? el.textContent.trim() : '婚宴';
  };

  // 初始化
  window.initImmersiveShell = function () {
    if (!document.body.classList.contains('shell-pad')) return;

    const cover = $('#coverShell');
    const track = $('#coverTrack');
    const dots = $('#coverDots');
    const pin = $('#coverPin');
    const hint = $('#coverHint');
    const orderScreen = $('#orderScreen');
    const topbar = $('.topbar');
    if (!cover || !track || !orderScreen) return;

    // 状态
    let slides = [];     // {pkg, thumb}
    let idx = 0;         // 当前轮播索引
    let stage = 0;       // 顶栏展开状态 0=收起 1=半开 2=全开（实际只用 0/2）
    let upStreak = 0;    // 连续上滑计数
    let inMenu = false;  // 是否已进入菜单
    let autoTimer = null;
    let hintTimer = null;

    // 构建封面轮播
    const buildSlides = () => {
      const b = (() => {
        const name = currentBanquetName();
        const menu = Store.STATE.menu || {};
        const found = Object.entries(menu).find(([, v]) => v && v.name === name);
        return found ? found[1] : null;
      })();
      const pkgs = (b && b.packages) || [];
      slides = pkgs.map((p) => ({ pkg: p, thumb: pkgThumb(p) }));
      idx = 0;
      renderSlides();
      renderDots();
      updateInfo();
    };

    const renderSlides = () => {
      if (!slides.length) {
        track.innerHTML = '<div class="cover-slide"><div class="cs-placeholder" style="font-size:4vw;color:var(--muted)">暂无菜单</div></div>';
        return;
      }
      track.innerHTML = slides.map((s, i) => {
        const style = s.thumb ? bgStyle(s.thumb) : '';
        const inner = s.thumb
          ? `<div class="cropimg" style="${style}"></div>`
          : `<div class="cs-placeholder">${s.pkg.name}</div>`;
        return `<div class="cover-slide ${i === idx ? 'active' : ''}" data-i="${i}">${inner}</div>`;
      }).join('');
      track.style.transform = `translateX(${-idx * 100}%)`;
    };

    const renderDots = () => {
      if (slides.length <= 1) { dots.innerHTML = ''; return; }
      dots.innerHTML = slides.map((_, i) => `<span class="cover-dot ${i === idx ? 'on' : ''}" data-i="${i}"></span>`).join('');
    };

    const updateInfo = () => {
      const s = slides[idx];
      // 印章 = 宴席全称
      pin.textContent = currentBanquetName();
      // 左下角套餐信息
      let info = cover.querySelector('.cover-info');
      if (!info) {
        info = document.createElement('div');
        info.className = 'cover-info';
        info.innerHTML = '<div class="ci-title"></div><div class="ci-price"></div>';
        cover.appendChild(info);
      }
      if (s) {
        info.querySelector('.ci-title').textContent = `${currentBanquetName()} · ${s.pkg.id} ${s.pkg.name}`;
        info.querySelector('.ci-price').textContent = `¥${s.pkg.price} / 桌 · 共 ${s.pkg.dishes.length} 道`;
        info.hidden = false;
      } else {
        info.hidden = true;
      }
    };

    const goTo = (i) => {
      if (!slides.length) return;
      idx = (i + slides.length) % slides.length;
      track.style.transform = `translateX(${-idx * 100}%)`;
      $$('.cover-slide').forEach((el, k) => el.classList.toggle('active', k === idx));
      $$('.cover-dot').forEach((el, k) => el.classList.toggle('on', k === idx));
      updateInfo();
    };

    const startAuto = () => {
      stopAuto();
      if (slides.length <= 1 || inMenu) return;
      autoTimer = setInterval(() => {
        if (inMenu || stage > 0) return;
        goTo(idx + 1);
      }, 4500);
    };
    const stopAuto = () => { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } };

    // 进入 / 退出菜单
    const enterMenu = () => {
      if (inMenu) return;
      inMenu = true;
      cover.classList.add('entered');
      orderScreen.classList.add('entered');
      orderScreen.classList.remove('leaving');   // 复位渐隐
      stage = 0;
      topbar.classList.remove('open');
      stopAuto();
      // 离开封面即隐藏上滑提示
      if (hint) hint.classList.remove('show');
      // 触发一次 pkgbar 重渲染（若当前套餐与轮播套餐不一致）
      const s = slides[idx];
      if (s && window.__immersive_pkg_change) window.__immersive_pkg_change(s.pkg.id);
    };
    const exitMenu = () => {
      if (!inMenu) return;
      inMenu = false;
      orderScreen.classList.add('leaving');      // 渐隐回到封面
      cover.classList.remove('entered');
      orderScreen.classList.remove('entered');
      upStreak = 0;
      setTimeout(() => orderScreen.classList.remove('leaving'), 520);
      startAuto();
    };

    // 顶栏展开/收起（下拉两次：0→1→2）
    const applyStage = () => {
      topbar.classList.remove('s1', 's2');
      if (stage === 1) topbar.classList.add('s1');
      else if (stage === 2) topbar.classList.add('s2');
    };
    const openChrome = () => {
      if (stage < 2) { stage++; applyStage(); }
    };
    const closeChrome = () => {
      if (stage > 0) { stage = 0; applyStage(); }
    };

    // 提示文字：首次上滑显示，6 秒后渐隐
    const showHintOnce = () => {
      if (hint.classList.contains('show')) return;
      hint.classList.add('show');
      if (hintTimer) clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.remove('show'), 6000);
    };

    // 指针手势（封面）
    let sx = 0, sy = 0, sdx = 0, sdy = 0, st = 0, down = false, maxis = null, chromeClosed = false;
    const SWIPE = 70, SWIPE_X = 60;

    cover.addEventListener('pointerdown', (e) => {
      if (inMenu) return;
      // 顶栏内操作不收回
      if (topbar.contains(e.target)) return;
      down = true; chromeClosed = false;
      sx = e.clientX; sy = e.clientY; st = Date.now();
      sdx = 0; sdy = 0; maxis = null;
      cover.setPointerCapture(e.pointerId);
      stopAuto();
      // 顶栏展开时，点按封面其他位置收回，不触发进入菜单
      if (stage > 0 && !e.target.closest('.cover-dot, .cover-info, .cover-pin, .cover-hint, .cover-banquet, .cover-bs-menu')) {
        closeChrome();
        chromeClosed = true;
      }
    });
    cover.addEventListener('pointermove', (e) => {
      if (!down || inMenu) return;
      sdx = e.clientX - sx; sdy = e.clientY - sy;
      if (!maxis) {
        const ax = Math.abs(sdx), ay = Math.abs(sdy);
        if (ax > 10 || ay > 10) maxis = ax >= ay ? 'x' : 'y';
      }
      if (maxis === 'x') {
        e.preventDefault();
        track.style.transition = 'none';
        track.style.transform = `translateX(calc(${-idx * 100}% + ${sdx}px))`;
      }
    });
    const onCoverUp = (e) => {
      if (!down || inMenu) return;
      down = false;
      track.style.transition = '';
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (maxis === 'x') {
        if (dx < -SWIPE_X && Math.abs(dx) > Math.abs(dy)) goTo(idx + 1);
        else if (dx > SWIPE_X && Math.abs(dx) > Math.abs(dy)) goTo(idx - 1);
        else goTo(idx);
      } else if (maxis === 'y') {
        if (dy < -SWIPE) {
          // 上滑
          upStreak++;
          if (upStreak === 1) showHintOnce();
          else if (upStreak >= 2) { upStreak = 0; enterMenu(); }
        } else if (dy > SWIPE) {
          // 下拉
          upStreak = 0;
          openChrome();
        }
      } else if (!chromeClosed) {
        // 点击（无显著滑动，且不是刚收起顶栏）：进入菜单并切换到当前轮播套餐
        const isControl = e.target.closest('.cover-dot, .cover-info, .cover-pin, .cover-hint, .cover-banquet, .cover-bs-menu');
        if (!isControl) enterMenu();
      }
      maxis = null;
      startAuto();
    };
    cover.addEventListener('pointerup', onCoverUp);
    cover.addEventListener('pointercancel', () => {
      down = false; track.style.transition = ''; goTo(idx); maxis = null; startAuto();
    });

    // 圆点点击
    dots.addEventListener('click', (e) => {
      const d = e.target.closest('.cover-dot');
      if (d) { goTo(+d.dataset.i); stopAuto(); startAuto(); }
    });

    // 菜单层上滑返回
    let msx, msy, mdown = false;
    orderScreen.addEventListener('pointerdown', (e) => {
      if (!inMenu) return;
      mdown = true; msx = e.clientX; msy = e.clientY;
      orderScreen.setPointerCapture(e.pointerId);
    });
    orderScreen.addEventListener('pointermove', (e) => { if (!mdown) return; });
    orderScreen.addEventListener('pointerup', (e) => {
      if (!mdown) return;
      mdown = false;
      const dy = e.clientY - msy;
      if (dy < -SWIPE && orderScreen.querySelector('.content').scrollTop <= 0) exitMenu();
    });

    // 详情弹窗：下滑关闭（回菜单）；连续上滑两次回封面；停留 30s 自动回封面
    const modal = $('#modal');
    const modalGesture = $('#modalGesture');
    let dsx, dsy, ddown = false, dUpStreak = 0, dIdle = null, mgTimer = null;
    const resetDetailIdle = () => {
      if (dIdle) clearTimeout(dIdle);
      dIdle = setTimeout(() => {
        // 详情停留 30 秒无操作 → 自动回到封面
        if (!modal.hidden) {
          if (window.closeModal) window.closeModal();
          exitMenu();
        }
      }, 30000);
    };
    const stopDetailIdle = () => { if (dIdle) { clearTimeout(dIdle); dIdle = null; } };
    // 详情开关监听：打开即启动 30s，关闭即清除；并显示手势提示 6s
    const detailObserver = new MutationObserver(() => {
      if (modal.hidden) {
        stopDetailIdle();
        if (modalGesture) modalGesture.classList.remove('show');
      } else {
        dUpStreak = 0; resetDetailIdle();
        if (modalGesture) {
          modalGesture.classList.add('show');
          if (mgTimer) clearTimeout(mgTimer);
          mgTimer = setTimeout(() => modalGesture.classList.remove('show'), 6000);
        }
      }
    });
    detailObserver.observe(modal, { attributes: true, attributeFilter: ['hidden'] });

    modal.addEventListener('pointerdown', (e) => {
      ddown = true; dsx = e.clientX; dsy = e.clientY;
      resetDetailIdle();   // 任意交互重置 30s
      if (mgTimer) clearTimeout(mgTimer);
      if (modalGesture) modalGesture.classList.remove('show');   // 用户已交互，隐藏手势提示
      modal.setPointerCapture(e.pointerId);
    });
    modal.addEventListener('pointerup', (e) => {
      if (!ddown) return;
      ddown = false;
      const dy = e.clientY - dsy, dx = e.clientX - dsx;
      if (dy > SWIPE && Math.abs(dy) > Math.abs(dx)) {
        // 下滑关闭详情（回到菜单）
        const close = modal.querySelector('.modal-close');
        if (close) close.click();
      } else if (dy < -SWIPE && Math.abs(dy) > Math.abs(dx)) {
        // 上滑：连续两次回到封面
        dUpStreak++;
        if (dUpStreak >= 2) {
          dUpStreak = 0;
          if (window.closeModal) window.closeModal();
          exitMenu();
        }
      } else {
        resetDetailIdle();
      }
    });

    // 监听宴席/套餐变化（通过 MutationObserver，因为 app.js 函数在 IIFE 内）
    const bsObserver = new MutationObserver(() => {
      buildSlides();
      pin.textContent = currentBanquetName();
    });
    const bsName = $('#bsCurrentName');
    if (bsName) bsObserver.observe(bsName, { childList: true, subtree: true, characterData: true });

    // 封面常驻宴席切换（避免被收起顶栏藏住入口）
    const coverBanquetWrap = $('#coverBanquetWrap');
    const coverBanquetBtn = $('#coverBanquetBtn');
    const coverBsMenu = $('#coverBsMenu');
    const coverBanquetName = $('#coverBanquetName');
    if (coverBanquetBtn && coverBsMenu) {
      const buildCoverBs = () => {
        const cur = currentBanquetName();
        const list = (Store.BANQUETS || []).filter((b) => {
          const m = Store.STATE.menu && Store.STATE.menu[b.id];
          return m && Array.isArray(m.packages) && m.packages.length > 0;
        });
        coverBsMenu.innerHTML = list.map(
          (b) => `<li class="cover-bs-item ${b.name === cur ? 'on' : ''}" data-b="${b.id}">${b.name}</li>`
        ).join('');
        if (coverBanquetName) coverBanquetName.textContent = cur;
      };
      buildCoverBs();
      coverBanquetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        coverBsMenu.hidden = !coverBsMenu.hidden;
      });
      coverBsMenu.addEventListener('click', (e) => {
        const li = e.target.closest('.cover-bs-item');
        if (!li) return;
        if (window.setBanquet) window.setBanquet(li.dataset.b);
        coverBsMenu.hidden = true;
      });
      document.addEventListener('click', (e) => {
        if (coverBanquetWrap && !coverBanquetWrap.contains(e.target)) coverBsMenu.hidden = true;
      });
      // 宴席变化后刷新封面下拉高亮
      if (bsName) new MutationObserver(buildCoverBs).observe(bsName, { childList: true, subtree: true, characterData: true });
    }

    // 监听套餐档位条变化，同步轮播当前页
    const pkgObserver = new MutationObserver(() => {
      const active = $('#pkgbar .chip.on');
      if (!active) return;
      const i = slides.findIndex((s) => s.pkg.id === active.dataset.p);
      if (i >= 0 && i !== idx) goTo(i);
    });
    const pkgbar = $('#pkgbar');
    if (pkgbar) pkgObserver.observe(pkgbar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // 给 pkgbar 增加一个 hook：点击 chip 时同步进入菜单（如果还没进入）
    pkgbar.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      if (!inMenu) enterMenu();
    });

    // 暴露套餐切换钩子给 app.js 的深链/外部调用（通过事件）
    window.__immersive_pkg_change = (pkgId) => {
      const i = slides.findIndex((s) => s.pkg.id === pkgId);
      if (i >= 0) goTo(i);
    };

    // 右侧抽屉：点击抽屉以外的遮罩即回到主菜单；编辑内容由各模块实时保存。
    let backdrop = document.getElementById('padBackdrop');
    const appRoot = document.querySelector('.app');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'padBackdrop';
      backdrop.className = 'pad-backdrop';
      backdrop.innerHTML = '<span class="pad-backdrop-tip">点击空白处退出定制</span>';
      // 必须放入 .app：外部 body 的遮罩会跨过 app 的层叠上下文，压住右侧抽屉并吞掉点击。
      (appRoot || document.body).appendChild(backdrop);
    } else if (appRoot && backdrop.parentElement !== appRoot) {
      // 兼容热更新/旧页面已创建在 body 下的遮罩。
      appRoot.appendChild(backdrop);
    }
    const customScreen = $('#customScreen');
    const manageScreen = $('#manageScreen');
    const syncBackdrop = () => {
      const open = ((customScreen && !customScreen.hidden) || (manageScreen && !manageScreen.hidden)) && document.body.classList.contains('shell-pad');
      backdrop.classList.toggle('show', !!open);
    };
    if (customScreen) new MutationObserver(syncBackdrop).observe(customScreen, { attributes: true, attributeFilter: ['hidden'] });
    if (manageScreen) new MutationObserver(syncBackdrop).observe(manageScreen, { attributes: true, attributeFilter: ['hidden'] });
    backdrop.addEventListener('click', () => { if (window.setMode) window.setMode('order'); });
    syncBackdrop();

    // 抽屉「完成」按钮（定制 / 管理）
    const csDone = $('#csDone');
    if (csDone) csDone.addEventListener('click', () => { if (window.setMode) window.setMode('order'); });
    const mgDone = $('#mgDone');
    if (mgDone) mgDone.addEventListener('click', () => { if (window.setMode) window.setMode('order'); });

    // 抽屉左滑关闭手势（定制 / 管理 / 设置）
    const addDrawerSwipe = (el) => {
      if (!el) return;
      let sx = 0, sy = 0, down = false;
      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button,input,select,textarea,.modal-card,.mg-list,.cs-body,.edit-card')) return;
        down = true; sx = e.clientX; sy = e.clientY;
      });
      el.addEventListener('pointerup', (e) => {
        if (!down) return; down = false;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (dx < -80 && Math.abs(dx) > Math.abs(dy)) {
          if (el.id === 'settingsModal') {
            const c = el.querySelector('.modal-close'); if (c) c.click();
          } else if (window.setMode) {
            window.setMode('order');
          }
        }
      });
    };
    addDrawerSwipe($('#customScreen'));
    addDrawerSwipe($('#manageScreen'));
    addDrawerSwipe($('#settingsModal'));

    // 首次进入手势引导（写入 localStorage 不再弹，可跳过）
    const onboard = $('#onboard');
    if (onboard && !localStorage.getItem('ss_pad_onboard')) {
      const steps = [
        { t: '上滑 / 点按封面', d: '进入菜单浏览菜品' },
        { t: '下拉顶栏', d: '切换宴席 · 点菜 / 管理模式' },
        { t: '详情上滑两次回封面', d: '点空白处退出定制菜单' },
      ];
      let oi = 0;
      const oStep = $('#onboardStep'), oDots = $('#onboardDots'), oNext = $('#onboardNext'), oSkip = $('#onboardSkip');
      const renderO = () => {
        if (oStep) oStep.innerHTML = `<div class="onboard-ico">${oi + 1}</div><div class="onboard-t">${steps[oi].t}</div><div class="onboard-d">${steps[oi].d}</div>`;
        if (oDots) oDots.innerHTML = steps.map((_, k) => `<span class="onboard-dot ${k === oi ? 'on' : ''}"></span>`).join('');
        if (oNext) oNext.textContent = oi === steps.length - 1 ? '开始体验' : '下一步';
      };
      onboard.hidden = false;
      stopAuto();
      renderO();
      if (oNext) oNext.addEventListener('click', () => {
        if (oi < steps.length - 1) { oi++; renderO(); }
        else { onboard.hidden = true; localStorage.setItem('ss_pad_onboard', '1'); startAuto(); }
      });
      if (oSkip) oSkip.addEventListener('click', () => {
        onboard.hidden = true; localStorage.setItem('ss_pad_onboard', '1'); startAuto();
      });
    }

    // 初始构建
    buildSlides();
    startAuto();

    // 上滑提示默认隐藏（仅首次上滑后显示，6 秒渐隐）
    if (hint) hint.classList.remove('show');
    // 宴席选择默认折叠
    const bsMenuEl = $('#bsMenu');
    if (bsMenuEl) bsMenuEl.hidden = true;

    // 隐藏占位
    cover.removeAttribute('aria-hidden');
  };
})();
