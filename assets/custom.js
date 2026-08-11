/* 山水S酒店 · 定制单（宴席定制报价单）
 * 纯内存草案：从当前点菜端选中的宴席/套餐克隆菜品，可换菜、加备注、改总价，
 * 导出带缩略图版 / 无图版（PNG / SVG）。不回写菜品库或标准菜单。
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var CATS = ['凉菜', '主菜', '主食点心'];
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  // —— 裁剪背景（与 assets/app.js 的 cropBg 同源，自包含，保证展示/导出一致）——
  function cropBgStyle(d) {
    var c = d && d.crop ? d.crop : null;
    if (c && typeof c.w === 'number') {
      var w = clamp(c.w, 0.05, 1), h = clamp((typeof c.h === 'number' ? c.h : w * 0.75), 0.05, 1);
      var x = clamp(c.x, 0, 1 - w), y = clamp(c.y, 0, 1 - h);
      var sizeW = (100 / w).toFixed(3), sizeH = (100 / h).toFixed(3);
      var posX = (1 - w < 1e-4) ? '0' : (x / (1 - w) * 100).toFixed(2);
      var posY = (1 - h < 1e-4) ? '0' : (y / (1 - h) * 100).toFixed(2);
      return 'background-image:url(\'' + d.image + '\');background-size:' + sizeW + '% ' + sizeH + '%;background-position:' + posX + '% ' + posY + '%;background-repeat:no-repeat;background-color:#EDE4D3;';
    }
    var y = (c && typeof c.y === 'number') ? c.y : 50;
    return 'background-image:url(\'' + (d.image || '') + '\');background-size:cover;background-position:50% ' + y + '%;background-repeat:no-repeat;background-color:#EDE4D3;';
  }

  // —— 草案（纯内存）——
  var draft = null;
  // draft.lines: [{ id, libId, cat, cn, en, image, crop, note, swappedFrom }]

  function newLineId() { return 'L' + Math.random().toString(36).slice(2, 9); }

  function enter(banquetId, pkgId) {
    if (!Store || !Store.resolvePackage) return;
    var b = Store.getBanquet(banquetId);
    var pkg = Store.getPackage(banquetId, pkgId);
    var dishes = Store.resolvePackage(banquetId, pkgId) || [];
    draft = {
      banquetId: banquetId,
      pkgId: pkgId,
      type: (b && b.name) ? b.name : '宴席',
      client: '',
      total: '',
      source: pkg ? (pkg.name || pkgId) : '',
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
          swappedFrom: null
        };
      })
    };
    var t = $('#csType'), c = $('#csClient'), src = $('#csSource'), tot = $('#csTotal');
    if (t) t.value = draft.type;
    if (c) c.value = draft.client;
    if (src) src.textContent = '来源：' + (draft.source || '—');
    if (tot) tot.value = draft.total;
    render();
  }

  function render() {
    var body = $('#csBody');
    if (!body || !draft) return;
    body.innerHTML = '';
    var hasAny = false;
    CATS.forEach(function (cat) {
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
  function getExpVer() {
    var r = document.querySelector('input[name="expVer"]:checked');
    return r ? r.value : 'thumb';
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

  // 构造导出 SVG（thumb=带缩略图三列网格；plain=无图对齐排版）
  function buildSVG(ver) {
    var pageW = ver === 'thumb' ? 1080 : 860;
    var M = 48;
    var headerH = 168;
    var contentW = pageW - M * 2;

    var client = (draft.client || '').trim() || '贵宾';
    var type = (draft.type || '').trim() || '宴席';
    var total = (draft.total || '').toString().trim();
    var totalStr = total ? '¥ ' + total : '—';

    var bodyParts = [];
    var y = headerH;

    CATS.forEach(function (cat) {
      var lines = draft.lines.filter(function (l) { return l.cat === cat; });
      if (!lines.length) return;
      // 分类标题
      bodyParts.push('<text x="' + M + '" y="' + (y + 30) + '" font-family="serif" font-size="30" font-weight="700" fill="#B23A2E">' + esc(cat) + '</text>');
      bodyParts.push('<rect x="' + M + '" y="' + (y + 42) + '" width="46" height="4" rx="2" fill="#C2A15A"/>');
      y += 64;

      if (ver === 'thumb') {
        var gap = 22;
        var cellW = (contentW - gap * 2) / 3;
        var thumbH = Math.round(cellW * 0.75);
        var cellTextH = 76; // 增加文字区高度，给备注留空间
        var cellH = thumbH + cellTextH;
        lines.forEach(function (l, i) {
          var cx = M + (i % 3) * (cellW + gap);
          var cy = y + Math.floor(i / 3) * (cellH + gap);
          bodyParts.push('<rect x="' + cx + '" y="' + cy + '" width="' + cellW + '" height="' + cellH + '" rx="14" fill="#FBF7EE" stroke="#ECE3D2"/>');
          var tx = cx + 10, ty = cy + 10, tw = cellW - 20, th = thumbH;
          bodyParts.push('<clipPath id="clip_' + l.id + '"><rect x="' + tx + '" y="' + ty + '" width="' + tw + '" height="' + th + '" rx="10"/></clipPath>');
          bodyParts.push('<rect x="' + tx + '" y="' + ty + '" width="' + tw + '" height="' + th + '" rx="10" fill="#EDE4D3"/>');
          if (l.image) {
            var c = l.crop;
            var inner;
            if (c && typeof c.w === 'number') {
              var iw = (tw / c.w).toFixed(2), ih = (th / c.h).toFixed(2);
              var ix = (-tw * (c.x) / c.w).toFixed(2), iy = (-th * (c.y) / c.h).toFixed(2);
              inner = '<image href="' + l.image + '" xlink:href="' + l.image + '" x="' + ix + '" y="' + iy + '" width="' + iw + '" height="' + ih + '" preserveAspectRatio="none"/>';
            } else {
              inner = '<image href="' + l.image + '" xlink:href="' + l.image + '" x="' + tx + '" y="' + ty + '" width="' + tw + '" height="' + th + '" preserveAspectRatio="xMidYMid slice"/>';
            }
            bodyParts.push('<g clip-path="url(#clip_' + l.id + ')">' + inner + '</g>');
          } else {
            bodyParts.push('<text x="' + (tx + tw / 2) + '" y="' + (ty + th / 2 + 6) + '" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#A88A5E">无图</text>');
          }
          var cnY = cy + thumbH + 36;
          bodyParts.push('<text x="' + (cx + 14) + '" y="' + cnY + '" font-family="serif" font-size="22" font-weight="600" fill="#3A2E26">' + esc(l.cn || '未命名菜品') + '</text>');
          if (l.note) {
            // 备注紧跟菜名下方，左对齐，有足够内边距
            bodyParts.push('<text x="' + (cx + 14) + '" y="' + (cnY + 26) + '" font-family="sans-serif" font-size="14" fill="#B23A2E">' + esc(l.note) + '</text>');
          }
        });
        var rows = Math.ceil(lines.length / 3);
        y += rows * (cellH + gap);
      } else {
        var rowH = 46;
        lines.forEach(function (l) {
          // 文字版：菜名 + 备注在同一行，备注紧跟菜名后面
          var dishText = esc(l.cn || '未命名菜品');
          if (l.note) dishText += '  <tspan font-family="sans-serif" font-size="15" fill="#B23A2E">（' + esc(l.note) + '）</tspan>';
          bodyParts.push('<text x="' + M + '" y="' + (y + 28) + '" font-family="serif" font-size="20" fill="#3A2E26">' + dishText + '</text>');
          bodyParts.push('<line x1="' + M + '" y1="' + (y + rowH - 6) + '" x2="' + (M + contentW) + '" y2="' + (y + rowH - 6) + '" stroke="#F0E8D8"/>');
          y += rowH;
        });
        y += 8;
      }
    });

    var pageH = y + 60;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + pageW + '" height="' + pageH + '" viewBox="0 0 ' + pageW + ' ' + pageH + '">' +
      '<rect width="' + pageW + '" height="' + pageH + '" fill="#F5F0E6"/>' +
      // 顶部品牌条
      '<rect x="0" y="0" width="' + pageW + '" height="10" fill="#B23A2E"/>' +
      // 抬头
      '<text x="' + M + '" y="74" font-family="serif" font-size="44" font-weight="700" fill="#B23A2E">' + esc(client) + ' · ' + esc(type) + '</text>' +
      '<text x="' + M + '" y="106" font-family="sans-serif" font-size="18" fill="#A88A5E">山水S酒店 · 宴席定制单</text>' +
      '<text x="' + (pageW - M) + '" y="74" text-anchor="end" font-family="serif" font-size="34" font-weight="700" fill="#8A6D1F">' + esc(totalStr) + '</text>' +
      '<text x="' + (pageW - M) + '" y="104" text-anchor="end" font-family="sans-serif" font-size="15" fill="#A88A5E">本单总价（元 / 桌）</text>' +
      '<line x1="' + M + '" y1="132" x2="' + (pageW - M) + '" y2="132" stroke="#D8C7A6" stroke-width="1.5"/>' +
      bodyParts.join('') +
      '</svg>';
    return svg;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  function safeName(s) { return (s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '定制单'; }

  function doExport() {
    if (!draft) return;
    var ver = getExpVer();
    var svg = buildSVG(ver);
    var base = safeName(draft.client) + '-' + safeName(draft.type) + '-定制单';
    if (expFmt === 'svg') {
      var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      downloadBlob(blob, base + '.svg');
    } else {
      var xml = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      var img = new Image();
      img.onload = function () {
        var w = ver === 'thumb' ? 1080 : 860;
        // 高度从 viewBox 推断
        var vb = (img.width && img.height) ? { w: img.width, h: img.height } : { w: w, h: 600 };
        var canvas = document.createElement('canvas');
        canvas.width = vb.w; canvas.height = vb.h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#F5F0E6';
        ctx.fillRect(0, 0, vb.w, vb.h);
        ctx.drawImage(img, 0, 0, vb.w, vb.h);
        canvas.toBlob(function (b) {
          if (b) downloadBlob(b, base + '.png');
          else { // 兜底：直接下 SVG
            downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), base + '.svg');
          }
        }, 'image/png');
      };
      img.onerror = function () {
        downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), base + '.svg');
      };
      img.src = xml;
    }
  }

  function openExport() {
    var m = $('#exportModal');
    if (m) m.hidden = false;
    renderExpPreview();
  }
  function closeExport() {
    var m = $('#exportModal');
    if (m) m.hidden = true;
  }

  // 预览：在导出弹窗内渲染缩小版 SVG
  function renderExpPreview() {
    var container = $('#expPreview');
    if (!container || !draft) return;
    var ver = getExpVer();
    var svg = buildSVG(ver);
    container.innerHTML = svg;
    // 缩放预览适应容器
    var svgs = container.querySelector('svg');
    if (svgs) { svgs.style.width = '100%'; svgs.style.height = 'auto'; svgs.style.maxHeight = '280px'; }
  }

  // —— 事件绑定 ——
  function init() {
    // 抬头可编辑
    var csType = $('#csType'), csClient = $('#csClient'), csTotal = $('#csTotal');
    if (csType) csType.addEventListener('input', function () { if (draft) draft.type = csType.value; });
    if (csClient) csClient.addEventListener('input', function () { if (draft) draft.client = csClient.value; });
    if (csTotal) csTotal.addEventListener('input', function () { if (draft) draft.total = csTotal.value; });

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
          openPick(function (d) { applyLibDish(line, d); line.swappedFrom = line.libId; render(); }, line.id);
        } else if (act === 'del') {
          draft.lines = draft.lines.filter(function (l) { return l.id !== id; });
          render();
        }
      });
      body.addEventListener('input', function (e) {
        if (e.target.classList && e.target.classList.contains('cs-row-note')) {
          var rowEl = e.target.closest('.cs-row');
          var line = rowEl && findLine(rowEl.getAttribute('data-id'));
          if (line) line.note = e.target.value;
        }
      });
    }

    // 添加菜品
    var addBtn = $('#csAddBtn');
    if (addBtn) addBtn.addEventListener('click', function () {
      openPick(function (d) {
        var line = { id: newLineId(), libId: d.id, cat: d.cat || '主菜', cn: d.cn || '', en: d.en || '', image: d.image || null, crop: d.crop || null, note: '', swappedFrom: null };
        draft.lines.push(line);
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
    if (expBtn) expBtn.addEventListener('click', openExport);
    var expConfirm = $('#expConfirm');
    if (expConfirm) expConfirm.addEventListener('click', function () { doExport(); closeExport(); });
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

  window.CustomOrder = { enter: enter, render: render, _buildSVG: buildSVG, _doExport: doExport };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
