/* 山水S酒店 · 定制单（宴席定制报价单）
 * 纯内存草案：从当前点菜端选中的宴席/套餐克隆菜品，可换菜、加备注、改总价，
 * 导出带缩略图版 / 无图版（PNG / SVG）。不回写菜品库或标准菜单。
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // 分类与品牌名均数据驱动：优先读取 Store 的配置（运营可在设置中维护），
  // 兜底回退到默认三分类，保证菜单未初始化时导出不报错。
  function cats() {
    return (typeof Store !== 'undefined' && Store.CATEGORIES && Store.CATEGORIES.length) ? Store.CATEGORIES : ['凉菜', '主菜', '主食点心'];
  }
  function cnNum(i) { return ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'][i] || (i + 1); }
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  // 解析当前皮肤的图片占位底色令牌（M2：避免硬编码导致非默认皮肤错位；导出取具体值）
  var resolveImgBg = function () {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--img-bg');
      return (v && v.trim()) ? v.trim() : '#EDE4D3';
    } catch (e) { return '#EDE4D3'; }
  };

  // —— 裁剪背景（自包含兜底；运行时优先复用 assets/app.js 的 window.cropBgStyle 单一真相源，保证展示/导出一致）——
  function cropBgStyle(d) {
    var c = d && d.crop ? d.crop : null;
    if (c && typeof c.w === 'number') {
      var w = clamp(c.w, 0.05, 1), h = clamp((typeof c.h === 'number' ? c.h : w * 0.75), 0.05, 1);
      var x = clamp(c.x, 0, 1 - w), y = clamp(c.y, 0, 1 - h);
      var sizeW = (100 / w).toFixed(3), sizeH = (100 / h).toFixed(3);
      var posX = (1 - w < 1e-4) ? '0' : (x / (1 - w) * 100).toFixed(2);
      var posY = (1 - h < 1e-4) ? '0' : (y / (1 - h) * 100).toFixed(2);
      return 'background-image:url(\'' + d.image + '\');background-size:' + sizeW + '% ' + sizeH + '%;background-position:' + posX + '% ' + posY + '%;background-repeat:no-repeat;background-color:var(--img-bg);';
    }
    var y = (c && typeof c.y === 'number') ? c.y : 50;
    return 'background-image:url(\'' + (d.image || '') + '\');background-size:cover;background-position:50% ' + y + '%;background-repeat:no-repeat;background-color:var(--img-bg);';
  }
  // 优先复用 assets/app.js 的 window.cropBgStyle 单一真相源；独立/无 app.js 环境保留自包含实现（H1 去重）
  if (typeof window !== 'undefined' && typeof window.cropBgStyle === 'function') cropBgStyle = window.cropBgStyle;

  // —— 品牌徽标（导出用）：跟随「设置」里上传的 LOGO 及其裁剪，无则回退红底白 "S" ——
  // 与 assets/app.js 的 logoBgStyle 同源：crop = {x,y,w,h} 归一化矩形（x/y 左上角占比，w/h 宽高占比）。
  function brandMarkSvg(mx, my, size, radius, m, C, FS) {
    var logo = '', cropStr = '';
    try { logo = localStorage.getItem('ss_brand_logo') || ''; } catch (e) {}
    try { cropStr = localStorage.getItem('ss_brand_logo_crop') || ''; } catch (e) {}
    var crop = null;
    if (cropStr) { try { crop = JSON.parse(cropStr); } catch (e) {} }
    var parts = [];
    if (logo) {
      // 有 LOGO：透明底 + 圆形裁切（与设置页圆心截图框一致），不画白底矩形
      var ccx = mx + size / 2, ccy = my + size / 2, cr = size / 2;
      var cid = 'brandmark_' + Math.round(mx) + '_' + Math.round(my);
      parts.push('<clipPath id="' + cid + '"><circle cx="' + m(ccx) + '" cy="' + m(ccy) + '" r="' + m(cr) + '"/></clipPath>');
      if (crop && typeof crop.w === 'number' && crop.w > 0) {
        var cw = clamp(crop.w, 0.05, 1), ch = clamp((typeof crop.h === 'number' ? crop.h : cw), 0.05, 1);
        var cx = clamp(crop.x || 0, 0, 1 - cw), cy = clamp(crop.y || 0, 0, 1 - ch);
        var iw = size / cw, ih = size / ch;
        var ix = mx - cx * iw, iy2 = my - cy * ih;
        parts.push('<g clip-path="url(#' + cid + ')"><image href="' + logo + '" xlink:href="' + logo + '" x="' + m(ix) + '" y="' + m(iy2) + '" width="' + m(iw) + '" height="' + m(ih) + '" preserveAspectRatio="none"/></g>');
      } else {
        parts.push('<g clip-path="url(#' + cid + ')"><image href="' + logo + '" xlink:href="' + logo + '" x="' + m(mx) + '" y="' + m(my) + '" width="' + m(size) + '" height="' + m(size) + '" preserveAspectRatio="xMidYMid slice"/></g>');
      }
    } else {
      parts.push('<rect x="' + m(mx) + '" y="' + m(my) + '" width="' + m(size) + '" height="' + m(size) + '" rx="' + m(radius) + '" fill="' + C.primary + '"/>');
      parts.push('<text x="' + m(mx + size / 2) + '" y="' + m(my + size * 0.73) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(size * 0.62) + '" font-weight="700" fill="#fff">S</text>');
    }
    return parts.join('');
  }

  // —— 草案（纯内存）——
  var draft = null;
  var DRAFT_KEY = 'ss_custom_order_draft_v1';
  // draft.lines: [{ id, libId, cat, cn, en, image, crop, note, swappedFrom }]

  function saveDraft() {
    if (!draft) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) {}
  }
  function loadDraft(banquetId, pkgId) {
    try {
      var saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (saved && saved.banquetId === banquetId && saved.pkgId === pkgId && Array.isArray(saved.lines)) return saved;
    } catch (e) {}
    return null;
  }
  function syncDraftHeader() {
    if (!draft) return;
    var t = $('#csType'), c = $('#csClient'), src = $('#csSource'), tot = $('#csTotal'), base = $('#csCalcBase');
    if (t) t.value = draft.type || '';
    if (c) c.value = draft.client || '';
    if (src) src.textContent = '来源：' + (draft.source || '—');
    if (tot) tot.value = '';
    if (base) base.value = draft.total || '0';
  }

  function newLineId() { return 'L' + Math.random().toString(36).slice(2, 9); }

  function enter(banquetId, pkgId) {
    if (!Store || !Store.resolvePackage) return;
    if (draft && draft.banquetId === banquetId && draft.pkgId === pkgId) { syncDraftHeader(); render(); return; }
    var restored = loadDraft(banquetId, pkgId);
    if (restored) { draft = restored; syncDraftHeader(); render(); return; }
    var b = Store.getBanquet(banquetId);
    var pkg = Store.getPackage(banquetId, pkgId);
    var dishes = Store.resolvePackage(banquetId, pkgId) || [];
    var pkgPrice = (pkg && typeof pkg.price !== 'undefined') ? String(pkg.price) : '';
    draft = {
      banquetId: banquetId,
      pkgId: pkgId,
      type: (b && b.name) ? b.name : '宴席',
      client: '',
      total: pkgPrice,
      basePrice: pkgPrice,   // 套餐原价，用于总厨单显示价格变化
      source: pkg ? (pkg.name || pkgId) : '',
      originalLines: [],
      removedLines: [],
      lines: dishes.map(function (d, i) {
        return {
          id: newLineId(),
          libId: d.id || null,
          cat: d.cat || '主菜',
          cn: d.cn || '',
          en: d.en || '',
          image: d.image || null,
          crop: d.crop || null,
          note: '',
          swappedFrom: null,    // 换菜前的菜品库 id（truthy 表示该行是换菜）
          swappedFromCn: null,  // 换菜前的菜名（导出总厨单用）
          added: false          // 由「＋ 添加菜品」新增
        };
      })
    };
    draft.originalLines = draft.lines.map(function (l) { return Object.assign({}, l, { crop: l.crop ? Object.assign({}, l.crop) : null }); });
    saveDraft();
    syncDraftHeader();
    render();
  }

  function render() {
    var body = $('#csBody');
    if (!body || !draft) return;
    body.innerHTML = '';
    var hasAny = false;
    cats().forEach(function (cat) {
      var lines = draft.lines.filter(function (l) { return l.cat === cat; });
      if (!lines.length) return;
      hasAny = true;
      var group = document.createElement('div');
      group.className = 'cs-group';
      group.setAttribute('data-cat', cat);

      var title = document.createElement('div');
      title.className = 'cs-group-title';
      title.innerHTML = '<span class="cs-gt-tick"></span>' + cat;
      group.appendChild(title);

      var rows = document.createElement('div');
      rows.className = 'cs-rows';
      lines.forEach(function (l) {
        var row = document.createElement('div');
        row.className = 'cs-row';
        row.setAttribute('data-id', l.id);

        var thumb = document.createElement('div');
        thumb.className = 'cs-thumb';
        if (l.image) {
          var img = document.createElement('div');
          img.className = 'cropimg';
          img.setAttribute('style', cropBgStyle(l));
          thumb.appendChild(img);
        } else {
          thumb.classList.add('cs-noimg');
          thumb.textContent = '无图';
        }

        var main = document.createElement('div');
        main.className = 'cs-row-main';
        var cn = document.createElement('div');
        cn.className = 'cs-row-cn';
        cn.textContent = l.cn || '未命名菜品';
        var note = document.createElement('input');
        note.className = 'cs-row-note';
        note.type = 'text';
        note.placeholder = '备注（如：免辣 / 换汤）';
        note.maxLength = 40;
        note.value = l.note || '';
        main.appendChild(cn);
        main.appendChild(note);

        var acts = document.createElement('div');
        acts.className = 'cs-row-acts';
        var swap = document.createElement('button');
        swap.type = 'button';
        swap.className = 'cs-act';
        swap.setAttribute('data-act', 'swap');
        swap.textContent = '换菜';
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'cs-act cs-act-del';
        del.setAttribute('data-act', 'del');
        del.setAttribute('aria-label', '移除');
        del.textContent = '✕';
        acts.appendChild(swap);
        acts.appendChild(del);

        row.appendChild(thumb);
        row.appendChild(main);
        row.appendChild(acts);
        rows.appendChild(row);
      });
      group.appendChild(rows);
      body.appendChild(group);
    });
    if (!hasAny) {
      var empty = document.createElement('div');
      empty.className = 'cs-empty';
      empty.textContent = '当前套餐没有菜品，点下方「＋ 添加菜品」从菜品库选取。';
      body.appendChild(empty);
    }
  }

  // —— 选择器（换菜 / 添加）：列出菜品库 ——
  var pickMode = null; // { onPick: fn, excludeId: string|null(换菜时排除当前行) }
  function openPick(onPick, excludeId) {
    pickMode = { onPick: onPick, excludeId: excludeId || null };
    var grid = $('#csPickGrid');
    if (grid) { grid.innerHTML = ''; renderPick('', ''); }
    var cat = $('#csPickCat'); if (cat) cat.value = '';
    var search = $('#csPickSearch'); if (search) search.value = '';
    var modal = $('#customPickModal');
    if (modal) modal.hidden = false;
  }

  function renderPick(cat, q) {
    var grid = $('#csPickGrid');
    if (!grid || !Store) return;
    var lib = Store.LIBRARY || [];
    var ql = (q || '').trim().toLowerCase();
    var list = lib.filter(function (d) {
      if (cat && d.cat !== cat) return false;
      if (ql && (d.cn || '').toLowerCase().indexOf(ql) < 0 && (d.en || '').toLowerCase().indexOf(ql) < 0) return false;
      return true;
    });
    grid.innerHTML = '';
    if (!list.length) {
      var e = document.createElement('div');
      e.className = 'cs-pick-empty';
      e.textContent = '没有匹配的菜品';
      grid.appendChild(e);
      return;
    }
    list.forEach(function (d) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'cs-pick-card';
      card.setAttribute('data-libid', d.id);
      var thumb = document.createElement('div');
      thumb.className = 'cs-pick-thumb';
      if (d.image) {
        var img = document.createElement('div');
        img.className = 'cropimg';
        img.setAttribute('style', cropBgStyle(d));
        thumb.appendChild(img);
      } else {
        thumb.classList.add('cs-noimg');
        thumb.textContent = '无图';
      }
      var meta = document.createElement('div');
      meta.className = 'cs-pick-meta';
      var cn = document.createElement('div');
      cn.className = 'cs-pick-cn';
      cn.textContent = d.cn || '未命名';
      var catL = document.createElement('div');
      catL.className = 'cs-pick-cat';
      catL.textContent = d.cat || '';
      meta.appendChild(cn);
      meta.appendChild(catL);
      card.appendChild(thumb);
      card.appendChild(meta);
      grid.appendChild(card);
    });
  }

  function closePick() {
    var m = $('#customPickModal');
    if (m) m.hidden = true;
    pickMode = null;
  }

  function applyLibDish(line, d) {
    line.libId = d.id;
    line.cat = d.cat || '主菜';
    line.cn = d.cn || '';
    line.en = d.en || '';
    line.image = d.image || null;
    line.crop = d.crop || null;
  }

  function findLine(id) {
    return draft ? draft.lines.filter(function (l) { return l.id === id; })[0] : null;
  }

  // —— 导出 ——
  var expFmt = 'png';
  var expPurpose = 'original';
  var expLayout = 'A';
  var expSize = 'a4';
  // 品牌名（从设置读取，fallback 默认值）
  function getBrandName() {
    try {
      if (typeof Store !== 'undefined' && Store.TENANT && Store.TENANT.name) return Store.TENANT.name;
      return localStorage.getItem('ss_brand_name') || '山水S酒店';
    } catch (e) { return '山水S酒店'; }
  }
  function getExpVer() {
    var r = document.querySelector('input[name="expVer"]:checked');
    return r ? r.value : 'thumb';
  }

  function getExportLines() {
    if (!draft) return [];
    return expPurpose === 'original' && draft.originalLines ? draft.originalLines : draft.lines;
  }

  function getExportTitle() {
    if (expPurpose === 'chef') return '厨房报价变更单';
    if (expPurpose === 'updated') return '宴席菜单 · 更新版';
    return '宴席菜单 · 原始版';
  }

  // 去重：检查 libId 是否已在草案中（excludeId 排除当前行，用于换菜场景）
  function isDuplicate(libId, excludeId) {
    if (!libId || !draft) return false;
    return draft.lines.some(function (l) { return l.libId === libId && l.id !== excludeId; });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  // —— 字体族（与 UIUX 手册一致）——
  // 双引号写成 &quot;：buildSVG 拼进 font-family="..." 属性，SVG 按 XML 解析（rasterize 路径），
  // 未转义的引号会让整个 SVG 加载失败 → 导出报"导出失败"。
  var FONT_SERIF = '&quot;Noto Serif SC&quot;, &quot;Songti SC&quot;, &quot;STSong&quot;, &quot;SimSun&quot;, serif';
  var FONT_SANS = '-apple-system, &quot;PingFang SC&quot;, &quot;Microsoft YaHei&quot;, &quot;Helvetica Neue&quot;, sans-serif';

  // cover 算法：图片按 preserveAspectRatio 等价于 cover + 任意百分比定位
  // px, py: 0-1（CSS background-position 50%/y% 中的 50/y 归一化）
  function coverRect(imgW, imgH, boxW, boxH, px, py) {
    if (!imgW || !imgH) return null;
    var rImg = imgW / imgH, rBox = boxW / boxH;
    var drawW, drawH, x, y;
    if (rImg > rBox) {
      drawH = boxH; drawW = boxH * rImg;
      x = (boxW - drawW) * px; y = 0;
    } else {
      drawW = boxW; drawH = boxW / rImg;
      x = 0; y = (boxH - drawH) * py;
    }
    return { x: x, y: y, w: drawW, h: drawH };
  }

  // 缩略图渲染尺寸（4:3，800×600）：canvas 预渲染菜品图为统一尺寸 JPEG
  // 比 SVG <image> 在 rasterize（Image.src → canvas）路径更可靠（foreignObject 在该路径不渲染）
  var THUMB_W = 800, THUMB_H = 600, THUMB_QUALITY = 0.85;

  // 按 crop 渲染菜品图为 4:3 缩略图（等价于菜品库 cropBg 的渲染结果）
  function renderThumb(img, crop) {
    var canvas = document.createElement('canvas');
    canvas.width = THUMB_W; canvas.height = THUMB_H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = resolveImgBg();
    ctx.fillRect(0, 0, THUMB_W, THUMB_H);
    var iw = img.naturalWidth || img.width || 0;
    var ih = img.naturalHeight || img.height || 0;
    if (!iw || !ih) return null;
    var c = crop || null;
    var r = null;
    if (c && typeof c.w === 'number') {
      // 新 crop {x,y,w,h}（0-1）：精确裁切矩形，等价 CSS background-size/position 公式
      var w = clamp(c.w, 0.05, 1);
      var h = clamp(typeof c.h === 'number' ? c.h : w * 0.75, 0.05, 1);
      var x = clamp(c.x, 0, 1 - w);
      var y = clamp(c.y, 0, 1 - h);
      var drawW = THUMB_W / w, drawH = THUMB_H / h;
      // drawImage(img, x, y, w, h) 中 x/y 是整图左上角在 canvas 上的位置（可为负）
      r = { x: -THUMB_W * x / w, y: -THUMB_H * y / h, w: drawW, h: drawH };
    } else {
      // 旧 crop {x,y}(0-100)：等价 CSS cover + background-position:50% y%
      var py = (c && typeof c.y === 'number') ? clamp(c.y, 0, 100) / 100 : 0.5;
      r = coverRect(iw, ih, THUMB_W, THUMB_H, 0.5, py);
    }
    if (!r) return null;
    try { ctx.drawImage(img, r.x, r.y, r.w, r.h); }
    catch (e) { return null; }
    try { return canvas.toDataURL('image/jpeg', THUMB_QUALITY); }
    catch (e) { return null; }
  }

  // 通过 fetch 读取同源/离线缓存资源后再解码，避免 Canvas 在导出时取不到相对路径图片。
  function loadExportImage(src, done) {
    if (!src) { done(null, '缺少图片地址'); return; }
    var key = String(src).replace(/^\.\//, '').replace(/^\//, '');
    var embedded = window.__EXPORT_ASSETS__ && window.__EXPORT_ASSETS__[key];
    if (embedded) {
      var safeImage = new Image();
      safeImage.onload = function () { done(safeImage, null); };
      safeImage.onerror = function () { done(null, '内嵌资源损坏：' + key); };
      safeImage.src = embedded;
      return;
    }
    var direct = function () {
      // 直接 URL 可能污染 Canvas；仅允许设置页上传产生的 data URI。
      if (!/^data:image\//i.test(src)) { done(null, '资源未内嵌，不能安全导出：' + src); return; }
      var im = new Image();
      im.onload = function () { done(im, null); };
      im.onerror = function () { done(null, '无法读取 ' + src); };
      im.src = src;
    };
    if (!window.fetch) { direct(); return; }
    fetch(src).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    }).then(function (blob) {
      var url = URL.createObjectURL(blob), im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); done(im, null); };
      im.onerror = function () { URL.revokeObjectURL(url); direct(); };
      im.src = url;
    }).catch(function () { direct(); });
  }

  // 预加载所有菜品图片，并把菜品库使用的同一份 crop 先固化为 4:3 位图。
  // 最终横版导出只绘制这份位图，杜绝再次计算 cover 后产生取景偏移。
  // cb(lines, errors)：应有的菜图任一失败都会被导出流程阻断。
  function preloadImages(lines, cb) {
    // Canvas 导出保留原图作兼容回退，同时必须等待已裁好的缩略图解码完成。
    var pending = lines.filter(function (l) { return l.image && (!l._exportImage || !l._exportThumb); });
    if (!pending.length) { cb(lines, []); return; }
    var remain = pending.length;
    var errors = [];
    function complete() { if (--remain === 0) cb(lines, errors); }
    pending.forEach(function (l) {
      function makeCroppedThumb(im) {
        var thumb = renderThumb(im, l.crop);
        if (!thumb) { errors.push((l.cn || '未命名菜品') + '：无法生成与菜品库一致的截图'); complete(); return; }
        var thumbImage = new Image();
        thumbImage.onload = function () { l._thumb = thumb; l._exportThumb = thumbImage; complete(); };
        thumbImage.onerror = function () { errors.push((l.cn || '未命名菜品') + '：裁切图解码失败'); complete(); };
        thumbImage.src = thumb;
      }
      if (l._exportImage) { makeCroppedThumb(l._exportImage); return; }
      loadExportImage(l.image, function (im, err) {
        if (im) {
          l._exportImage = im;
          makeCroppedThumb(im);
        } else { l._thumb = null; errors.push((l.cn || '未命名菜品') + '：' + err); complete(); }
      });
    });
  }

  // 菜名换行：每行最多 maxChars 字，超过截断 + …；返回数组（1-2 行）
  function wrapCn(name, maxChars) {
    name = name || '未命名菜品';
    if (name.length <= maxChars) return [name];
    if (name.length <= maxChars * 2) {
      // 优先在分隔符处断行
      var cut = -1;
      for (var i = maxChars; i < name.length && i < maxChars + 3; i++) {
        if (/[\s·（(\/]/.test(name[i])) { cut = i + 1; break; }
      }
      if (cut < 0) cut = maxChars;
      return [name.slice(0, cut), name.slice(cut)];
    }
    return [name.slice(0, maxChars), name.slice(maxChars, maxChars * 2 - 1) + '…'];
  }

  // 在 SVG 中渲染菜名，自动追加换菜/加菜标注。
  //   普通模式：换菜 A ——→ B（红箭头），加菜 A（新增）
  //   总厨模式(chefMode)：原菜名带删除线，下方红色写换后菜名；加菜用红色「（加菜）」后缀
  // opts: { m, FS, C, maxChars, fs, step, colorInk, colorMark, anchor, singleLine, chefMode, rowWidth }
  function renderDishName(parts, x, y, l, opts) {
    opts = opts || {};
    var m = opts.m, FS = opts.FS, C = opts.C;
    var maxChars = opts.maxChars || 20;
    var fs = opts.fs || 4.4;
    var step = opts.step || fs;
    var colorInk = opts.colorInk || C.ink;
    var colorMark = opts.colorMark || C.primary;
    var anchorAttr = opts.anchor === 'middle' ? ' text-anchor="middle"' : '';
    var singleLine = opts.singleLine;
    var chefMode = opts.chefMode;
    var rowWidth = opts.rowWidth;
    var arrow = ' ——→ ';
    var addMark = chefMode ? '（加菜）' : '（新增）';

    // 单行模式：标注后若超长，按比例缩小字号把整句（含换/加标注）压进一行，绝不截断 —— 确保有图版也完整显示变更
    function fitFs(full) {
      if (!singleLine || full.length <= maxChars) return fs;
      return Math.max(2.2, fs * maxChars / full.length);
    }

    function textWidth(text, ufs) {
      ufs = ufs || fs;
      var w = 0;
      for (var i = 0; i < text.length; i++) {
        w += (text.charCodeAt(i) > 127) ? ufs : ufs * 0.58;
      }
      return w;
    }
    function drawText(text, ly, fill, ufs) {
      ufs = ufs || fs;
      parts.push('<text x="' + m(x) + '" y="' + m(ly) + '"' + anchorAttr + ' font-family="' + FS + '" font-size="' + m(ufs) + '" font-weight="700" fill="' + fill + '">' + esc(text) + '</text>');
    }
    function drawStrike(text, ly, fill, strikeFill, ufs) {
      // 绘制文字并在其正中加一条删除线
      // chefMode 下传入 rowWidth 则删除线贯穿整行，否则按文字宽度
      ufs = ufs || fs;
      drawText(text, ly, fill, ufs);
      var w = chefMode && rowWidth ? rowWidth : textWidth(text, ufs);
      var sx = anchorAttr ? x - w / 2 : x;
      var sy = ly - ufs * 0.32;
      parts.push('<line x1="' + m(sx) + '" y1="' + m(sy) + '" x2="' + m(sx + w) + '" y2="' + m(sy) + '" stroke="' + (strikeFill || C.primary) + '" stroke-width="' + m(ufs * 0.11) + '"/>');
    }
    function drawSplit(text, ly, splitAt, beforeFill, afterFill, ufs) {
      ufs = ufs || fs;
      var before = text.slice(0, splitAt);
      var after = text.slice(splitAt);
      parts.push('<text x="' + m(x) + '" y="' + m(ly) + '"' + anchorAttr + ' font-family="' + FS + '" font-size="' + m(ufs) + '" font-weight="700" fill="' + beforeFill + '">' + esc(before) + '<tspan fill="' + afterFill + '">' + esc(after) + '</tspan></text>');
    }

    if (l.swappedFromCn) {
      if (chefMode) {
        // 总厨单：原菜名带删除线，下方红色写换后菜名
        var fromName = l.swappedFromCn || '原菜品';
        var toName = l.cn || '未命名菜品';
        var fromLines = wrapCn(fromName, maxChars);
        var toLines = wrapCn(toName, maxChars);
        var lineCount = 0;
        fromLines.forEach(function (ln, i) {
          drawStrike(ln, y + i * step, colorInk, fs);
          lineCount++;
        });
        toLines.forEach(function (ln, i) {
          drawText(ln, y + (fromLines.length + i) * step, colorMark, fs);
          lineCount++;
        });
        return lineCount;
      }
      var full = l.swappedFromCn + arrow + l.cn;
      var ufs0 = fitFs(full);
      if (singleLine) {
        var idx = full.indexOf(arrow);
        drawSplit(full, y, idx, colorInk, colorMark, ufs0);
        return 1;
      }
      var lines = wrapCn(full, maxChars);
      lines.forEach(function (ln, i) {
        var ly = y + i * step;
        var idx = ln.indexOf(arrow);
        if (idx >= 0) drawSplit(ln, ly, idx, colorInk, colorMark);
        else drawText(ln, ly, colorInk);
      });
      return lines.length;
    } else if (l.added) {
      var full = l.cn + addMark;
      var ufs0 = fitFs(full);
      if (singleLine) {
        var idx = full.lastIndexOf(addMark);
        drawSplit(full, y, idx, colorInk, colorMark, ufs0);
        return 1;
      }
      var lines = wrapCn(l.cn, maxChars);
      lines.forEach(function (ln, i) {
        var ly = y + i * step;
        if (i === lines.length - 1) {
          parts.push('<text x="' + m(x) + '" y="' + m(ly) + '"' + anchorAttr + ' font-family="' + FS + '" font-size="' + m(fs) + '" font-weight="700" fill="' + colorInk + '">' + esc(ln) + '<tspan fill="' + colorMark + '">' + esc(addMark) + '</tspan></text>');
        } else {
          drawText(ln, ly, colorInk);
        }
      });
      return lines.length;
    } else {
      var cn = l.cn || '未命名菜品';
      if (singleLine && cn.length > maxChars) cn = cn.slice(0, maxChars - 1) + '…';
      var lines = singleLine ? [cn] : wrapCn(cn, maxChars);
      lines.forEach(function (ln, i) {
        drawText(ln, y + i * step, colorInk);
      });
      return lines.length;
    }
  }

  // 横向 A4 带图版：酒店标识、菜单名称和价格固定在抬头，主体为 4:3 菜品卡。
  function buildPhotoLandscapeSVG(k) {
    k = k || 1;
    var MM = 5.90476, m = function (mm) { return +(mm * MM * k).toFixed(2); };
    var W = 297, H = 210, left = 14, right = 283, contentW = right - left;
    var C = { bg:'#F8F3E9', surface:'#FFFDF8', ink:'#3A2E26', muted:'#9D8060', primary:'#9F3028', gold:'#B48B42', goldHair:'#CDB77E', line:'rgba(117,88,43,.22)', imgBg:resolveImgBg() };
    var lines = draft.lines || [], cols = 6, gap = 3.5, rows = Math.max(1, Math.ceil(lines.length / cols));
    var cardW = (contentW - gap * (cols - 1)) / cols, gridY = 54, footerY = 185;
    var cardH = (footerY - gridY - gap * (rows - 1)) / rows;
    var metaH = Math.max(7, Math.min(9, cardH * .22)), imgH = Math.min(cardW * .75, cardH - metaH);
    var p = [];
    p.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + m(W) + '" height="' + m(H) + '" viewBox="0 0 ' + m(W) + ' ' + m(H) + '">');
    var backdrop = exportBackdrop || 'assets/export/banquet-a4-fixed-template.png';
    p.push('<image href="' + backdrop + '" xlink:href="' + backdrop + '" width="' + m(W) + '" height="' + m(H) + '" preserveAspectRatio="none"/><rect x="' + m(11) + '" y="' + m(11) + '" width="' + m(W - 22) + '" height="' + m(35) + '" fill="' + C.bg + '" fill-opacity=".94"/><rect x="' + m(11) + '" y="' + m(47) + '" width="' + m(W - 22) + '" height="' + m(139) + '" fill="' + C.bg + '" fill-opacity=".96"/>');
    p.push('<rect width="' + m(W) + '" height="' + m(5) + '" fill="' + C.primary + '"/><rect y="' + m(5) + '" width="' + m(W) + '" height="' + m(.7) + '" fill="' + C.gold + '"/>');
    p.push(brandMarkSvg(left, 14, 15, 3, m, C, FONT_SERIF));
    p.push('<text x="' + m(left + 19) + '" y="' + m(24) + '" font-family="' + FONT_SERIF + '" font-size="' + m(7) + '" font-weight="700" fill="' + C.primary + '">' + esc(getBrandName()) + '</text>');
    p.push('<text x="' + m(W / 2) + '" y="' + m(23) + '" text-anchor="middle" font-family="' + FONT_SERIF + '" font-size="' + m(8) + '" font-weight="700" fill="' + C.ink + '" letter-spacing="' + m(1) + '">' + esc((draft.source || draft.type || '宴席菜单')) + '</text>');
    p.push('<text x="' + m(right) + '" y="' + m(18) + '" text-anchor="end" font-family="' + FONT_SANS + '" font-size="' + m(2.6) + '" fill="' + C.muted + '">菜单价格</text><text x="' + m(right) + '" y="' + m(27) + '" text-anchor="end" font-family="' + FONT_SERIF + '" font-size="' + m(8) + '" font-weight="700" fill="' + C.primary + '">¥' + esc(draft.total || '—') + '<tspan font-size="' + m(3) + '" font-weight="400"> 元/桌</tspan></text>');
    p.push('<path d="M' + m(7) + ' ' + m(16) + 'h' + m(9) + 'v' + m(3) + 'h' + m(3) + 'v' + m(9) + '" fill="none" stroke="' + C.gold + '" stroke-width="' + m(.8) + '"/><path d="M' + m(W - 7) + ' ' + m(16) + 'h-' + m(9) + 'v' + m(3) + 'h-' + m(3) + 'v' + m(9) + '" fill="none" stroke="' + C.gold + '" stroke-width="' + m(.8) + '"/><path d="M' + m(7) + ' ' + m(H - 16) + 'h' + m(9) + 'v-' + m(3) + 'h' + m(3) + 'v-' + m(9) + '" fill="none" stroke="' + C.gold + '" stroke-width="' + m(.8) + '"/><path d="M' + m(W - 7) + ' ' + m(H - 16) + 'h-' + m(9) + 'v-' + m(3) + 'h-' + m(3) + 'v-' + m(9) + '" fill="none" stroke="' + C.gold + '" stroke-width="' + m(.8) + '"/>');
    p.push('<line x1="' + m(left) + '" y1="' + m(38) + '" x2="' + m(right) + '" y2="' + m(38) + '" stroke="' + C.goldHair + '" stroke-width="' + m(.45) + '"/><text x="' + m(W / 2) + '" y="' + m(45) + '" text-anchor="middle" font-family="' + FONT_SANS + '" font-size="' + m(2.7) + '" letter-spacing="' + m(.8) + '" fill="' + C.muted + '">' + esc(getExportHeaderSlogan()) + '</text>');
    lines.forEach(function (l, i) {
      var x = left + (i % cols) * (cardW + gap), y = gridY + Math.floor(i / cols) * (cardH + gap), id = 'land_' + i;
      var src = l._thumb || l.image, name = l.cn || '未命名菜品', note = (l.note || '').trim();
      if (name.length > 10) name = name.slice(0, 9) + '…'; if (note.length > 12) note = note.slice(0, 11) + '…';
      p.push('<rect x="' + m(x) + '" y="' + m(y) + '" width="' + m(cardW) + '" height="' + m(cardH) + '" rx="' + m(1.2) + '" fill="' + C.surface + '" stroke="' + C.goldHair + '" stroke-width="' + m(.32) + '"/><clipPath id="' + id + '"><rect x="' + m(x + .9) + '" y="' + m(y + .9) + '" width="' + m(cardW - 1.8) + '" height="' + m(imgH - .9) + '"/></clipPath><rect x="' + m(x + .9) + '" y="' + m(y + .9) + '" width="' + m(cardW - 1.8) + '" height="' + m(imgH - .9) + '" fill="' + C.imgBg + '"/>');
      if (src) p.push('<image href="' + src + '" xlink:href="' + src + '" x="' + m(x + .9) + '" y="' + m(y + .9) + '" width="' + m(cardW - 1.8) + '" height="' + m(imgH - .9) + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + ')"/>');
      p.push('<text x="' + m(x + 2) + '" y="' + m(y + imgH + 4.2) + '" font-family="' + FONT_SERIF + '" font-size="' + m(3.25) + '" font-weight="700" fill="' + C.ink + '">' + esc(name) + '</text>');
      if (note) p.push('<text x="' + m(x + 2) + '" y="' + m(y + imgH + 7.8) + '" font-family="' + FONT_SANS + '" font-size="' + m(2.15) + '" fill="' + C.muted + '">备注：' + esc(note) + '</text>');
    });
    p.push('<rect x="' + m(90) + '" y="' + m(193) + '" width="' + m(117) + '" height="' + m(11) + '" fill="' + C.bg + '" fill-opacity=".88"/><text x="' + m(W / 2) + '" y="' + m(201) + '" text-anchor="middle" font-family="' + FONT_SANS + '" font-size="' + m(2.3) + '" fill="' + C.muted + '">' + esc(getExportFooterSlogan()) + '</text></svg>');
    return p.join('');
  }
  function getExportHeaderSlogan() {
    try { return (Store && Store.TENANT && Store.TENANT.exportHeaderSlogan) || '珍馐美馔 · 共聚美好时光'; }
    catch (e) { return '珍馐美馔 · 共聚美好时光'; }
  }
  function getExportFooterSlogan() {
    try { return (Store && Store.TENANT && Store.TENANT.exportFooterSlogan) || '以美食致敬相聚的美好'; }
    catch (e) { return '以美食致敬相聚的美好'; }
  }

  // 横向 A4 的纸张、金线与山水属于固定视觉资产。预先转为 data URL，确保
  // SVG 被栅格化为 PNG/PDF 时背景也会随导出物一起保留。
  var exportBackdrop = null;
  var exportBackdropImage = null;
  var exportBackdropPending = false;
  var exportBackdropCallbacks = [];
  function preloadExportBackdrop(cb) {
    if (exportBackdropImage) { cb(null); return; }
    if (exportBackdropPending) { exportBackdropCallbacks.push(cb); return; }
    if (typeof Image === 'undefined') { cb(); return; }
    exportBackdropPending = true;
    exportBackdropCallbacks.push(cb);
    var finish = function (err) {
      var callbacks = exportBackdropCallbacks.splice(0);
      exportBackdropPending = false;
      callbacks.forEach(function (fn) { fn(err || null); });
    };
    loadExportImage('assets/export/banquet-a4-textless-background.png', function (image, error) {
      if (!image) { finish(error || '固定底稿无法读取'); return; }
      try {
        // 导出底稿是 build-export-assets.js 编译的 data URI；直接保留安全图片对象。
        exportBackdrop = 'embedded'; exportBackdropImage = image;
      } catch (e) { finish(e.message || '底稿无法写入导出画布'); return; }
      finish(null);
    });
  }
  function preloadExportAssets(lines, cb) {
    preloadImages(lines, function (_, imageErrors) {
      preloadExportBackdrop(function (backdropError) {
        cb(lines, (imageErrors || []).concat(backdropError ? [backdropError] : []));
      });
    });
  }
  function prepareExportAssets(ver, lines, cb) {
    // 无图小票不依赖图片或 A4 贴图，避免无关资源影响它的导出。
    if (ver === 'plain') { cb(lines, []); return; }
    // 固定底稿不含任何文字或 Logo；Canvas 先画底稿，之后才按当前菜单绘制动态内容。
    preloadExportAssets(lines, cb);
  }

  // 有图横版 A4 的最终渲染器。这里故意不经过 SVG：固定底稿、菜品图和 LOGO
  // 都直接画到同一张 Canvas，避免 Blob SVG 在本地环境丢失相对路径图片。
  function roundedRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function canvasCover(ctx, image, x, y, w, h, crop) {
    if (!image) return false;
    var iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
    if (!iw || !ih) return false;
    var sx = 0, sy = 0, sw = iw, sh = ih;
    if (crop && typeof crop.w === 'number') {
      sw = iw * clamp(crop.w, .05, 1); sh = ih * clamp(typeof crop.h === 'number' ? crop.h : crop.w * .75, .05, 1);
      sx = iw * clamp(crop.x || 0, 0, 1 - sw / iw); sy = ih * clamp(crop.y || 0, 0, 1 - sh / ih);
    } else {
      var sourceRatio = iw / ih, boxRatio = w / h;
      if (sourceRatio > boxRatio) { sw = ih * boxRatio; sx = (iw - sw) / 2; }
      else { sh = iw / boxRatio; sy = (ih - sh) / 2; }
    }
    try { ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h); return true; } catch (_) { return false; }
  }
  function canvasText(ctx, text, x, y, maxWidth) {
    text = String(text || ''); var original = text;
    while (text && ctx.measureText(text).width > maxWidth) text = text.slice(0, -1);
    return text.length < original.length ? text.slice(0, -1) + '…' : text;
  }
  // 抬头字段只在各自锚定区内缩小，不换行、不越界、不挤占相邻区域。
  function canvasFontToFit(ctx, weight, size, family, text, maxWidth, minSize) {
    var px = size;
    do {
      ctx.font = weight + ' ' + px + 'px ' + family;
      if (ctx.measureText(String(text || '')).width <= maxWidth || px <= minSize) return px;
      px -= 1;
    } while (px > minSize);
    return px;
  }
  function drawCanvasLogo(ctx, x, y, size, done) {
    var logo = '', crop = null;
    try { logo = localStorage.getItem('ss_brand_logo') || ''; crop = JSON.parse(localStorage.getItem('ss_brand_logo_crop') || 'null'); } catch (_) {}
    if (!logo) { if (done) done(); return; }
    loadExportImage(logo, function (image) {
      if (!image) { if (done) done(); return; }
      ctx.save(); ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
      canvasCover(ctx, image, x, y, size, size, crop); ctx.restore(); if (done) done();
    });
  }
  function wrapCanvasLines(ctx, text, maxWidth) {
    text = String(text || '').trim(); if (!text) return [];
    var lines = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var next = line + text[i];
      if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = text[i]; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  // 根据每行备注的最大高度计算行高；同行卡片共享同一个 rowHeight，底边始终对齐。
  function getLandscapeGrid(lines, bounds, ctx, options) {
    options = options || {};
    var count = Math.max(1, lines.length), best = null, maxCols = Math.min(6, Math.max(3, count));
    function measure(cols, w) {
      var gap = 30, rows = Math.ceil(count / cols), pad = Math.max(9, w * .025), imageW = w - pad * 2, imageH = imageW * .75;
      var titleFs = Math.max(24, Math.min(36, w * .052)), noteFs = Math.max(18, Math.min(25, w * .036)), noteStep = Math.round(noteFs * 1.42), rowHeights = [];
      for (var r = 0; r < rows; r++) {
        var rowH = imageH + pad + titleFs + 26;
        for (var c = 0; c < cols; c++) {
          var dish = lines[r * cols + c]; if (!options.showNotes || !dish || !(dish.note || '').trim()) continue;
          ctx.font = noteFs + 'px "Microsoft YaHei", sans-serif';
          var noteLines = wrapCanvasLines(ctx, '备注：' + dish.note.trim(), imageW);
          rowH = Math.max(rowH, imageH + pad + titleFs + 14 + noteLines.length * noteStep + 16);
        }
        rowHeights.push(rowH);
      }
      var total = rowHeights.reduce(function (a, h) { return a + h; }, 0) + gap * (rows - 1);
      return { cols:cols, rows:rows, gap:gap, w:w, pad:pad, imageW:imageW, imageH:imageH, titleFs:titleFs, noteFs:noteFs, noteStep:noteStep, rowHeights:rowHeights, total:total };
    }
    for (var cols = 3; cols <= maxCols; cols++) {
      var maxW = Math.min(760, (bounds.w - 30 * (cols - 1)) / cols), candidate = measure(cols, maxW);
      // 备注过多时只缩小中部菜品区，固定背景和抬头一律不动。
      while (candidate.total > bounds.h && candidate.w > 180) candidate = measure(cols, candidate.w - 6);
      if (candidate.total <= bounds.h && (!best || candidate.w > best.w)) best = candidate;
    }
    return best || measure(6, Math.max(180, (bounds.w - 150) / 6));
  }
  // 纯 Canvas 的无文字 A4 底稿。此函数只能放固定装饰，严禁出现酒店名、菜单名、报价或口号。
  function drawLandscapeTemplate(ctx, W, H, C) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    // 柔和纸张肌理：确定性线条，避免每次导出产生不同的脏点。
    ctx.save(); ctx.globalAlpha = .035; ctx.strokeStyle = '#b8985d'; ctx.lineWidth = 1;
    for (var y = 42; y < H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W * .28, y - 6, W * .7, y + 5, W, y - 2); ctx.stroke(); }
    ctx.restore();
    // 顶部双线、内外金框。
    ctx.fillStyle = C.red; ctx.fillRect(0, 0, W, 13); ctx.fillStyle = C.gold; ctx.fillRect(0, 13, W, 5);
    ctx.strokeStyle = '#d7c08b'; ctx.lineWidth = 4; roundedRect(ctx, 68, 54, W - 136, H - 122, 25); ctx.stroke();
    ctx.strokeStyle = 'rgba(183,141,64,.42)'; ctx.lineWidth = 2; ctx.strokeRect(92, 78, W - 184, H - 178);
    // 四个固定中式折角。
    function corner(x, y, sx, sy) {
      ctx.save(); ctx.strokeStyle = C.gold; ctx.lineWidth = 8; ctx.beginPath();
      ctx.moveTo(x, y + sy * 72); ctx.lineTo(x + sx * 36, y + sy * 72); ctx.lineTo(x + sx * 36, y + sy * 34);
      ctx.lineTo(x + sx * 74, y + sy * 34); ctx.lineTo(x + sx * 74, y); ctx.stroke(); ctx.restore();
    }
    corner(70, 60, 1, 1); corner(W - 70, 60, -1, 1); corner(70, H - 60, 1, -1); corner(W - 70, H - 60, -1, -1);
    // 页脚淡山水：无文字、无数据，只占固定底部区域。
    ctx.save(); ctx.globalAlpha = .16; ctx.fillStyle = '#d1bd8a'; ctx.beginPath();
    ctx.moveTo(0, H - 135); ctx.bezierCurveTo(300, H - 290, 540, H - 110, 850, H - 180); ctx.bezierCurveTo(1130, H - 250, 1320, H - 105, 1630, H - 165); ctx.bezierCurveTo(1990, H - 235, 2250, H - 95, 2590, H - 165); ctx.bezierCurveTo(2910, H - 232, 3240, H - 125, W, H - 250); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = .12; ctx.fillStyle = '#b89650'; ctx.beginPath(); ctx.moveTo(0, H - 78); ctx.bezierCurveTo(420, H - 245, 720, H - 115, 1120, H - 150); ctx.bezierCurveTo(1580, H - 190, 1930, H - 58, 2370, H - 142); ctx.bezierCurveTo(2800, H - 215, 3160, H - 95, W, H - 170); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function buildPhotoLandscapeCanvas(lines, done, meta) {
    meta = meta || {};
    var W = 3508, H = 2480, canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d'), C = { bg:'#f8f3e9', ink:'#382c25', muted:'#a88d67', red:'#a52f29', gold:'#b78d40', hair:'#cfb878', card:'#fffdf8', image:'#e8dcc0' };
    // 固定层来自无文字底稿；绝不使用带菜单名、价格或 Logo 的参考图。
    if (exportBackdropImage) ctx.drawImage(exportBackdropImage, 0, 0, W, H);
    else drawLandscapeTemplate(ctx, W, H, C); // 仅在底稿异常时的保守离线兜底
    // 抬头采用无文字底稿的原始 1491×1055 坐标系（s=2.352），所有动态字段严格替换图一对应区域。
    var s = W / 1491, logoX = 92 * s, logoY = 92 * s, logoSize = 92 * s;
    // 标题下方两段固定金线属于装饰，不属于动态文案。
    ctx.strokeStyle = '#d2bb8c'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(568 * s, 188 * s); ctx.lineTo(600 * s, 188 * s); ctx.moveTo(892 * s, 188 * s); ctx.lineTo(924 * s, 188 * s); ctx.stroke();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var titleFamily = '"Noto Serif SC", "Songti SC", "STSong", Georgia, serif';
    var sansFamily = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    // 左侧仅使用设置页的原始 LOGO（其内部文字、比例均随设置图像保持），不重复绘制酒店名。
    var title = (meta.title || (draft && (draft.source || draft.type)) || '宴会菜单').trim();
    ctx.fillStyle = '#781b1b'; canvasFontToFit(ctx, '700', 60 * s, titleFamily, title, 420 * s, 35 * s); ctx.textAlign = 'center';
    ctx.fillText(title, 746 * s, 151 * s);
    var price = String(typeof meta.price !== 'undefined' ? meta.price : ((draft && draft.total) || '—'));
    var priceText = '¥' + price, priceGap = 14 * s, deskText = '/ 桌', deskRight = 1405 * s;
    // “/ 桌”是最右固定锚点；另外两段从右向左依次排布，两个空隙严格相等。
    ctx.font = (17 * s) + 'px ' + sansFamily;
    var deskLeft = deskRight - ctx.measureText(deskText).width;
    var priceRight = deskLeft - priceGap;
    ctx.fillStyle = C.red; canvasFontToFit(ctx, '400', 48 * s, '"Times New Roman", "Songti SC", serif', priceText, 180 * s, 30 * s);
    var priceWidth = ctx.measureText(priceText).width;
    // 标签由价格左边缘反推，与“价格 → / 桌”使用完全相同的间距。
    ctx.textAlign = 'right'; ctx.fillStyle = C.muted; ctx.font = (14 * s) + 'px ' + sansFamily;
    ctx.fillText('菜单价格', priceRight - priceWidth - priceGap, 155 * s);
    ctx.fillStyle = C.red; canvasFontToFit(ctx, '400', 48 * s, '"Times New Roman", "Songti SC", serif', priceText, 180 * s, 30 * s); ctx.fillText(priceText, priceRight, 155 * s);
    ctx.font = (17 * s) + 'px ' + sansFamily; ctx.fillText(deskText, deskRight, 155 * s);
    ctx.textAlign = 'center'; ctx.fillStyle = C.muted; canvasFontToFit(ctx, '400', 15 * s, sansFamily, getExportHeaderSlogan(), 260 * s, 10 * s); ctx.fillText(getExportHeaderSlogan(), 746 * s, 194 * s);
    var showNotes = meta.showNotes !== false, centerNames = !!meta.catalogMode;
    var bounds = { x: 165, y: 635, w: W - 330, h: 1500 }, grid = getLandscapeGrid(lines, bounds, ctx, { showNotes: showNotes });
    var gridW = grid.cols * grid.w + (grid.cols - 1) * grid.gap, gridH = grid.total;
    var startX = bounds.x + (bounds.w - gridW) / 2, startY = bounds.y + Math.max(0, (bounds.h - gridH) / 2);
    lines.forEach(function (line, i) {
      var row = Math.floor(i / grid.cols), y = startY;
      for (var prior = 0; prior < row; prior++) y += grid.rowHeights[prior] + grid.gap;
      var x = startX + (i % grid.cols) * (grid.w + grid.gap), cardH = grid.rowHeights[row], pad = grid.pad;
      ctx.fillStyle = C.card; roundedRect(ctx, x, y, grid.w, cardH, 12); ctx.fill(); ctx.strokeStyle = C.hair; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); roundedRect(ctx, x + pad, y + pad, grid.imageW, grid.imageH, 7); ctx.clip(); ctx.fillStyle = C.image; ctx.fillRect(x + pad, y + pad, grid.imageW, grid.imageH);
      // _exportThumb 是由 renderThumb 按菜品库 cropBg 的同一算法产生的 4:3 截图。
      // 导出时等比铺满，不再二次裁切，因此取景位置与菜品库逐像素一致。
      if (line._exportThumb) ctx.drawImage(line._exportThumb, x + pad, y + pad, grid.imageW, grid.imageH);
      else canvasCover(ctx, line._exportImage, x + pad, y + pad, grid.imageW, grid.imageH, line.crop);
      ctx.restore();
      var name = line.cn || '未命名菜品', note = (line.note || '').trim(), nameY = y + pad + grid.imageH + grid.titleFs + 12;
      ctx.textAlign = centerNames ? 'center' : 'left'; ctx.fillStyle = C.ink; ctx.font = '700 ' + grid.titleFs + 'px "Noto Serif SC", "Songti SC", "STSong", serif';
      var nameX = centerNames ? x + grid.w / 2 : x + pad;
      ctx.fillText(canvasText(ctx, name, nameX, nameY, grid.imageW), nameX, nameY);
      if (showNotes && note) {
        ctx.fillStyle = C.muted; ctx.font = grid.noteFs + 'px "Microsoft YaHei", sans-serif';
        var noteLines = wrapCanvasLines(ctx, '备注：' + note, grid.imageW), noteY = nameY + grid.noteStep;
        noteLines.forEach(function (text, n) { ctx.fillText(text, x + pad, noteY + n * grid.noteStep); });
      }
    });
    ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.font = '26px "Microsoft YaHei", sans-serif'; ctx.fillText(getExportFooterSlogan(), W / 2, 2350);
    // 在 Logo 加载完成后交给下载和 PDF，保证同一张 Canvas 被两个格式复用。
    drawCanvasLogo(ctx, logoX, logoY, logoSize, function () { done(canvas); });
  }

  // 构造导出 SVG（A4 竖版单页：保留旧版作为兼容路径）
  // 带图版沿用 v2.2 效果：单一 4×4 网格（按菜单顺序排，无分类段标题），图片按菜品库裁剪一致。
  // 缩略图用 preloadImages 预渲染的 4:3 JPEG（_thumb），rasterize 用 Blob URL 保证图片不丢失。
  // 整体按 A4(210×297mm) 比例出图，rasterize→PDF 时自动得到标准 A4 页面。
  function buildSVG(ver, k) {
    k = k || 1;
    var MM = 5.90476; // px per mm @ k=1
    var m = function (mm) { return +(mm * MM * k).toFixed(2); };
    var PAGE_W = m(210), PAGE_H = m(297);

    var C = expLayout === 'B' ? {
      bg: '#F8F6F1', surface: '#FFFFFF', ink: '#25221F', desc: '#5D5852', muted: '#8B8278',
      primary: '#7E302B', primaryDeep: '#55201D', gold: '#A98B52', goldDeep: '#725D35', goldHair: '#D9D1C3', line: 'rgba(37,34,31,.12)',
      imgBg: resolveImgBg()
    } : {
      bg: '#F5F0E6', surface: '#FBF7EE', ink: '#3A2E26', desc: '#5C4F45', muted: '#A88A5E',
      primary: '#B23A2E', primaryDeep: '#8F2A20', gold: '#C2A15A', goldDeep: '#8A6D1F', goldHair: '#D8C7A6', line: 'rgba(58,46,38,.10)',
      imgBg: resolveImgBg()
    };
    var FS = FONT_SERIF;
    var FK = '&quot;KaiTi&quot;, &quot;STKaiti&quot;, &quot;楷体&quot;, serif';
    var FN = FONT_SANS;

    function esc2(s) { return esc(s); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    // #7 贵宾：未填写名字时直接不写（不再兜底"贵宾"）
    var client = (draft.client || '').trim();
    var type = (draft.type || '').trim() || '宴席';
    // #5 中间显示菜单名称（套餐名优先，其次宴席类型），可放大
    var menuName = (draft.source || '').trim() || type;
    var total = (draft.total || '').toString().trim();
    var totalStr = total ? '¥' + total : '—';

    var SX = 16;                          // 左右页边距 mm
    var contentL = SX, contentR = 210 - SX;
    var contentW = contentR - contentL;   // 178
    var PAD_T = 11;                       // 顶部内容区距顶 mm
    var topBandH = 5;

    // —— 页脚固定贴底；分类段可用高度据此自适应 ——
    // 紧凑排版：减小上下预留，网格顶部对齐且允许适度放大以填满留白（间隔更紧）。
    var footerY = 297 - 9 - 4;
    var secTop = PAD_T + 2 + 15 + 17 + 4; // 标题区 + info + 段前间距（infoH 17mm，段前 4mm）
    var secBottom = footerY - 4;
    var secH = secBottom - secTop;

    var isPhoto = ver !== 'plain';
    var cols = isPhoto ? 3 : 1;   // 带图版：一行 3 个（V2.2 灵活排版），不变形且更饱满
    var fScale = 1, cardH = 0, thumbW = 0, thumbH = 0, metaH = 0, gapRowS = 0;

    // 统一"填满"策略：给两版各算自然高度，按可用高度（含底部留白）放大/缩小，
    // 保证底部距页脚约 12mm，避免之前"间隔太开"的底部大空。
    var BOTTOM_MARGIN = 12;
    var availH = secBottom - secTop - BOTTOM_MARGIN;

    if (isPhoto) {
      // 带图版：单一 3 列网格（v2.2 灵活排版，一行3个），按菜单顺序排，无分类段标题
      var gapCol = 4, gapRow = 3;
      var cw = (contentW - (cols - 1) * gapCol) / cols;
      // 关键：缩略框宽高都随 fScale 缩放，且严格 thumbH = thumbW*0.75（4:3），
      // 否则 fScale≠1 时框比例失真 + none 拉伸 → 照片变形。cover 仅裁切不变形。
      var thumbWnat = cw - 2 * 1.2;
      var thumbHnat = thumbWnat * 0.75;
      var metaHnat = 10;
      var cardHnat = 1.2 * 2 + thumbHnat + metaHnat;
      var rowsTotal = Math.ceil(draft.lines.length / cols);
      var naturalH = rowsTotal * (cardHnat + gapRow) - gapRow;
      fScale = clamp(availH / naturalH, 0.5, 1.3);
      cardH = cardHnat * fScale;
      thumbW = thumbWnat * fScale;
      thumbH = thumbHnat * fScale;
      metaH = metaHnat * fScale;
      gapRowS = gapRow * fScale;
    } else {
      // 无图版：按分类段累计自然高度（段头9 + 间距2 + 行高8×N + 尾间距4）
      var rowHnat = 8, catHeadHnat = 9;
      var plainNat = 0;
      for (var ci = 0; ci < cats().length; ci++) {
        var cr = 0;
        for (var di = 0; di < draft.lines.length; di++) {
          if (draft.lines[di].cat === cats()[ci]) cr++;
        }
        if (cr) plainNat += (catHeadHnat + 2) + cr * rowHnat + 4;
      }
      fScale = clamp(availH / plainNat, 0.5, 1.3);
    }

    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + PAGE_W + '" height="' + PAGE_H + '" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '">');
    parts.push('<rect width="' + PAGE_W + '" height="' + PAGE_H + '" fill="' + C.bg + '"/>');
    // 外框
    parts.push('<rect x="' + m(8) + '" y="' + m(8) + '" width="' + (PAGE_W - 2 * m(8)) + '" height="' + (PAGE_H - 2 * m(8)) + '" rx="' + m(4) + '" fill="none" stroke="' + C.goldHair + '" stroke-width="' + m(0.4) + '"/>');
    // 顶部品牌条
    parts.push('<rect x="0" y="0" width="' + PAGE_W + '" height="' + m(topBandH) + '" fill="' + (expLayout === 'B' ? C.ink : C.primary) + '"/>');
    parts.push('<rect x="0" y="' + m(topBandH) + '" width="' + PAGE_W + '" height="' + m(0.8) + '" fill="' + C.gold + '"/>');

    // —— 抬头 ——
    var hy = PAD_T + 2;
    parts.push(brandMarkSvg(SX, hy, 13, 3, m, C, FS));
    parts.push('<text x="' + m(SX + 17) + '" y="' + m(hy + 9) + '" font-family="' + FK + '" font-size="' + m(7.4) + '" font-weight="700" fill="' + C.primary + '" letter-spacing="' + m(0.8) + '">' + esc2(getBrandName()) + '</text>');
    var titleX = contentR - 44;
    parts.push('<text x="' + m(titleX) + '" y="' + m(hy + 9) + '" text-anchor="start" font-family="' + (expLayout === 'B' ? FN : FK) + '" font-size="' + m(expLayout === 'B' ? 5.8 : 7.4) + '" font-weight="700" fill="' + C.ink + '" letter-spacing="' + m(expLayout === 'B' ? .3 : 1.2) + '">' + esc2(getExportTitle()) + '</text>');

    // —— 信息条：左(客户，未填则不写) / 中(菜单名称，放大) / 右(红色价格，不框) ——
    var iy = hy + 15, infoH = 17;
    parts.push('<rect x="' + m(SX) + '" y="' + m(iy) + '" width="' + m(contentW) + '" height="' + m(infoH) + '" rx="' + m(2.6) + '" fill="#FFFDF7" stroke="' + C.line + '" stroke-width="' + m(0.4) + '"/>');
    // 左：客户名（仅在有填写时显示；未填则不写"贵宾"）
    if (client) {
      parts.push('<rect x="' + m(SX + 2) + '" y="' + m(iy + 3) + '" width="' + m(0.6) + '" height="' + m(infoH - 6) + '" fill="' + C.gold + '"/>');
      parts.push('<text x="' + m(SX + 6.5) + '" y="' + m(iy + 11.5) + '" font-family="' + FS + '" font-size="' + m(6.4) + '" font-weight="700" fill="' + C.ink + '">' + esc2(client) + '</text>');
    }
    // 中：菜单名称（放大居中）+ 下方金线
    var infoCx = contentL + contentW / 2;
    var menuText = esc2(menuName);
    parts.push('<text x="' + m(infoCx) + '" y="' + m(iy + 11.5) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(7.2) + '" font-weight="700" fill="' + C.goldDeep + '" letter-spacing="' + m(0.6) + '">' + menuText + '</text>');
    // 右：红色价格（不框，纯红字表示）
    parts.push('<text x="' + m(contentR - 2) + '" y="' + m(iy + 6.5) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(2.6) + '" fill="' + C.muted + '" letter-spacing="' + m(1) + '">本单总价</text>');
    parts.push('<text x="' + m(contentR - 2) + '" y="' + m(iy + 14.5) + '" text-anchor="end" font-family="' + FS + '" font-size="' + m(8) + '" font-weight="700" fill="' + C.primary + '">' + esc2(totalStr) + '<tspan font-size="' + m(2.8) + '" font-weight="400" dx="' + m(0.8) + '">元/桌</tspan></text>');

    if (isPhoto) {
      // 新版带图：连续画册网格。图片比例、裁剪和菜品库保持一致。
      var galleryCols = 4, galleryGap = 3;
      var galleryW = (contentW - galleryGap * (galleryCols - 1)) / galleryCols;
      var galleryRows = Math.ceil(draft.lines.length / galleryCols);
      var galleryH = Math.min(48, (availH - galleryGap * Math.max(0, galleryRows - 1)) / Math.max(1, galleryRows));
      var galleryTextH = 11;   // 菜名（可两行）+ 备注 预留高度
      var galleryImageH = Math.min(galleryW * 0.75, galleryH - galleryTextH);
      var galleryTotalH = galleryRows * galleryH + Math.max(0, galleryRows - 1) * galleryGap;
      var galleryY = secTop + Math.max(0, (availH - galleryTotalH) / 2);
      var gNameFs = 2.8, gNoteFs = 2.0;
      draft.lines.forEach(function (l, i) {
        var gx = SX + (i % galleryCols) * (galleryW + galleryGap);
        var gy = galleryY + Math.floor(i / galleryCols) * (galleryH + galleryGap);
        var gid = 'gallery_' + i;
        parts.push('<rect x="' + m(gx) + '" y="' + m(gy) + '" width="' + m(galleryW) + '" height="' + m(galleryH) + '" rx="' + m(2) + '" fill="#FFFDF8" stroke="' + C.line + '" stroke-width="' + m(0.35) + '"/>');
        parts.push('<clipPath id="' + gid + '"><rect x="' + m(gx) + '" y="' + m(gy) + '" width="' + m(galleryW) + '" height="' + m(galleryImageH) + '" rx="' + m(2) + '"/></clipPath>');
        var gsrc = l._thumb || l.image;
        if (gsrc) parts.push('<g clip-path="url(#' + gid + ')"><image href="' + gsrc + '" xlink:href="' + gsrc + '" x="' + m(gx) + '" y="' + m(gy) + '" width="' + m(galleryW) + '" height="' + m(galleryImageH) + '" preserveAspectRatio="xMidYMid slice"/></g>');
        // #1 不再放序号；#2 不再写菜品分类；#3 菜名可换行；换菜/加菜自动 inline 标注（带图版也完整显示变更）
        var gcnChars = Math.max(5, Math.floor((galleryW - 4) / gNameFs));
        var gyName = gy + galleryImageH + 5.2;
        var gcnLinesN = renderDishName(parts, gx + 2.2, gyName, l, {
          m: m, FS: FS, C: C,
          maxChars: gcnChars, fs: gNameFs, step: 4
        });
        // 备注区始终预留同一高度；有备注才落字，避免无备注卡片挤压菜名或破坏网格对齐。
        var note = (l.note || '').trim();
        if (note) {
          note = '备注：' + note;
          if (note.length > 28) note = note.slice(0, 27) + '…';
          parts.push('<text x="' + m(gx + 2.2) + '" y="' + m(gyName + gcnLinesN * 4 + 2.6) + '" font-family="' + FN + '" font-size="' + m(gNoteFs) + '" fill="' + C.muted + '">' + esc2(note) + '</text>');
        }
      });
    } else if (isPhoto) {
      // —— 带图版 v3.2（旧版保留，不再进入）
      //    分品类段（项目设计语言核心：朱红印章 + 「壹·凉菜」衬线 + 金色细线 + 回纹装饰）+ 3 列双线金框卡片
      //    段头尺寸脱离 fScale（固定可读大小），卡片按 fScale 适配 A4 单页
      //    缩略图 cover 裁切，与菜品库 crop 位置一致；末段内不足整行时居中
      //    关键：把「固定高度（段头+段间距）」与「可缩放高度（卡片+行间距）」分开算 fScale，
      //         避免之前把固定段头塞进 naturalH 导致卡片缩不够、内容溢出页脚。
      var pcols = 4;
      var padX = 1.15, padY = 1.05;
      var gapCol = 2.4, gapRow = 2.4;
      var cw = (contentW - (pcols - 1) * gapCol) / pcols;
      var thumbWnat = cw - 2 * padX;
      var thumbHnat = thumbWnat * 0.75;      // 严格 4:3
      var metaHnat = 9;
      var cardHnat = padY * 2 + thumbHnat + metaHnat;

      // 各分类段（含菜品为空则跳过）
      var segs = cats().map(function (cat) {
        var ls = draft.lines.filter(function (l) { return l.cat === cat; });
        return ls.length ? { cat: cat, lines: ls, nRow: Math.ceil(ls.length / pcols) } : null;
      }).filter(Boolean);

      // 高度拆解：固定部分（不缩放）+ 可缩放部分（按 fScale 适配）
      var catHeadHnat = 8.5;   // 段头固定高度（mm）
      var catGapHnat = 3;      // 段间距固定（mm）
      var headTrailHnat = 2;   // 段头下方的「回」字装饰+双金线预留
      var fixedH = 0;
      var scaledH = 0;
      segs.forEach(function (s, i) {
        fixedH += catHeadHnat + headTrailHnat;  // 段头 + 装饰条
        scaledH += s.nRow * cardHnat + (s.nRow - 1) * gapRow;
        if (i < segs.length - 1) fixedH += catGapHnat;
      });
      // 横向尺寸不能超过四列可用宽度；菜品较少时通过居中与分段留白保持舒展。
      fScale = clamp((availH - fixedH) / scaledH, 0.5, 1);

      var cardH = cardHnat * fScale;
      var cardW = cw * fScale;
      var thumbW = thumbWnat * fScale;
      var thumbH = thumbHnat * fScale;
      var metaH = metaHnat * fScale;
      var gapRowS = gapRow * fScale;

      var gy = secTop;
      var sealChars = ['壹', '贰', '叁'];

      segs.forEach(function (s, segIdx) {
        var headY = gy;
        // 段头布局（固定尺寸，不随 fScale 缩放，确保印章字清晰可读）
        var sealSize = 7;                                  // 朱红印章 7×7mm（固定）
        var sealX = SX;
        var sealY = headY + (catHeadHnat - sealSize) / 2;
        parts.push('<rect x="' + m(sealX) + '" y="' + m(sealY) + '" width="' + m(sealSize) + '" height="' + m(sealSize) + '" rx="' + m(0.8) + '" fill="' + C.primary + '"/>');
        parts.push('<rect x="' + m(sealX + 0.5) + '" y="' + m(sealY + 0.5) + '" width="' + m(sealSize - 1) + '" height="' + m(sealSize - 1) + '" rx="' + m(0.5) + '" fill="none" stroke="' + C.primaryDeep + '" stroke-width="' + m(0.4) + '" opacity="0.55"/>');
        parts.push('<text x="' + m(sealX + sealSize / 2) + '" y="' + m(sealY + sealSize * 0.78) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(5) + '" font-weight="700" fill="#fff" letter-spacing="' + m(0.3) + '">' + sealChars[segIdx] + '</text>');
        var labelX = sealX + sealSize + 2.5;
        parts.push('<text x="' + m(labelX) + '" y="' + m(headY + catHeadHnat * 0.72) + '" font-family="' + FS + '" font-size="' + m(5.2) + '" font-weight="700" fill="' + C.primary + '" letter-spacing="' + m(0.8) + '">' + esc2(s.cat) + '</text>');
        parts.push('<text x="' + m(contentR) + '" y="' + m(headY + catHeadHnat * 0.72) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(2.8) + '" fill="' + C.muted + '" letter-spacing="' + m(0.4) + '">共 ' + s.lines.length + ' 道</text>');
        // 段头下方金色细线 + 「回」字装饰符 + 双线
        var ruleY = headY + catHeadHnat - 0.6;
        parts.push('<rect x="' + m(SX) + '" y="' + m(ruleY) + '" width="' + m(contentW) + '" height="' + m(0.5) + '" fill="' + C.gold + '"/>');
        var huiSize = 3.2;
        var huiX = contentL + contentW / 2 - huiSize / 2;
        parts.push('<rect x="' + m(huiX) + '" y="' + m(ruleY - 0.2) + '" width="' + m(huiSize) + '" height="' + m(huiSize) + '" fill="' + C.bg + '"/>');
        parts.push('<text x="' + m(contentL + contentW / 2) + '" y="' + m(ruleY + 0.4) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(3) + '" font-weight="700" fill="' + C.gold + '">回</text>');
        parts.push('<rect x="' + m(SX) + '" y="' + m(ruleY + 1) + '" width="' + m(contentW) + '" height="' + m(0.2) + '" fill="' + C.goldHair + '"/>');
        gy += catHeadHnat + headTrailHnat;

        // —— 卡片网格（缩略图 + 菜名 + 备注）——
        var N = s.lines.length;
        s.lines.forEach(function (l, i) {
          var col = i % pcols, row = Math.floor(i / pcols);
          var rowStart = row * pcols;
          var rowEnd = Math.min(rowStart + pcols, N);
          var cnt = rowEnd - rowStart;
          var rowW = cnt * cardW + (cnt - 1) * gapCol;
          var offset = (contentW - rowW) / 2;
          var cx = SX + offset + col * (cardW + gapCol);
          var cy = gy + row * (cardH + gapRowS);

          // 卡片外框（米白底 + 金线边框，圆角）
          parts.push('<rect x="' + m(cx) + '" y="' + m(cy) + '" width="' + m(cardW) + '" height="' + m(cardH) + '" rx="' + m(2.4) + '" fill="' + C.surface + '" stroke="' + C.goldHair + '" stroke-width="' + m(0.5) + '"/>');
          // 双线金框效果：内嵌细金线（新中式仪式感）
          parts.push('<rect x="' + m(cx + 0.75) + '" y="' + m(cy + 0.75) + '" width="' + m(cardW - 1.5) + '" height="' + m(cardH - 1.5) + '" rx="' + m(1.8) + '" fill="none" stroke="' + C.gold + '" stroke-width="' + m(0.2) + '" opacity="0.55"/>');

          // 照片区域（cover 裁切，与菜品库 crop 一致）
          var tx = cx + padX, ty = cy + padY;
          var clipId = 'clip_p' + segIdx + '_' + i;
          parts.push('<clipPath id="' + clipId + '"><rect x="' + m(tx) + '" y="' + m(ty) + '" width="' + m(thumbW) + '" height="' + m(thumbH) + '" rx="' + m(1.5) + '"/></clipPath>');
          parts.push('<rect x="' + m(tx) + '" y="' + m(ty) + '" width="' + m(thumbW) + '" height="' + m(thumbH) + '" rx="' + m(1.5) + '" fill="' + C.imgBg + '"/>');
          var src = l._thumb || l.image;
          if (src) {
            parts.push('<g clip-path="url(#' + clipId + ')"><image href="' + src + '" xlink:href="' + src + '" x="' + m(tx) + '" y="' + m(ty) + '" width="' + m(thumbW) + '" height="' + m(thumbH) + '" preserveAspectRatio="xMidYMid slice"/></g>');
          }

          // 菜名（衬线粗体，居中，按 fScale）；换菜/加菜自动 inline 标注
          var maxChars = Math.max(4, Math.floor((cardW - 4) / (3.2 * fScale)));
          var nameY = ty + thumbH + metaH * 0.42;
          renderDishName(parts, cx + cardW / 2, nameY, l, {
            m: m, FS: FS, C: C,
            maxChars: maxChars, fs: 3.4 * fScale, step: 3.8 * fScale,
            anchor: 'middle', singleLine: true
          });
          // 备注（小红字，无则不画，保持卡片干净）
          if (l.note) {
            var nt = l.note;
            if (nt.length > maxChars + 3) nt = nt.slice(0, maxChars + 2) + '…';
            parts.push('<text x="' + m(cx + cardW / 2) + '" y="' + m(nameY + 3.8 * fScale) + '" text-anchor="middle" font-family="' + FN + '" font-size="' + m(2.5 * fScale) + '" fill="' + C.primary + '">' + esc2(nt) + '</text>');
          }
        });

        gy += s.nRow * cardH + (s.nRow - 1) * gapRowS;
        if (segIdx < segs.length - 1) gy += catGapHnat;
      });
    } else {
      // 新版无图：双栏宴席菜单。减少表格感，让菜名成为主视觉。
      var segs = cats().map(function (cat) {
        return { cat: cat, rows: draft.lines.filter(function (l) { return l.cat === cat; }) };
      }).filter(function (s) { return s.rows.length; });
      var CN = {}; cats().forEach(function (c, i) { CN[c] = cnNum(i); });
      var plainCols = 2, plainGap = 8, plainW = (contentW - plainGap) / 2;
      var plainX = [SX, SX + plainW + plainGap];
      var plainY = [secTop, secTop];
      // 预排平衡两栏 → 全局统一行高，保证每根分隔线横向对齐（不随段内菜品数抖动错位）
      var colRows = [0, 0];
      segs.forEach(function (s) {
        var c = colRows[0] <= colRows[1] ? 0 : 1;
        colRows[c] += s.rows.length;
      });
      var maxColRows = Math.max(1, colRows[0], colRows[1]);
      // 每道菜都预留一行备注，名称与备注分层排布；有备注时不会压到下一个菜名。
      var rowH2 = Math.min(21, Math.max(17, (availH - 40) / maxColRows));
      var targetCol = 0;
      segs.forEach(function (s, si) {
        targetCol = plainY[0] <= plainY[1] ? 0 : 1;
        var px2 = plainX[targetCol], py2 = plainY[targetCol];
        var headH2 = 12;
        parts.push('<rect x="' + m(px2) + '" y="' + m(py2) + '" width="' + m(plainW) + '" height="' + m(headH2) + '" rx="' + m(2.2) + '" fill="' + C.primary + '"/>');
        parts.push('<text x="' + m(px2 + 5) + '" y="' + m(py2 + 8) + '" font-family="' + FS + '" font-size="' + m(5) + '" font-weight="700" fill="#fff" letter-spacing="' + m(0.8) + '">' + (CN[s.cat] || '') + '  ' + esc2(s.cat) + '</text>');
        parts.push('<text x="' + m(px2 + plainW - 4) + '" y="' + m(py2 + 7.6) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(2.5) + '" fill="#F4DDB8">' + s.rows.length + ' 道</text>');
        py2 += headH2 + 2;
        s.rows.forEach(function (l, i) {
          var ry = py2 + i * rowH2;
          // #1 不再放序号；#3 菜名单行优先（按栏宽算阈值，约19字一行放得下），仅极长才折两行
          var cnMax = Math.max(11, Math.floor((plainW - 2) / 4.2));
          var cnStep = 4.4;
          // 先按普通菜名估算行数以垂直居中；renderDishName 内部会重新折行并追加换/加标注
          var tmpLines = wrapCn(l.cn || '未命名菜品', cnMax);
          var cnBase = ry + 5.2 - (tmpLines.length - 1) * cnStep * .5;
          renderDishName(parts, px2 + 1, cnBase, l, {
            m: m, FS: FS, C: C,
            maxChars: cnMax, fs: 4.4, step: cnStep
          });
          var plainNote = (l.note || '').trim();
          if (plainNote) {
            var noteMax = Math.max(14, Math.floor((plainW - 2) / 2.4));
            if (plainNote.length > noteMax) plainNote = plainNote.slice(0, noteMax - 1) + '…';
            parts.push('<text x="' + m(px2 + 1) + '" y="' + m(ry + rowH2 - 4.2) + '" font-family="' + FN + '" font-size="' + m(2.25) + '" fill="' + C.primary + '">备注：' + esc2(plainNote) + '</text>');
          }
          // 分隔线：整行宽、底部统一位置，不随菜名行数抖动
          parts.push('<line x1="' + m(px2) + '" y1="' + m(ry + rowH2 - 1.5) + '" x2="' + m(px2 + plainW) + '" y2="' + m(ry + rowH2 - 1.5) + '" stroke="' + C.line + '" stroke-width="' + m(0.35) + '"/>');
        });
        plainY[targetCol] = py2 + s.rows.length * rowH2 + 7;
      });
      parts.push('<line x1="' + m(105) + '" y1="' + m(secTop) + '" x2="' + m(105) + '" y2="' + m(Math.max(plainY[0], plainY[1]) - 4) + '" stroke="' + C.goldHair + '" stroke-width="' + m(0.35) + '"/>');
    }

    // —— 页脚：左、右两根短金线与文字居中对齐，线条不碰到文字 ——
    var fy = footerY;
    var fcx = 105;
    var lineGap = 30;
    var lineW = 18;
    parts.push('<line x1="' + m(fcx - lineGap - lineW) + '" y1="' + m(fy) + '" x2="' + m(fcx - lineGap) + '" y2="' + m(fy) + '" stroke="' + C.gold + '" stroke-width="' + m(0.5) + '"/>');
    parts.push('<line x1="' + m(fcx + lineGap) + '" y1="' + m(fy) + '" x2="' + m(fcx + lineGap + lineW) + '" y2="' + m(fy) + '" stroke="' + C.gold + '" stroke-width="' + m(0.5) + '"/>');
    parts.push('<text x="' + m(fcx) + '" y="' + m(fy + 1.0) + '" text-anchor="middle" font-family="' + FN + '" font-size="' + m(2.6) + '" fill="' + C.muted + '" letter-spacing="' + m(0.6) + '">本单仅作报价参考，菜品请以实物为主</text>');

    parts.push('</svg>');
    return parts.join('');
  }

  // 手机长图：拟物化餐厅小票。宽度固定 750px，高度随菜品数量自动增长。
  function buildMobileSVG(ver) {
    var lines = draft.lines || [];
    var photo = ver !== 'plain';
    var groups = cats().map(function (cat) {
      return { cat: cat, rows: lines.filter(function (l) { return l.cat === cat; }) };
    }).filter(function (g) { return g.rows.length; });
    var W = 750, pad = 58, rowH = photo ? 154 : 78, groupHead = 58;
    var bodyH = groups.reduce(function (n, g) { return n + groupHead + g.rows.length * rowH + 22; }, 0);
    if (expPurpose === 'chef' && draft.removedLines && draft.removedLines.length) bodyH += 74 + draft.removedLines.length * 56;
    var H = 400 + bodyH + 110;
    var C = expLayout === 'B'
      ? { paper:'#FCFBF7', ink:'#282522', muted:'#8A8178', primary:'#74322E', gold:'#A98B52', line:'#DED8CF' }
      : { paper:'#F8F1E5', ink:'#392E27', muted:'#9B8061', primary:'#B23A2E', gold:'#C2A15A', line:'#DDD0BA' };
    var p = [];
    p.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">');
    p.push('<defs><filter id="s"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-opacity=".12"/></filter><pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".7" fill="#000" opacity=".025"/></pattern></defs>');
    p.push('<rect width="'+W+'" height="'+H+'" fill="#DED8CE"/>');
    p.push('<path d="M25 20 H725 V'+(H-22)+' L710 '+(H-10)+' 695 '+(H-22)+' 680 '+(H-10)+' 665 '+(H-22)+' 650 '+(H-10)+' 635 '+(H-22)+' 620 '+(H-10)+' 605 '+(H-22)+' 590 '+(H-10)+' 575 '+(H-22)+' 560 '+(H-10)+' 545 '+(H-22)+' 530 '+(H-10)+' 515 '+(H-22)+' 500 '+(H-10)+' 485 '+(H-22)+' 470 '+(H-10)+' 455 '+(H-22)+' 440 '+(H-10)+' 425 '+(H-22)+' 410 '+(H-10)+' 395 '+(H-22)+' 380 '+(H-10)+' 365 '+(H-22)+' 350 '+(H-10)+' 335 '+(H-22)+' 320 '+(H-10)+' 305 '+(H-22)+' 290 '+(H-10)+' 275 '+(H-22)+' 260 '+(H-10)+' 245 '+(H-22)+' 230 '+(H-10)+' 215 '+(H-22)+' 200 '+(H-10)+' 185 '+(H-22)+' 170 '+(H-10)+' 155 '+(H-22)+' 140 '+(H-10)+' 125 '+(H-22)+' 110 '+(H-10)+' 95 '+(H-22)+' 80 '+(H-10)+' 65 '+(H-22)+' 50 '+(H-10)+' 25 '+(H-22)+' Z" fill="'+C.paper+'" filter="url(#s)"/>');
    p.push('<rect x="25" y="20" width="700" height="'+(H-42)+'" fill="url(#grain)"/>');
    p.push('<text x="375" y="82" text-anchor="middle" font-family="'+FONT_SERIF+'" font-size="34" font-weight="700" fill="'+C.primary+'">'+esc(getBrandName())+'</text>');
    p.push('<text x="375" y="124" text-anchor="middle" font-family="'+FONT_SANS+'" font-size="18" letter-spacing="4" fill="'+C.muted+'">'+esc(getExportTitle())+'</text>');
    p.push('<line x1="'+pad+'" y1="154" x2="'+(W-pad)+'" y2="154" stroke="'+C.gold+'" stroke-width="2" stroke-dasharray="8 7"/>');
    p.push('<text x="'+pad+'" y="198" font-family="'+FONT_SANS+'" font-size="20" fill="'+C.muted+'">宴会类型</text><text x="'+(W-pad)+'" y="198" text-anchor="end" font-family="'+FONT_SERIF+'" font-size="24" fill="'+C.ink+'">'+esc(draft.type||'宴席')+'</text>');
    p.push('<text x="'+pad+'" y="238" font-family="'+FONT_SANS+'" font-size="20" fill="'+C.muted+'">客户 / 贵宾</text><text x="'+(W-pad)+'" y="238" text-anchor="end" font-family="'+FONT_SERIF+'" font-size="24" fill="'+C.ink+'">'+esc(draft.client||'—')+'</text>');
    p.push('<text x="'+pad+'" y="278" font-family="'+FONT_SANS+'" font-size="20" fill="'+C.muted+'">菜单名称</text><text x="'+(W-pad)+'" y="278" text-anchor="end" font-family="'+FONT_SERIF+'" font-size="24" fill="'+C.ink+'">'+esc(draft.source||draft.type||'菜单')+'</text>');
    p.push('<rect x="'+pad+'" y="302" width="'+(W-pad*2)+'" height="66" rx="14" fill="'+C.primary+'"/><text x="'+(pad+22)+'" y="344" font-family="'+FONT_SANS+'" font-size="18" fill="#fff" opacity=".8">本单总价</text><text x="'+(W-pad-20)+'" y="347" text-anchor="end" font-family="'+FONT_SERIF+'" font-size="34" font-weight="700" fill="#fff">¥'+esc(draft.total||'—')+' / 桌</text>');
    var y = 402, seq = 0;
    groups.forEach(function (g) {
      p.push('<text x="'+pad+'" y="'+(y+34)+'" font-family="'+FONT_SERIF+'" font-size="25" font-weight="700" fill="'+C.primary+'">'+esc(g.cat)+'</text><text x="'+(W-pad)+'" y="'+(y+34)+'" text-anchor="end" font-family="'+FONT_SANS+'" font-size="17" fill="'+C.muted+'">'+g.rows.length+' 道</text>');
      y += groupHead;
      g.rows.forEach(function (l) {
        seq++;
        if (photo) {
          var src=l._thumb||l.image, clip='mob_'+seq;
          p.push('<clipPath id="'+clip+'"><rect x="'+pad+'" y="'+y+'" width="156" height="117" rx="12"/></clipPath><rect x="'+pad+'" y="'+y+'" width="156" height="117" rx="12" fill="'+resolveImgBg()+'"/>');
          if(src)p.push('<image href="'+src+'" xlink:href="'+src+'" x="'+pad+'" y="'+y+'" width="156" height="117" preserveAspectRatio="xMidYMid slice" clip-path="url(#'+clip+')"/>');
          p.push('<text x="'+(pad+178)+'" y="'+(y+40)+'" font-family="'+FONT_SERIF+'" font-size="24" font-weight="600" fill="'+C.ink+'">'+esc(l.cn||'未命名菜品')+'</text>');
          if (l.note) p.push('<text x="'+(pad+178)+'" y="'+(y+77)+'" font-family="'+FONT_SANS+'" font-size="18" fill="'+C.primary+'">备注：'+esc(l.note)+'</text>');
        } else {
          var mark=l.swappedFromCn?'原 '+l.swappedFromCn+' → '+l.cn:(l.added?'新增 · '+l.cn:l.cn);
          p.push('<text x="'+pad+'" y="'+(y+32)+'" font-family="'+FONT_SANS+'" font-size="16" fill="'+C.muted+'">'+String(seq).padStart(2,'0')+'</text><text x="'+(pad+54)+'" y="'+(y+32)+'" font-family="'+FONT_SERIF+'" font-size="25" fill="'+(l.swappedFromCn||l.added?C.primary:C.ink)+'">'+esc(mark)+'</text>');
          if(l.note)p.push('<text x="'+(pad+54)+'" y="'+(y+59)+'" font-family="'+FONT_SANS+'" font-size="16" fill="'+C.muted+'">备注：'+esc(l.note)+'</text>');
        }
        p.push('<line x1="'+pad+'" y1="'+(y+rowH-14)+'" x2="'+(W-pad)+'" y2="'+(y+rowH-14)+'" stroke="'+C.line+'"/>'); y += rowH;
      }); y += 22;
    });
    if(expPurpose==='chef'&&draft.removedLines&&draft.removedLines.length){p.push('<text x="'+pad+'" y="'+(y+32)+'" font-family="'+FONT_SERIF+'" font-size="23" font-weight="700" fill="'+C.primary+'">删减菜品</text>');y+=64;draft.removedLines.forEach(function(l){p.push('<text x="'+(pad+16)+'" y="'+(y+26)+'" font-family="'+FONT_SERIF+'" font-size="22" fill="'+C.muted+'" text-decoration="line-through">'+esc(l.cn)+'</text>');y+=56;});}
    p.push('<line x1="'+pad+'" y1="'+(H-86)+'" x2="'+(W-pad)+'" y2="'+(H-86)+'" stroke="'+C.gold+'" stroke-dasharray="8 7"/><text x="375" y="'+(H-52)+'" text-anchor="middle" font-family="'+FONT_SANS+'" font-size="15" fill="'+C.muted+'">共 '+lines.length+' 道 · 本单仅作报价参考，菜品请以实物为主</text></svg>');
    return p.join('');
  }

  // 字号档位 UI 已从定制导出弹窗移除，固定使用标准比例 1（内部 buildSVG 仍支持显式传 k 缩放）
  function getExpScale() { return 1; }

  // iOS / iPadOS 不认 blob 的 download 属性：a.download 会被静默忽略并直接预览。
  // 桌面 / 安卓则走 a.download 真正下载。
  function isIOS() {
    var ua = (navigator.userAgent || '');
    var plat = (navigator.platform || '');
    return /iPad|iPhone|iPod/.test(ua) || (plat === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isWeChat() { return /MicroMessenger/i.test(navigator.userAgent || ''); }

  // iOS / 微信专用：在用户手势内先开好的新标签引用。
  // 因为 PDF 生成为异步（先预加载图片再栅格化），若等生成完才 window.open 会被 Safari 弹窗拦截 → 什么都不发生。
  // 故在点击手势里先开空白标签，生成完再导航它到 blob，保证 iPhone 真能打开 PDF。
  var pendingWin = null;

  function downloadBlob(blob, filename) {
    if (!blob) return;
    var url = URL.createObjectURL(blob);
    // iOS / 微信：a.download 无效，且异步后 window.open 会被拦截。
    // 优先用点击手势里开好的新标签导航；若被拦截（pendingWin 为空/关闭）则退化为同标签打开，
    // 由系统 PDF 查看器提供「分享 → 保存到文件」。
    if (isIOS() || isWeChat()) {
      if (pendingWin && !pendingWin.closed) {
        try { pendingWin.location.href = url; }
        catch (e) { try { window.location.href = url; } catch (e2) {} }
      } else {
        try { window.location.href = url; } catch (e) {}
      }
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 30000);
      if (window.toast) {
        window.toast(isWeChat()
          ? '已打开，点右上角 ⋯ → 在浏览器打开 → 保存到文件'
          : '已打开 PDF，点右上角 ⋯ → 保存到文件');
      }
      pendingWin = null;
      return;
    }
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  function safeName(s) { return (s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '定制单'; }

  // 高清倍率：手机端查看更清晰
  var EXPORT_DPR = 2;

  // 将 SVG 栅格化到 canvas（高清），回调 (canvas)
  // 用 Blob URL 而非 data URI：避免对整段 SVG 再 encodeURIComponent，
  // 导致内嵌的 data:image/jpeg 缩略图链接被二次编码、在部分浏览器里加载失败（照片缺失＝显示不全）。
  function rasterize(svg, cb) {
    var url, isBlob = false;
    try {
      var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      url = URL.createObjectURL(blob);
      isBlob = true;
    } catch (e) {
      url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
    var img = new Image();
    img.onload = function () {
      var w = Math.round(img.width * EXPORT_DPR);
      var h = Math.round(img.height * EXPORT_DPR);
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F5F0E6';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      if (isBlob && url) URL.revokeObjectURL(url);
      cb(canvas);
    };
    img.onerror = function () { if (isBlob && url) URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  // 纯前端 PDF 生成：canvas → JPEG → 内嵌 DCTDecode 图像 XObject（无外部依赖）
  function canvasToPdfBlob(canvas, filename, done) {
    try {
      var jpg = canvas.toDataURL('image/jpeg', 0.92);
      var bin = atob(jpg.split(',')[1]);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var w = canvas.width, h = canvas.height;
      // 页面尺寸：保持图片纵横比，宽度取 A4 横向/纵向尺寸
      var PW = (w >= h) ? 842 : 595.28;
      var PH = +(PW * h / w).toFixed(2);
      var pdf = buildPdfWithJpeg(bytes, w, h, PW, PH);
      done(new Blob([pdf], { type: 'application/pdf' }), filename + '.pdf');
    } catch (e) {
      done(null);
    }
  }

  // 构造最小可用 PDF（1 页，内嵌 JPEG 图像）
  function buildPdfWithJpeg(jpeg, w, h, PW, PH) {
    var enc = function (s) { var a = []; for (var i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 0xff); return a; };
    var chunks = [], offsets = {};
    var push = function (arr) { chunks.push(arr); };
    var len = function () { var n = 0; for (var i = 0; i < chunks.length; i++) n += chunks[i].length; return n; };
    push(enc('%PDF-1.4\n'));
    offsets[1] = len(); push(enc('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
    offsets[2] = len(); push(enc('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));
    offsets[3] = len(); push(enc('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n'));
    offsets[4] = len(); push(enc('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n'));
    push(Array.prototype.slice.call(jpeg));
    push(enc('\nendstream\nendobj\n'));
    var content = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q';
    offsets[5] = len(); push(enc('5 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream\nendobj\n'));
    var xrefStart = len();
    var xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (var o = 1; o <= 5; o++) {
      var s = ('0000000000' + offsets[o]).slice(-10);
      xref += s + ' 00000 n \n';
    }
    push(enc(xref));
    push(enc('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF'));
    var out = new Uint8Array(len());
    var pos = 0;
    for (var c = 0; c < chunks.length; c++) { out.set(chunks[c], pos); pos += chunks[c].length; }
    return out;
  }

  // ============================================================
  // 整份宴席菜单多页 PDF 导出（每套餐一页）
  // 说明：二维码分享 / 线上深链已按《产品背景与需求定义》v1 移除——
  //   本产品为内部销售工具，导出物是离线自包含 PNG/PDF 文件，应用外交付，无任何远程链接。
  // ============================================================

  // 多页 PDF：pages = [{bytes: JPEG字节, w, h}]
  // 对象编号规则：1=Catalog，2=Pages，之后每页占 3 个对象（Page / Image XObject / Contents）
  function buildMultiPagePdf(pages) {
    var enc = function (s) { var a = []; for (var i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 0xff); return a; };
    var chunks = [], offsets = {};
    var push = function (arr) { chunks.push(arr); };
    var len = function () { var n = 0; for (var i = 0; i < chunks.length; i++) n += chunks[i].length; return n; };
    var n = pages.length;
    var objCount = 2 + 3 * n;

    push(enc('%PDF-1.4\n'));
    offsets[1] = len(); push(enc('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));

    var kids = [];
    for (var p = 0; p < n; p++) kids.push((3 + 3 * p) + ' 0 R');
    offsets[2] = len(); push(enc('2 0 obj\n<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>\nendobj\n'));

    for (var i = 0; i < n; i++) {
      var pg = pages[i];
      var w = pg.w, h = pg.h;
      // A4：宽图走横向 842×595，竖图走纵向 595.28×PH（按图比例）
      var PW = (w >= h) ? 842 : 595.28;
      var PH = +(PW * h / w).toFixed(2);
      var idPage = 3 + 3 * i, idImg = 4 + 3 * i, idCont = 5 + 3 * i;

      offsets[idPage] = len();
      push(enc(idPage + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 ' + idImg + ' 0 R >> >> /Contents ' + idCont + ' 0 R >>\nendobj\n'));

      offsets[idImg] = len();
      push(enc(idImg + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + pg.bytes.length + ' >>\nstream\n'));
      push(Array.prototype.slice.call(pg.bytes));
      push(enc('\nendstream\nendobj\n'));

      var content = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q';
      offsets[idCont] = len();
      push(enc(idCont + ' 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream\nendobj\n'));
    }

    var xrefStart = len();
    var xref = 'xref\n0 ' + (objCount + 1) + '\n0000000000 65535 f \n';
    for (var o = 1; o <= objCount; o++) {
      xref += ('0000000000' + (offsets[o] || 0)).slice(-10) + ' 00000 n \n';
    }
    push(enc(xref));
    push(enc('trailer\n<< /Size ' + (objCount + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF'));

    var out = new Uint8Array(len());
    var pos = 0;
    for (var c = 0; c < chunks.length; c++) { out.set(chunks[c], pos); pos += chunks[c].length; }
    return out;
  }

  // 单套餐一页 A4 SVG（复用定制单的设计语言：宣纸底 + 金线外框 + 品牌条 + 4 列画册网格）
  // 与 buildSVG 的差别：抬头写「宴席菜单」、信息条中部写套餐名、右侧写套餐价格，页脚为报价提示语。
  function buildPackageSVG(banquetId, pkgId, k) {
    k = k || 1;
    var MM = 5.90476;
    var m = function (mm) { return +(mm * MM * k).toFixed(2); };
    var PAGE_W = m(210), PAGE_H = m(297);

    var C = {
      bg: '#F5F0E6', surface: '#FBF7EE', ink: '#3A2E26', muted: '#A88A5E',
      primary: '#B23A2E', gold: '#C2A15A', goldDeep: '#8A6D1F', goldHair: '#D8C7A6',
      line: 'rgba(58,46,38,.10)', imgBg: resolveImgBg()
    };
    var FS = FONT_SERIF, FN = FONT_SANS;
    var FK = '&quot;KaiTi&quot;, &quot;STKaiti&quot;, &quot;楷体&quot;, serif';

    var b = Store ? Store.getBanquet(banquetId) : null;
    var pk = (Store && Store.getPackage) ? Store.getPackage(banquetId, pkgId) : null;
    var resolved = (Store && Store.resolvePackage) ? Store.resolvePackage(banquetId, pkgId) : null;
    // ⚠️ Store.resolvePackage 直接返回「菜品数组」，不是 {dishes:[...]}（store.js:334）
    var dishes = Array.isArray(resolved) ? resolved : ((resolved && resolved.dishes) || []);
    var bName = b ? b.name : '宴席';
    var pkName = pk ? (pk.name || '') : '';
    var price = pk && pk.price ? String(pk.price) : '';

    var SX = 16, contentL = SX, contentR = 210 - SX, contentW = contentR - contentL;
    var PAD_T = 11, topBandH = 5;
    var footerY = 297 - 9 - 4;
    var secTop = PAD_T + 2 + 15 + 17 + 4;
    var availH = footerY - 4 - secTop - 12;

    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + PAGE_W + '" height="' + PAGE_H + '" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '">');
    parts.push('<rect width="' + PAGE_W + '" height="' + PAGE_H + '" fill="' + C.bg + '"/>');
    parts.push('<rect x="' + m(8) + '" y="' + m(8) + '" width="' + (PAGE_W - 2 * m(8)) + '" height="' + (PAGE_H - 2 * m(8)) + '" rx="' + m(4) + '" fill="none" stroke="' + C.goldHair + '" stroke-width="' + m(0.4) + '"/>');
    parts.push('<rect x="0" y="0" width="' + PAGE_W + '" height="' + m(topBandH) + '" fill="' + C.primary + '"/>');
    parts.push('<rect x="0" y="' + m(topBandH) + '" width="' + PAGE_W + '" height="' + m(0.8) + '" fill="' + C.gold + '"/>');

    // —— 抬头 ——
    var hy = PAD_T + 2;
    parts.push(brandMarkSvg(SX, hy, 13, 3, m, C, FS));
    parts.push('<text x="' + m(SX + 17) + '" y="' + m(hy + 9) + '" font-family="' + FK + '" font-size="' + m(7.4) + '" font-weight="700" fill="' + C.primary + '" letter-spacing="' + m(0.8) + '">' + esc(getBrandName()) + '</text>');
    var titleX = contentR - 44;
    parts.push('<text x="' + m(titleX) + '" y="' + m(hy + 9) + '" text-anchor="start" font-family="' + FK + '" font-size="' + m(7.4) + '" font-weight="700" fill="' + C.ink + '" letter-spacing="' + m(1.2) + '">宴席菜单</text>');

    // —— 信息条：左(宴席名) / 中(套餐名) / 右(价格) ——
    var iy = hy + 15, infoH = 17;
    parts.push('<rect x="' + m(SX) + '" y="' + m(iy) + '" width="' + m(contentW) + '" height="' + m(infoH) + '" rx="' + m(2.6) + '" fill="#FFFDF7" stroke="' + C.line + '" stroke-width="' + m(0.4) + '"/>');
    parts.push('<rect x="' + m(SX + 2) + '" y="' + m(iy + 3) + '" width="' + m(0.6) + '" height="' + m(infoH - 6) + '" fill="' + C.gold + '"/>');
    parts.push('<text x="' + m(SX + 6.5) + '" y="' + m(iy + 11.5) + '" font-family="' + FS + '" font-size="' + m(6.4) + '" font-weight="700" fill="' + C.ink + '">' + esc(bName) + '</text>');
    var infoCx = contentL + contentW / 2;
    parts.push('<text x="' + m(infoCx) + '" y="' + m(iy + 11.5) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(7.2) + '" font-weight="700" fill="' + C.goldDeep + '" letter-spacing="' + m(0.6) + '">' + esc(pkName) + '</text>');
    parts.push('<text x="' + m(contentR - 2) + '" y="' + m(iy + 6.5) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(2.6) + '" fill="' + C.muted + '" letter-spacing="' + m(1) + '">套餐价格</text>');
    parts.push('<text x="' + m(contentR - 2) + '" y="' + m(iy + 14.5) + '" text-anchor="end" font-family="' + FS + '" font-size="' + m(8) + '" font-weight="700" fill="' + C.primary + '">' + esc(price ? '¥' + price : '—') + '<tspan font-size="' + m(2.8) + '" font-weight="400" dx="' + m(0.8) + '">元/桌</tspan></text>');

    // —— 4 列画册网格（与定制单带图版同一套排版参数，保证视觉一致）——
    var cols = 4, gap = 3;
    var cellW = (contentW - gap * (cols - 1)) / cols;
    var rows = Math.max(1, Math.ceil(dishes.length / cols));
    var cellH = Math.min(48, (availH - gap * Math.max(0, rows - 1)) / rows);
    var textH = 11;
    var imgH = Math.min(cellW * 0.75, cellH - textH);
    var totalH = rows * cellH + Math.max(0, rows - 1) * gap;
    var gridY = secTop + Math.max(0, (availH - totalH) / 2);
    var nameFs = 2.8, gNoteFs = 2.0;

    dishes.forEach(function (d, i) {
      var gx = SX + (i % cols) * (cellW + gap);
      var gy = gridY + Math.floor(i / cols) * (cellH + gap);
      var cid = 'pkg_' + String(pkgId).replace(/[^\w]/g, '') + '_' + i;
      parts.push('<rect x="' + m(gx) + '" y="' + m(gy) + '" width="' + m(cellW) + '" height="' + m(cellH) + '" rx="' + m(2) + '" fill="#FFFDF8" stroke="' + C.line + '" stroke-width="' + m(0.35) + '"/>');
      parts.push('<rect x="' + m(gx) + '" y="' + m(gy) + '" width="' + m(cellW) + '" height="' + m(imgH) + '" rx="' + m(2) + '" fill="' + C.imgBg + '"/>');
      parts.push('<clipPath id="' + cid + '"><rect x="' + m(gx) + '" y="' + m(gy) + '" width="' + m(cellW) + '" height="' + m(imgH) + '" rx="' + m(2) + '"/></clipPath>');
      var src = d._thumb || d.image;
      if (src) parts.push('<g clip-path="url(#' + cid + ')"><image href="' + src + '" xlink:href="' + src + '" x="' + m(gx) + '" y="' + m(gy) + '" width="' + m(cellW) + '" height="' + m(imgH) + '" preserveAspectRatio="xMidYMid slice"/></g>');
      // 菜名：卡片内换行（最多两行），严禁溢出
      var cn = d.cn || '未命名菜品';
      var maxChars = Math.max(5, Math.floor((cellW - 4) / nameFs));
      var lines = wrapCn(cn, maxChars);
      var ny = gy + imgH + 5.2;
      lines.forEach(function (ln, li) {
        parts.push('<text x="' + m(gx + 2.2) + '" y="' + m(ny + li * 4) + '" font-family="' + FS + '" font-size="' + m(nameFs) + '" font-weight="700" fill="' + C.ink + '">' + esc(ln) + '</text>');
      });
      // 不写英文，改为「备注：」
      var note = '备注：' + ((d.note || '').trim());
      if (note.length > 28) note = note.slice(0, 27) + '…';
      parts.push('<text x="' + m(gx + 2.2) + '" y="' + m(ny + lines.length * 4 + 2.6) + '" font-family="' + FN + '" font-size="' + m(gNoteFs) + '" fill="' + C.muted + '">' + esc(note) + '</text>');
    });

    // —— 页脚：左、右两根短金线与文字居中对齐，线条不碰到文字 ——
    var fy = footerY;
    var fcx = 105;
    var lineGap = 30;
    var lineW = 18;
    parts.push('<line x1="' + m(fcx - lineGap - lineW) + '" y1="' + m(fy) + '" x2="' + m(fcx - lineGap) + '" y2="' + m(fy) + '" stroke="' + C.gold + '" stroke-width="' + m(0.5) + '"/>');
    parts.push('<line x1="' + m(fcx + lineGap) + '" y1="' + m(fy) + '" x2="' + m(fcx + lineGap + lineW) + '" y2="' + m(fy) + '" stroke="' + C.gold + '" stroke-width="' + m(0.5) + '"/>');
    parts.push('<text x="' + m(fcx) + '" y="' + m(fy + 1.0) + '" text-anchor="middle" font-family="' + FN + '" font-size="' + m(2.6) + '" fill="' + C.muted + '" letter-spacing="' + m(0.6) + '">本单仅作报价参考，菜品请以实物为主</text>');
    parts.push('</svg>');
    return parts.join('');
  }

  // 单套餐横版成图：与定制菜单的带图版共用同一 Canvas 底稿、抬头和卡片布局。
  function renderPackageLandscapeCanvas(banquetId, pkgId, done) {
    var b = Store ? Store.getBanquet(banquetId) : null;
    var pk = Store && Store.getPackage ? Store.getPackage(banquetId, pkgId) : null;
    var resolved = Store && Store.resolvePackage ? Store.resolvePackage(banquetId, pkgId) : [];
    var dishes = Array.isArray(resolved) ? resolved : ((resolved && resolved.dishes) || []);
    preloadExportAssets(dishes, function (_, errors) {
      if (errors && errors.length) { done(null, errors); return; }
      buildPhotoLandscapeCanvas(dishes, function (canvas) { done(canvas, null); }, {
        title: pk && pk.name ? pk.name : (b && b.name ? b.name : '宴会菜单'),
        price: pk && typeof pk.price !== 'undefined' ? pk.price : '—',
        catalogMode: true, showNotes: false
      });
    });
  }

  // 整份宴席菜单 → 多页横版 PDF（每套餐一页）；opts.pkgId 传单个套餐 id 时只导出该套餐
  function exportWholeMenu(banquetId, opts) {
    opts = opts || {};
    var k = opts.scale || 1;
    var b = Store ? Store.getBanquet(banquetId) : null;
    if (!b || !b.packages || !b.packages.length) {
      try { alert('该宴席暂无套餐，无法导出'); } catch (e) {}
      return;
    }
    // 单套餐导出（客人界面「下载当前套餐」）：只取指定 pkgId
    var pkgs = (opts.pkgId)
      ? b.packages.filter(function (p) { return p.id === opts.pkgId; })
      : b.packages.slice();
    if (!pkgs.length) { try { alert('该套餐不存在，无法导出'); } catch (e) {} return; }
    var single = pkgs.length === 1;

    // iOS / 微信：在用户手势内先开好一个空白新标签，待异步生成完 PDF 再导航它到 blob，
    // 避免生成完才 window.open 被 Safari 弹窗拦截（表现为「点击下载没反应」）。
    pendingWin = null;
    if (isIOS() || isWeChat()) {
      try { pendingWin = window.open('', '_blank'); } catch (e) { pendingWin = null; }
    }

    // 先把所有套餐用到的菜品图片与无文字底稿预加载；任一资源失败则不输出半成品。
    var allLines = [];
    pkgs.forEach(function (p) {
      var rp = (Store.resolvePackage) ? Store.resolvePackage(banquetId, p.id) : null;
      var list = Array.isArray(rp) ? rp : ((rp && rp.dishes) || []);
      list.forEach(function (d) { allLines.push(d); });
    });

    preloadExportAssets(allLines, function (_, assetErrors) {
      if (assetErrors && assetErrors.length) { try { alert('导出未生成：' + assetErrors.join('；')); } catch (e) {} return; }
      var pages = [];
      var idx = 0;
      function next() {
        if (idx >= pkgs.length) {
          if (!pages.length) { try { alert('导出失败，请重试'); } catch (e) {} return; }
          try {
            var pdf = buildMultiPagePdf(pages);
            var fname = single
              ? safeName(b.name) + '-' + safeName(pkgs[0].name) + '.pdf'
              : safeName(/菜单$/.test(b.name) ? b.name : b.name + '菜单') + '.pdf';
            downloadBlob(new Blob([pdf], { type: 'application/pdf' }), fname);
          } catch (e) {
            try { alert('生成 PDF 失败：' + (e && e.message ? e.message : e)); } catch (e2) {}
          }
          return;
        }
        var pkg = pkgs[idx++];
        var resolved = Store.resolvePackage ? Store.resolvePackage(banquetId, pkg.id) : [];
        var dishes = Array.isArray(resolved) ? resolved : ((resolved && resolved.dishes) || []);
        buildPhotoLandscapeCanvas(dishes, function (canvas) {
          if (!canvas) { next(); return; }
          try {
            var jpg = canvas.toDataURL('image/jpeg', 0.92);
            var bin = atob(jpg.split(',')[1]);
            var bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            pages.push({ bytes: bytes, w: canvas.width, h: canvas.height });
          } catch (e) { /* 单页失败则跳过该页 */ }
          next();
        }, {
          title: pkg.name || b.name,
          price: typeof pkg.price !== 'undefined' ? pkg.price : '—',
          catalogMode: true,
          showNotes: false
        });
      }
      next();
    });
  }

  // —— 内置加减计算器 ——
  // 价格框显示「菜单原价 ＋ [输入]」；点击框光标落在 + 号后的输入框，
  // 输入数字回车＝加，输入 -N 回车＝减，结果作为新的运行总价并清空输入框继续累加。
  function applyCalcDelta() {
    if (!draft) return;
    var inp = $('#csTotal');
    if (!inp) return;
    var raw = (inp.value || '').trim();
    if (raw === '') { if (inp) inp.focus(); return; }
    var sign = 1, s = raw;
    if (s.charAt(0) === '+') { s = s.slice(1); }
    else if (s.charAt(0) === '-') { sign = -1; s = s.slice(1); }
    var n = parseFloat(s);
    if (isNaN(n)) n = 0;
    var base = parseFloat(draft.total) || 0;
    var newTotal = base + sign * n;
    if (newTotal < 0) newTotal = 0;            // 价格不为负
    draft.total = String(Math.round(newTotal));
    saveDraft();
    var baseEl = $('#csCalcBase');
    if (baseEl) baseEl.value = draft.total;
    inp.value = '';                            // 清空，准备下一次加/减
    var calc = $('#csCalc');
    if (calc) calc.classList.remove('shaking');
    var hint = $('#csPriceHint');
    if (hint) hint.classList.remove('show');
    if (inp) inp.focus();
  }

  // 价格未填提醒：红字晃动 + 输入框高亮，并返回是否需要拦截
  function triggerPriceHint() {
    var calc = $('#csCalc');
    var inp = $('#csTotal');
    var baseInput = $('#csCalcBase');
    var hint = $('#csPriceHint');
    if (calc) {
      calc.classList.add('shaking');
      setTimeout(function () { if (calc) calc.classList.remove('shaking'); }, 1200);
    }
    if (baseInput && !(draft && draft.total)) {
      baseInput.focus();
      try { baseInput.select(); } catch (e) {}
    } else if (inp) {
      inp.focus();
      try { inp.select(); } catch (e) {}
    }
    if (hint) {
      hint.classList.remove('show');
      // 强制重排以重启动画
      void hint.offsetWidth;
      hint.classList.add('show');
      setTimeout(function () { hint.classList.remove('show'); }, 1600);
    }
  }

  function doExport() {
    if (!draft) return;
    // 校验：必须填写总价才能导出
    var total = (draft.total || '').toString().trim();
    if (!total || total === '0') {
      triggerPriceHint();
      return;
    }
    var ver = getExpVer();
    var k = getExpScale();
    var base = safeName(draft.client) + '-' + safeName(draft.type) + '-' + (ver === 'plain' ? '无图小票' : '横版A4菜单') + '-A';
    var exportLines = getExportLines();
    // 预加载所有菜品图片获取原始尺寸，确保 SVG 裁切与菜品库一致
    prepareExportAssets(ver, exportLines, function (_, assetErrors) {
      if (assetErrors && assetErrors.length) {
        alert('导出未生成：以下资源没有成功进入画布。\n' + assetErrors.join('\n'));
        return;
      }
      if (ver !== 'plain') {
        buildPhotoLandscapeCanvas(exportLines, function (canvas) {
          var output = function (cv) {
            if (expFmt === 'pdf') {
              canvasToPdfBlob(cv, base, function (blob, name) { if (blob) downloadBlob(blob, name); else cv.toBlob(function (b) { if (b) downloadBlob(b, base + '.png'); }, 'image/png'); });
            } else cv.toBlob(function (b) { if (b) downloadBlob(b, base + '.png'); else alert('导出失败，请重试'); }, 'image/png');
          };
          output(canvas);
        });
        return;
      }
      var liveLines = draft.lines;
      draft.lines = exportLines;
      var svg = ver === 'plain' ? buildMobileSVG('plain') : buildPhotoLandscapeSVG(k);
      draft.lines = liveLines;
      rasterize(svg, function (canvas) {
        if (!canvas) { alert('导出失败，请重试'); return; }
        var output = function (cv) {
          if (expFmt === 'pdf') {
            canvasToPdfBlob(cv, base, function (blob, name) {
              if (blob) downloadBlob(blob, name);
              else cv.toBlob(function (b) { if (b) downloadBlob(b, base + '.png'); }, 'image/png');
            });
          } else {
            cv.toBlob(function (b) {
              if (b) downloadBlob(b, base + '.png');
              else alert('导出失败，请重试');
            }, 'image/png');
          }
        };
        output(canvas);
      });
    });
  }

  function openExport() {
    if (!draft) return;
    // 未填总价：在价格旁红字晃动提醒（不打开弹窗）
    var total = (draft.total || '').toString().trim();
    if (!total || total === '0') {
      triggerPriceHint();
      return;
    }
    var m = $('#exportModal');
    // 导出方案固定为 A：带图横版 A4，无图小票清单。
    expPurpose = 'original'; expLayout = 'A'; expSize = 'a4';
    if (m) { m.hidden = false; renderExpPreview(); }
  }
  function closeExport() {
    var m = $('#exportModal');
    if (m) m.hidden = true;
  }

  // 预览：在导出弹窗内渲染缩小版 SVG（异步：先预加载图片，确保裁切精确）
  function renderExpPreview() {
    var container = $('#expPreview');
    if (!container || !draft) return;
    var ver = getExpVer();
    var k = getExpScale();
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#A88A5E;font-size:14px">渲染预览中…</div>';
    var exportLines = getExportLines();
    prepareExportAssets(ver, exportLines, function (_, assetErrors) {
      if (assetErrors && assetErrors.length) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:#A33;font-size:14px">预览无法生成：' + esc(assetErrors.join('；')) + '</div>';
        return;
      }
      if (ver !== 'plain') {
        buildPhotoLandscapeCanvas(exportLines, function (canvas) {
          var img = document.createElement('img'); img.src = canvas.toDataURL('image/png'); img.alt = '横版 A4 菜单预览';
          img.style.cssText = 'height:100%;width:auto;max-width:100%;max-height:100%;display:block;margin:0 auto;object-fit:contain';
          container.innerHTML = ''; container.appendChild(img);
        });
        return;
      }
      var liveLines = draft.lines;
      draft.lines = exportLines;
      var svg = ver === 'plain' ? buildMobileSVG('plain') : buildPhotoLandscapeSVG(k);
      draft.lines = liveLines;
      container.innerHTML = svg;
      // 预览：按高度等比缩放，保证整页 A4 完整可见（不裁切、不压扁）
      var svgs = container.querySelector('svg');
      if (svgs) {
        svgs.style.height = '100%';
        svgs.style.width = 'auto';
        svgs.style.maxWidth = '100%';
        svgs.style.maxHeight = '100%';
        svgs.style.display = 'block';
        svgs.style.margin = '0 auto';
      }
    });
  }

  // ============================================================
  // 导出给总厨（仅无图版）
  // 在「本单总价」基础上，强制注明相对标准套餐的变更：
  //   · 换菜：A 菜 → 换 → B 菜
  //   · 加菜：新增 C 菜
  //   · 减菜：去除 D 菜（从标准套餐中删除的原菜）
  // 主体为无图双栏宴席清单，整张只有无图版。
  // ============================================================
  function buildChefSVG() {
    var MM = 5.90476;
    var m = function (mm) { return +(mm * MM).toFixed(2); };
    var PAGE_W = m(210), PAGE_H = m(297);

    var C = {
      bg: '#F5F0E6', surface: '#FBF7EE', ink: '#3A2E26', desc: '#5C4F45', muted: '#A88A5E',
      primary: '#B23A2E', primaryDeep: '#8F2A20', gold: '#C2A15A', goldDeep: '#8A6D1F', goldHair: '#D8C7A6',
      line: 'rgba(58,46,38,.10)', imgBg: resolveImgBg()
    };
    var FS = FONT_SERIF, FN = FONT_SANS;
    var FK = '&quot;KaiTi&quot;, &quot;STKaiti&quot;, &quot;楷体&quot;, serif';
    function esc2(s) { return esc(s); }

    var client = (draft.client || '').trim();
    var type = (draft.type || '').trim() || '宴席';
    var menuName = (draft.source || '').trim() || type;
    var total = (draft.total || '').toString().trim();
    var basePrice = (draft.basePrice || '').toString().trim();
    var totalStr = total ? '¥' + total : '—';
    var basePriceStr = basePrice ? '¥' + basePrice : '';
    var priceChanged = total && basePrice && total !== basePrice;

    var SX = 16, contentL = SX, contentR = 210 - SX, contentW = contentR - contentL;
    var PAD_T = 11, topBandH = 5;
    var footerY = 297 - 9 - 4;
    var secTop = PAD_T + 2 + 15 + 17 + 4;
    var BOTTOM_MARGIN = 12;

    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + PAGE_W + '" height="' + PAGE_H + '" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '">');
    parts.push('<rect width="' + PAGE_W + '" height="' + PAGE_H + '" fill="' + C.bg + '"/>');
    parts.push('<rect x="' + m(8) + '" y="' + m(8) + '" width="' + (PAGE_W - 2 * m(8)) + '" height="' + (PAGE_H - 2 * m(8)) + '" rx="' + m(4) + '" fill="none" stroke="' + C.goldHair + '" stroke-width="' + m(0.4) + '"/>');
    parts.push('<rect x="0" y="0" width="' + PAGE_W + '" height="' + m(topBandH) + '" fill="' + C.primary + '"/>');
    parts.push('<rect x="0" y="' + m(topBandH) + '" width="' + PAGE_W + '" height="' + m(0.8) + '" fill="' + C.gold + '"/>');

    // —— 抬头 ——
    var hy = PAD_T + 2;
    parts.push(brandMarkSvg(SX, hy, 13, 3, m, C, FS));
    parts.push('<text x="' + m(SX + 17) + '" y="' + m(hy + 9) + '" font-family="' + FK + '" font-size="' + m(7.4) + '" font-weight="700" fill="' + C.primary + '" letter-spacing="' + m(0.8) + '">' + esc2(getBrandName()) + '</text>');
    var titleX = contentR - 44;
    parts.push('<text x="' + m(titleX) + '" y="' + m(hy + 9) + '" text-anchor="start" font-family="' + FK + '" font-size="' + m(7.4) + '" font-weight="700" fill="' + C.ink + '" letter-spacing="' + m(1.2) + '">总厨定制单</text>');

    // —— 信息条：左(客户) / 中(菜单名称) / 右(价格) ——
    var iy = hy + 15, infoH = 17;
    parts.push('<rect x="' + m(SX) + '" y="' + m(iy) + '" width="' + m(contentW) + '" height="' + m(infoH) + '" rx="' + m(2.6) + '" fill="#FFFDF7" stroke="' + C.line + '" stroke-width="' + m(0.4) + '"/>');
    if (client) {
      parts.push('<rect x="' + m(SX + 2) + '" y="' + m(iy + 3) + '" width="' + m(0.6) + '" height="' + m(infoH - 6) + '" fill="' + C.gold + '"/>');
      parts.push('<text x="' + m(SX + 6.5) + '" y="' + m(iy + 11.5) + '" font-family="' + FS + '" font-size="' + m(6.4) + '" font-weight="700" fill="' + C.ink + '">' + esc2(client) + '</text>');
    }
    var infoCx = contentL + contentW / 2;
    parts.push('<text x="' + m(infoCx) + '" y="' + m(iy + 11.5) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(7.2) + '" font-weight="700" fill="' + C.goldDeep + '" letter-spacing="' + m(0.6) + '">' + esc2(menuName) + '</text>');
    // 价格变化表示：原价删除线 + 现价红色
    function approxWidth(s, ufs) {
      var w = 0;
      for (var i = 0; i < s.length; i++) w += (s.charCodeAt(i) > 127) ? ufs : ufs * 0.55;
      return w;
    }
    if (priceChanged) {
      var labelY = iy + 4.8;
      var baseY = iy + 8.2;
      var totalY = iy + 13.8;
      var baseLabel = '原价 ' + basePriceStr;
      var baseFs = 2.5;
      var baseW = approxWidth(baseLabel, baseFs);
      parts.push('<text x="' + m(contentR - 2) + '" y="' + m(labelY) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(2.4) + '" fill="' + C.muted + '" letter-spacing="' + m(0.8) + '">本单总价</text>');
      parts.push('<text x="' + m(contentR - 2) + '" y="' + m(baseY) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(baseFs) + '" fill="' + C.muted + '">' + esc2(baseLabel) + '</text>');
      parts.push('<line x1="' + m(contentR - 2 - baseW) + '" y1="' + m(baseY - baseFs * 0.32) + '" x2="' + m(contentR - 2) + '" y2="' + m(baseY - baseFs * 0.32) + '" stroke="' + C.primary + '" stroke-width="' + m(baseFs * 0.11) + '"/>');
      parts.push('<text x="' + m(contentR - 2) + '" y="' + m(totalY) + '" text-anchor="end" font-family="' + FS + '" font-size="' + m(7.6) + '" font-weight="700" fill="' + C.primary + '">' + esc2(totalStr) + '<tspan font-size="' + m(2.6) + '" font-weight="400" dx="' + m(0.8) + '">元/桌</tspan></text>');
    } else {
      parts.push('<text x="' + m(contentR - 2) + '" y="' + m(iy + 6.5) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(2.6) + '" fill="' + C.muted + '" letter-spacing="' + m(1) + '">本单总价</text>');
      parts.push('<text x="' + m(contentR - 2) + '" y="' + m(iy + 14.5) + '" text-anchor="end" font-family="' + FS + '" font-size="' + m(8) + '" font-weight="700" fill="' + C.primary + '">' + esc2(totalStr) + '<tspan font-size="' + m(2.8) + '" font-weight="400" dx="' + m(0.8) + '">元/桌</tspan></text>');
    }

    // —— 无图双栏宴席清单（换菜/加菜直接在菜名后 inline 标注）——
    var menuTop = secTop;
    var availH = footerY - 4 - menuTop - BOTTOM_MARGIN;

    var segs = cats().map(function (cat) {
      return { cat: cat, rows: draft.lines.filter(function (l) { return l.cat === cat; }) };
    }).filter(function (s) { return s.rows.length; });
    var CN = { '凉菜': '壹', '主菜': '贰', '主食点心': '叁' };
    var plainCols = 2, plainGap = 8, plainW = (contentW - plainGap) / 2;
    var plainX = [SX, SX + plainW + plainGap];
    var plainY = [menuTop, menuTop];
    var colRows = [0, 0];
    segs.forEach(function (s) {
      var c = colRows[0] <= colRows[1] ? 0 : 1;
      colRows[c] += s.rows.length;
    });
    var maxColRows = Math.max(1, colRows[0], colRows[1]);
    // 总厨无图单也预留备注高度，手写或已填写备注都不会挤压下一道菜。
    var rowH2 = Math.min(21, Math.max(17, (availH - 40) / maxColRows));
    var targetCol = 0;
    segs.forEach(function (s, si) {
      targetCol = plainY[0] <= plainY[1] ? 0 : 1;
      var px2 = plainX[targetCol], py2 = plainY[targetCol];
      var headH2 = 12;
      parts.push('<rect x="' + m(px2) + '" y="' + m(py2) + '" width="' + m(plainW) + '" height="' + m(headH2) + '" rx="' + m(2.2) + '" fill="' + C.primary + '"/>');
      parts.push('<text x="' + m(px2 + 5) + '" y="' + m(py2 + 8) + '" font-family="' + FS + '" font-size="' + m(5) + '" font-weight="700" fill="#fff" letter-spacing="' + m(0.8) + '">' + (CN[s.cat] || '') + '  ' + esc2(s.cat) + '</text>');
      parts.push('<text x="' + m(px2 + plainW - 4) + '" y="' + m(py2 + 7.6) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(2.5) + '" fill="#F4DDB8">' + s.rows.length + ' 道</text>');
      py2 += headH2 + 2;
        s.rows.forEach(function (l, i) {
          var ry = py2 + i * rowH2;
          var cnMax = Math.max(11, Math.floor((plainW - 2) / 4.2));
          var cnStep = 4.4;
          var tmpLines = wrapCn(l.cn || '未命名菜品', cnMax);
          var cnBase = ry + 5.2 - (tmpLines.length - 1) * cnStep * .5;
          // 总厨单：换菜画删除线、换后菜名红色；加菜红色后缀
          renderDishName(parts, px2 + 1, cnBase, l, {
            m: m, FS: FS, C: C,
            maxChars: cnMax, fs: 4.4, step: cnStep,
            chefMode: true,
            rowWidth: plainW - 2
          });
        var chefNote = (l.note || '').trim();
        if (chefNote) {
          var chefNoteMax = Math.max(14, Math.floor((plainW - 2) / 2.4));
          if (chefNote.length > chefNoteMax) chefNote = chefNote.slice(0, chefNoteMax - 1) + '…';
          parts.push('<text x="' + m(px2 + 1) + '" y="' + m(ry + rowH2 - 4.2) + '" font-family="' + FN + '" font-size="' + m(2.25) + '" fill="' + C.primary + '">备注：' + esc2(chefNote) + '</text>');
        }
        parts.push('<line x1="' + m(px2) + '" y1="' + m(ry + rowH2 - 1.5) + '" x2="' + m(px2 + plainW) + '" y2="' + m(ry + rowH2 - 1.5) + '" stroke="' + C.line + '" stroke-width="' + m(0.35) + '"/>');
      });
      plainY[targetCol] = py2 + s.rows.length * rowH2 + 7;
    });
    parts.push('<line x1="' + m(105) + '" y1="' + m(menuTop) + '" x2="' + m(105) + '" y2="' + m(Math.max(plainY[0], plainY[1]) - 4) + '" stroke="' + C.goldHair + '" stroke-width="' + m(0.35) + '"/>');

    // —— 页脚 ——
    var fy = footerY;
    var fcx = 105, lineGap = 30, lineW = 18;
    parts.push('<line x1="' + m(fcx - lineGap - lineW) + '" y1="' + m(fy) + '" x2="' + m(fcx - lineGap) + '" y2="' + m(fy) + '" stroke="' + C.gold + '" stroke-width="' + m(0.5) + '"/>');
    parts.push('<line x1="' + m(fcx + lineGap) + '" y1="' + m(fy) + '" x2="' + m(fcx + lineGap + lineW) + '" y2="' + m(fy) + '" stroke="' + C.gold + '" stroke-width="' + m(0.5) + '"/>');
    parts.push('<text x="' + m(fcx) + '" y="' + m(fy + 1.0) + '" text-anchor="middle" font-family="' + FN + '" font-size="' + m(2.6) + '" fill="' + C.muted + '" letter-spacing="' + m(0.6) + '">本单仅作后厨备料参考，菜品请以实物为主</text>');

    parts.push('</svg>');
    return parts.join('');
  }

  // 一键导出总厨单（无图 PNG）
  function exportChef() {
    if (!draft) return;
    var svg = buildChefSVG();
    if (!svg) { try { alert('导出失败'); } catch (e) {} return; }
    var base = safeName(draft.client) + '-' + safeName(draft.type) + '-总厨单';
    // 总厨单为纯无图排版，无需预加载菜品图片，直接栅格化
    rasterize(svg, function (canvas) {
      if (!canvas) { try { alert('导出失败，请重试'); } catch (e) {} return; }
      canvas.toBlob(function (b) {
        if (b) downloadBlob(b, base + '.png');
        else { try { alert('导出失败，请重试'); } catch (e) {} }
      }, 'image/png');
    });
  }

  // —— 事件绑定 ——
  function init() {
    // 抬头可编辑
    var csType = $('#csType'), csClient = $('#csClient'), csTotal = $('#csTotal'), csCalc = $('#csCalc'), csCalcBase = $('#csCalcBase');
    if (csType) csType.addEventListener('input', function () { if (draft) { draft.type = csType.value; saveDraft(); } });
    if (csClient) csClient.addEventListener('input', function () { if (draft) { draft.client = csClient.value; saveDraft(); } });
    // 计算器：输入时仅消除提醒；回车＝应用加/减；点击整个计算框把光标送入 + 号后的输入框
    if (csTotal) {
      csTotal.addEventListener('input', function () {
        var calc = $('#csCalc'); if (calc) calc.classList.remove('shaking');
        var hint = $('#csPriceHint'); if (hint) hint.classList.remove('show');
      });
      csTotal.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); applyCalcDelta(); }
      });
    }
    // 总价支持直接改写；右侧小输入仍用于“加 / 减”的增量计算。
    if (csCalcBase) {
      csCalcBase.addEventListener('input', function () {
        if (!draft) return;
        var value = (csCalcBase.value || '').replace(/[^0-9.]/g, '');
        if (value !== csCalcBase.value) csCalcBase.value = value;
        draft.total = value;
        saveDraft();
      });
      csCalcBase.addEventListener('blur', function () {
        if (!draft) return;
        var parsed = parseFloat(draft.total);
        if (!isNaN(parsed) && parsed >= 0) { draft.total = String(parsed); csCalcBase.value = draft.total; saveDraft(); }
      });
    }
    if (csCalc) csCalc.addEventListener('click', function (e) { if (csTotal && e.target !== csCalcBase) { csTotal.focus(); } });

    // 草案内交互（事件委托）
    var body = $('#csBody');
    if (body) {
      body.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn) return;
        var rowEl = btn.closest('.cs-row');
        if (!rowEl) return;
        var id = rowEl.getAttribute('data-id');
        var line = findLine(id);
        if (!line) return;
        var act = btn.getAttribute('data-act');
        if (act === 'swap') {
          openPick(function (d) {
            var fromLib = line.libId, fromCn = line.cn;
            applyLibDish(line, d);
            line.swappedFrom = fromLib;       // 标记此行为换菜（旧 id）
            line.swappedFromCn = fromCn;       // 记录换菜前的菜名，供总厨单显示「A → 换 → B」
            saveDraft();
            render();
          }, line.id);
        } else if (act === 'del') {
          if (!line.added) draft.removedLines.push(Object.assign({}, line));
          draft.lines = draft.lines.filter(function (l) { return l.id !== id; });
          saveDraft();
          render();
        }
      });
      body.addEventListener('input', function (e) {
        if (e.target.classList && e.target.classList.contains('cs-row-note')) {
          var rowEl = e.target.closest('.cs-row');
          var line = rowEl && findLine(rowEl.getAttribute('data-id'));
          if (line) { line.note = e.target.value; saveDraft(); }
        }
      });
    }

    // 添加菜品
    var addBtn = $('#csAddBtn');
    if (addBtn) addBtn.addEventListener('click', function () {
      openPick(function (d) {
        var line = { id: newLineId(), libId: d.id, cat: d.cat || '主菜', cn: d.cn || '', en: d.en || '', image: d.image || null, crop: d.crop || null, note: '', swappedFrom: null, added: true };
        draft.lines.push(line);
        saveDraft();
        render();
      });
    });

    // 选择器
    var pickCat = $('#csPickCat');
    if (pickCat) pickCat.addEventListener('change', function () { renderPick(pickCat.value, ($('#csPickSearch') || {}).value || ''); });
    var pickSearch = $('#csPickSearch');
    if (pickSearch) pickSearch.addEventListener('input', function () { renderPick((pickCat || {}).value || '', pickSearch.value); });
    var pickGrid = $('#csPickGrid');
    if (pickGrid) pickGrid.addEventListener('click', function (e) {
      var card = e.target.closest ? e.target.closest('.cs-pick-card') : null;
      if (!card || !pickMode) return;
      var lid = card.getAttribute('data-libid');
      var d = Store.getLibDish(lid);
      if (!d) return;
      // 去重：换菜时排除当前行，添加时全量检查
      if (isDuplicate(lid, pickMode.excludeId)) {
        alert('「' + (d.cn || '该菜品') + '」已在当前定制单中，不能重复添加。');
        return;
      }
      if (d && pickMode.onPick) pickMode.onPick(d);
      closePick();
    });

    // 导出
    var expBtn = $('#csExportBtn');
    if (expBtn) expBtn.addEventListener('click', function () { closeExpMenu(); openExport(); });
    var expConfirm = $('#expConfirm');
    if (expConfirm) expConfirm.addEventListener('click', function () { doExport(); closeExport(); });

    // 导出下拉（存为图片 / 导出给总厨）
    var expCaret = $('#csExportCaret');
    var expMenu = $('#csExportMenu');
    var expDropdown = $('#csExportDropdown');
    function closeExpMenu() {
      if (expMenu) expMenu.hidden = true;
      if (expCaret) expCaret.setAttribute('aria-expanded', 'false');
    }
    if (expCaret) expCaret.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!expMenu) return;
      var open = expMenu.hidden;
      expMenu.hidden = !open;
      expCaret.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    if (expMenu) expMenu.addEventListener('click', function (e) { e.stopPropagation(); });
    var expChef = $('#csExportChef');
    if (expChef) expChef.addEventListener('click', function () { closeExpMenu(); exportChef(); });
    // 点击别处自动收起下拉
    document.addEventListener('click', function (e) {
      if (expDropdown && expMenu && !expDropdown.contains(e.target)) closeExpMenu();
    });
    $$('.exp-fmt').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.exp-fmt').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        expFmt = b.getAttribute('data-fmt') || 'png';
        renderExpPreview();
      });
    });

    // 导出版本切换（radio + .exp-opt.on 切换 + 预览刷新）
    $$('.exp-opt').forEach(function (opt) {
      opt.addEventListener('click', function () {
        $$('.exp-opt').forEach(function (x) { x.classList.remove('on'); });
        opt.classList.add('on');
        // 选中对应 radio（点击 label 时浏览器已处理，但确保一致性）
        var radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        renderExpPreview();
      });
    });

    // 字号档位已从定制导出弹窗移除，保留空槽位不绑定任何按钮

    // 弹窗关闭（data-close）
    $$('[data-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-close');
        var m = document.getElementById(id);
        if (m) m.hidden = true;
        if (id === 'customPickModal') pickMode = null;
      });
    });
    // 点击遮罩关闭
    [$('#customPickModal'), $('#exportModal')].forEach(function (m) {
      if (!m) return;
      m.addEventListener('click', function (e) { if (e.target === m) { m.hidden = true; if (m.id === 'customPickModal') pickMode = null; } });
    });
  }

  window.CustomOrder = {
    enter: enter, render: render,
    // —— 整份菜单导出（供 app.js 调用；二维码分享已按产品定义移除）——
    buildPackageSVG: buildPackageSVG, buildMultiPagePdf: buildMultiPagePdf, renderPackageLandscapeCanvas: renderPackageLandscapeCanvas,
    exportWholeMenu: exportWholeMenu,
    // —— 总厨单（无图 + 变更说明）——
    buildChefSVG: buildChefSVG, exportChef: exportChef,
    // —— 下载（供测试钩子）——
    downloadBlob: downloadBlob, isIOS: isIOS, isWeChat: isWeChat,
    // —— 测试钩子 ——
    _buildSVG: buildSVG, _buildPhotoLandscapeSVG: buildPhotoLandscapeSVG, _buildMobileSVG: buildMobileSVG, _doExport: doExport, _getExpScale: getExpScale, _buildPdfWithJpeg: buildPdfWithJpeg, _buildChefSVG: buildChefSVG,
    _setTotal: function (v) { if (draft) { draft.total = v; saveDraft(); var b = document.getElementById('csCalcBase'); if (b) b.value = v || '0'; } },
    _openExport: openExport, _preloadImages: preloadImages, _getDraft: function () { return draft; },
    getDraftBanquet: function () { return draft ? draft.banquetId : null; },
    getDraftPkg: function () { return draft ? draft.pkgId : null; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
