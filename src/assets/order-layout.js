(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var workspace = document.getElementById('previewWorkspace');
    var collapse = document.getElementById('previewCollapse');
    var pkgbar = document.getElementById('pkgbar');
    var hero = document.getElementById('hero');
    var list = document.getElementById('list');
    var title = document.getElementById('previewStageTitle');
    var stagePrice = document.getElementById('previewStagePrice');
    var stageCount = document.getElementById('previewStageCount');
    var prev = document.getElementById('previewPrev');
    var next = document.getElementById('previewNext');
    var banquetTitle = document.getElementById('previewBanquetTitle');
    var banquetMenu = document.getElementById('bsMenu');
    var banquetCurrent = document.getElementById('bsCurrentName');
    var stage = document.querySelector('.preview-stage');
    var packageStack = document.querySelector('.preview-package-stack');
    if (!workspace || !collapse || !pkgbar || !hero || !list) return;

    var packageSelection = document.createElement('div');
    packageSelection.className = 'preview-package-selection';
    packageSelection.setAttribute('aria-hidden', 'true');
    packageStack.appendChild(packageSelection);

    var layoutFrame = 0;

    function reducedMotion() {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function syncPackageLayout() {
      layoutFrame = 0;
      var chips = Array.prototype.slice.call(pkgbar.querySelectorAll('.chip'));
      if (!chips.length) return;
      var activeIndex = Math.max(0, chips.findIndex(function (chip) { return chip.classList.contains('on'); }));
      chips.forEach(function (chip, index) {
        chip.style.order = String(index * 2);
      });
      hero.style.order = String(activeIndex * 2 + 1);
      var active = chips[activeIndex];
      if (active && title) {
        var name = active.querySelector('.chip-name');
        title.textContent = name ? name.textContent : '宴席菜品';
        var price = active.querySelector('.chip-price');
        if (stagePrice) stagePrice.textContent = price ? price.textContent.replace(/\s+/g, '') : '—';
        var count = hero.querySelector('.hero-sub');
        if (stageCount) stageCount.textContent = count ? count.textContent.replace(/^共\s*/, '').replace(/经典菜品$/, '') : '—';
      }
      requestAnimationFrame(function () { updatePackageSelection(active); });
    }

    function updatePackageSelection(active) {
      active = active || pkgbar.querySelector('.chip.on');
      if (!active || !packageStack) { packageSelection.style.opacity = '0'; return; }
      var stackRect = packageStack.getBoundingClientRect();
      var chipRect = active.getBoundingClientRect();
      packageSelection.style.width = chipRect.width + 'px';
      packageSelection.style.height = chipRect.height + 'px';
      packageSelection.style.transform = 'translate(' + (chipRect.left - stackRect.left) + 'px,' + (chipRect.top - stackRect.top) + 'px)';
      packageSelection.style.opacity = '1';
    }

    function scheduleLayout() {
      if (layoutFrame) cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(syncPackageLayout);
    }

    function setCollapsed(collapsed) {
      workspace.classList.toggle('is-collapsed', collapsed);
      collapse.setAttribute('aria-expanded', String(!collapsed));
      collapse.setAttribute('aria-label', collapsed ? '展开套餐面板' : '折叠套餐面板');
      requestAnimationFrame(function () {
        updatePackageSelection();
        window.dispatchEvent(new Event('resize'));
      });
      window.setTimeout(function () { updatePackageSelection(); }, 620);
    }

    collapse.addEventListener('click', function () {
      setCollapsed(!workspace.classList.contains('is-collapsed'));
    });

    /* 菜单类型入口迁移到左侧标题：长按标题打开原 #bsMenu，仍复用主应用切换逻辑。 */
    if (banquetTitle && banquetMenu) {
      document.querySelector('.preview-side-head').appendChild(banquetMenu);
      var banquetPressTimer = 0;
      var banquetStartX = 0;
      var banquetStartY = 0;

      function syncBanquetTitle() {
        var name = banquetCurrent && banquetCurrent.textContent ? banquetCurrent.textContent.trim() : '婚宴';
        banquetTitle.textContent = name + '菜单';
      }
      function openBanquetMenu() {
        clearTimeout(banquetPressTimer);
        banquetPressTimer = 0;
        banquetTitle.classList.remove('is-pressing');
        banquetMenu.hidden = false;
        banquetTitle.setAttribute('aria-expanded', 'true');
      }
      function cancelBanquetPress() {
        if (banquetPressTimer) clearTimeout(banquetPressTimer);
        banquetPressTimer = 0;
        banquetTitle.classList.remove('is-pressing');
      }
      banquetTitle.addEventListener('pointerdown', function (event) {
        banquetStartX = event.clientX;
        banquetStartY = event.clientY;
        banquetTitle.classList.add('is-pressing');
        banquetPressTimer = window.setTimeout(openBanquetMenu, 520);
      });
      banquetTitle.addEventListener('pointermove', function (event) {
        if (Math.abs(event.clientX - banquetStartX) > 10 || Math.abs(event.clientY - banquetStartY) > 10) cancelBanquetPress();
      });
      banquetTitle.addEventListener('pointerup', cancelBanquetPress);
      banquetTitle.addEventListener('pointercancel', cancelBanquetPress);
      banquetTitle.addEventListener('pointerleave', cancelBanquetPress);
      banquetTitle.addEventListener('click', function (event) { event.stopPropagation(); });
      banquetTitle.addEventListener('contextmenu', function (event) { event.preventDefault(); event.stopPropagation(); openBanquetMenu(); });
      banquetTitle.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        openBanquetMenu();
      });
      var replayingBanquetClick = false;
      var pendingBanquetClick = 0;
      banquetMenu.addEventListener('click', function (event) {
        var item = event.target.closest('.bs-item');
        if (!item) return;
        if (replayingBanquetClick) { replayingBanquetClick = false; return; }
        if (item.classList.contains('on') || reducedMotion()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (pendingBanquetClick) clearTimeout(pendingBanquetClick);
        if (stage) stage.classList.add('is-switching-out');
        pendingBanquetClick = window.setTimeout(function () {
          pendingBanquetClick = 0;
          if (!item.isConnected) return;
          replayingBanquetClick = true;
          item.click();
          if (stage) {
            stage.classList.remove('is-switching-out', 'is-switching-in');
            void list.offsetWidth;
            stage.classList.add('is-switching-in');
            window.setTimeout(function () { stage.classList.remove('is-switching-in'); }, 360);
          }
        }, 260);
      }, true);
      banquetMenu.addEventListener('click', function () {
        requestAnimationFrame(function () {
          syncBanquetTitle();
          banquetTitle.setAttribute('aria-expanded', 'false');
        });
      });
      new MutationObserver(syncBanquetTitle).observe(banquetCurrent, { childList: true, characterData: true, subtree: true });
      document.addEventListener('click', function (event) {
        if (banquetMenu.hidden || banquetTitle.contains(event.target) || banquetMenu.contains(event.target)) return;
        banquetMenu.hidden = true;
        banquetTitle.setAttribute('aria-expanded', 'false');
      });
      syncBanquetTitle();
    }

    /* 展开/折叠状态共用此点击链路：套餐平移动效与右侧淡出/淡入不得分叉。 */
    var replayingPackageClick = false;
    var pendingPackageClick = 0;
    pkgbar.addEventListener('click', function (event) {
      var chip = event.target.closest('.chip');
      if (!chip) return;
      if (replayingPackageClick) {
        replayingPackageClick = false;
        if (stage) {
          stage.classList.remove('is-switching-out', 'is-switching-in');
          void list.offsetWidth;
          stage.classList.add('is-switching-in');
          window.setTimeout(function () { stage.classList.remove('is-switching-in'); }, 360);
        }
        return;
      }
      if (chip.classList.contains('on') || reducedMotion()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pendingPackageClick) clearTimeout(pendingPackageClick);
      var currentChip = pkgbar.querySelector('.chip.on');
      if (currentChip) currentChip.classList.remove('on');
      chip.classList.add('on');
      updatePackageSelection(chip);
      if (stage) {
        stage.classList.remove('is-switching-out', 'is-switching-in');
        void list.offsetWidth;
        stage.classList.add('is-switching-out');
      }
      pendingPackageClick = window.setTimeout(function () {
        pendingPackageClick = 0;
        if (!chip.isConnected) return;
        replayingPackageClick = true;
        chip.click();
      }, 260);
    }, true);

    var packageObserver = new MutationObserver(scheduleLayout);
    packageObserver.observe(pkgbar, { childList: true });
    var heroObserver = new MutationObserver(function () {
      hero.style.animation = 'none';
      void hero.offsetWidth;
      hero.style.animation = '';
    });
    heroObserver.observe(hero, { childList: true });

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { updatePackageSelection(); }).observe(packageStack);
    }
    window.addEventListener('resize', function () { updatePackageSelection(); });

    /* 菜单详情与菜品库编辑共用“从点击源展开、关闭回到源位置”的空间动效。 */
    var sharedSources = { modal: null, editModal: null };
    document.addEventListener('click', function (event) {
      var orderCard = event.target.closest('#list .card');
      if (orderCard) sharedSources.modal = { element: orderCard, rect: orderCard.getBoundingClientRect() };
      var libCard = event.target.closest('#mgLibList .lib-card');
      if (libCard && !event.target.closest('[data-libdel], [data-name]')) {
        sharedSources.editModal = { element: libCard, rect: libCard.getBoundingClientRect() };
      }
    }, true);

    function sourceRectFor(modalId) {
      var source = sharedSources[modalId];
      if (!source) return null;
      if (source.element && source.element.isConnected) return source.element.getBoundingClientRect();
      return source.rect;
    }

    function sharedFrames(sourceRect, targetRect) {
      var scaleX = Math.max(.12, Math.min(1, sourceRect.width / Math.max(1, targetRect.width)));
      var scaleY = Math.max(.12, Math.min(1, sourceRect.height / Math.max(1, targetRect.height)));
      return {
        from: { opacity: .3, transform: 'translate(' + (sourceRect.left - targetRect.left) + 'px,' + (sourceRect.top - targetRect.top) + 'px) scale(' + scaleX + ',' + scaleY + ')' },
        to: { opacity: 1, transform: 'translate(0,0) scale(1,1)' }
      };
    }

    function animateSharedOpen(modalEl) {
      if (reducedMotion() || typeof modalEl.animate !== 'function') return;
      var sourceRect = sourceRectFor(modalEl.id);
      var card = modalEl.querySelector('.modal-card');
      if (!sourceRect || !card) return;
      requestAnimationFrame(function () {
        if (card.getAnimations) card.getAnimations().forEach(function (animation) { animation.cancel(); });
        if (modalEl.getAnimations) modalEl.getAnimations().forEach(function (animation) { animation.cancel(); });
        var targetRect = card.getBoundingClientRect();
        var frames = sharedFrames(sourceRect, targetRect);
        card.animate([frames.from, frames.to], { duration: 460, easing: 'cubic-bezier(.22,.72,.28,1)', fill: 'both' });
        modalEl.animate([{ backgroundColor: 'rgba(42,31,24,0)', backdropFilter: 'blur(0px)' }, { backgroundColor: 'rgba(42,31,24,.34)', backdropFilter: 'blur(12px)' }], { duration: 300, easing: 'ease-out' });
      });
    }

    function animateSharedClose(modalEl) {
      if (!modalEl || modalEl.hidden || modalEl.dataset.sharedClosing === '1') return;
      var card = modalEl.querySelector('.modal-card');
      var sourceRect = sourceRectFor(modalEl.id);
      if (!card || !sourceRect || reducedMotion() || typeof card.animate !== 'function') {
        modalEl.hidden = true;
        return;
      }
      modalEl.dataset.sharedClosing = '1';
      if (card.getAnimations) card.getAnimations().forEach(function (animation) { animation.cancel(); });
      if (modalEl.getAnimations) modalEl.getAnimations().forEach(function (animation) { animation.cancel(); });
      var targetRect = card.getBoundingClientRect();
      var frames = sharedFrames(sourceRect, targetRect);
      var cardAnimation = card.animate([frames.to, frames.from], { duration: 400, easing: 'cubic-bezier(.4,0,.25,1)', fill: 'both' });
      var modalAnimation = modalEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: 'ease-in', fill: 'both' });
      Promise.resolve(cardAnimation.finished).catch(function () {}).then(function () {
        modalEl.hidden = true;
        modalEl.style.opacity = '';
        cardAnimation.cancel();
        modalAnimation.cancel();
        delete modalEl.dataset.sharedClosing;
        if (modalEl.id === 'modal') {
          var app = document.querySelector('.app');
          if (app) app.classList.remove('chrome-hidden');
        }
      });
    }

    ['modal', 'editModal'].forEach(function (id) {
      var modalEl = document.getElementById(id);
      if (!modalEl) return;
      new MutationObserver(function () { if (!modalEl.hidden) animateSharedOpen(modalEl); }).observe(modalEl, { attributes: true, attributeFilter: ['hidden'] });
    });

    document.addEventListener('click', function (event) {
      var modalEl = null;
      if (!document.getElementById('modal').hidden && (event.target.id === 'modal' || event.target.closest('#modal .modal-close'))) modalEl = document.getElementById('modal');
      if (!document.getElementById('editModal').hidden && (event.target.id === 'editModal' || event.target.closest('[data-close="editModal"]'))) modalEl = document.getElementById('editModal');
      if (!modalEl || !sourceRectFor(modalEl.id)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      animateSharedClose(modalEl);
    }, true);

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var modalEl = !document.getElementById('editModal').hidden ? document.getElementById('editModal') : (!document.getElementById('modal').hidden ? document.getElementById('modal') : null);
      if (!modalEl || !sourceRectFor(modalEl.id)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      animateSharedClose(modalEl);
    }, true);

    scheduleLayout();
  });
})();
