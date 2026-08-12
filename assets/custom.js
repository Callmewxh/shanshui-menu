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
  // 品牌名（从设置读取，fallback 默认值）
  function getBrandName() {
    try { return localStorage.getItem('ss_brand_name') || '山水S酒店'; } catch(e) { return '山水S酒店'; }
  }
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
    ctx.fillStyle = '#EDE4D3';
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

  // 预加载所有菜品图片，按 crop 渲染成 4:3 缩略图存到 line._thumb
  // cb(lines)：所有图片处理完后调用
  function preloadImages(lines, cb) {
    var pending = lines.filter(function (l) { return l.image && !l._thumb && l._thumb !== null; });
    if (!pending.length) { cb(lines); return; }
    var remain = pending.length;
    pending.forEach(function (l) {
      var im = new Image();
      im.onload = function () {
        l._thumb = renderThumb(im, l.crop);
        if (--remain === 0) cb(lines);
      };
      im.onerror = function () {
        l._thumb = null;
        if (--remain === 0) cb(lines);
      };
      im.src = l.image;
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

  // 构造导出 SVG（thumb=带图版三列网格；plain=无图排版）
  // k: 字号/行距缩放（三档界面大小），固定 pageW 保证手机端字号相对更大、更利于长辈阅读
  // lines 需预先 preloadImages 处理过 _thumb（4:3 JPEG 缩略图）
  function buildSVG(ver, k) {
    k = k || 1;
    var pageW = ver === 'thumb' ? 1080 : 860;
    var M = Math.round(48 * k);
    var headerH = Math.round(168 * k);
    var contentW = pageW - M * 2;

    var fHead = 40 * k, fSub = 17 * k, fTotal = 32 * k, fTotalLbl = 14 * k;
    var fCat = 26 * k, fCn = 21 * k, fNote = 14 * k, fPlain = 19 * k, fPlainNote = 14 * k, fNoImg = 15 * k;

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
      bodyParts.push('<text x="' + M + '" y="' + (y + 28 * k) + '" font-family="' + FONT_SERIF + '" font-size="' + fCat + '" font-weight="700" fill="#B23A2E" letter-spacing="2">' + esc(cat) + '</text>');
      bodyParts.push('<rect x="' + M + '" y="' + (y + 38 * k) + '" width="' + (42 * k) + '" height="' + (3 * k) + '" rx="' + (1.5 * k) + '" fill="#C2A15A"/>');
      // 分类右侧细金线（装饰）
      bodyParts.push('<line x1="' + (M + 52 * k) + '" y1="' + (y + 39 * k) + '" x2="' + (pageW - M) + '" y2="' + (y + 39 * k) + '" stroke="#E8DCBE" stroke-width="' + (1 * k) + '"/>');
      y += 58 * k;

      if (ver === 'thumb') {
        var gap = Math.round(20 * k);
        var cellW = (contentW - gap * 2) / 3;
        // 图片区必须是 4:3（跟菜品库 .mg-thumb aspect-ratio 一致），用扣除内边距后的 tw 算 th
        var tw = cellW - 16 * k;
        var thumbH = Math.round(tw * 0.75);
        // 文字区高度：单行菜名 + 备注行 + 内边距；k 越大留越多
        var cellTextH = Math.round(82 * k);
        var cellH = thumbH + cellTextH;
        // 每行最多字数（按 k 缩放，特大档更严格）
        var maxChars = k >= 1.5 ? 6 : (k >= 1.2 ? 7 : 8);

        lines.forEach(function (l, i) {
          var cx = M + (i % 3) * (cellW + gap);
          var cy = y + Math.floor(i / 3) * (cellH + gap);
          // 卡片背景 + 细边框（新中式克制风格）
          bodyParts.push('<rect x="' + cx + '" y="' + cy + '" width="' + cellW + '" height="' + cellH + '" rx="' + (12 * k) + '" fill="#FFFFFF" stroke="#E8DCBE" stroke-width="' + (1 * k) + '"/>');
          var tx = cx + 8 * k, ty = cy + 8 * k;
          var th = thumbH;
          if (l._thumb) {
            // 优先用 preloadImages 预渲染的 4:3 JPEG（rasterize 路径稳定支持）
            bodyParts.push('<image href="' + l._thumb + '" xlink:href="' + l._thumb + '" x="' + tx + '" y="' + ty + '" width="' + tw + '" height="' + th + '" preserveAspectRatio="none"/>');
          } else if (l.image) {
            // 预加载失败 fallback：直接用原图 + 居中裁切
            bodyParts.push('<image href="' + l.image + '" xlink:href="' + l.image + '" x="' + tx + '" y="' + ty + '" width="' + tw + '" height="' + th + '" preserveAspectRatio="xMidYMid slice"/>');
          } else {
            // 无图占位
            bodyParts.push('<rect x="' + tx + '" y="' + ty + '" width="' + tw + '" height="' + th + '" rx="' + (8 * k) + '" fill="#EDE4D3"/>');
            bodyParts.push('<text x="' + (tx + tw / 2) + '" y="' + (ty + th / 2 + 5 * k) + '" text-anchor="middle" font-family="' + FONT_SANS + '" font-size="' + fNoImg + '" fill="#B8A07A">无图</text>');
          }
          // 菜名（最多两行，超长截断）
          var nameLines = wrapCn(l.cn || '未命名菜品', maxChars);
          var cnY = cy + thumbH + 30 * k;
          var cnX = cx + 10 * k;
          bodyParts.push('<text x="' + cnX + '" y="' + cnY + '" font-family="' + FONT_SERIF + '" font-size="' + fCn + '" font-weight="600" fill="#3A2E26">' + esc(nameLines[0]) + '</text>');
          if (nameLines[1]) {
            bodyParts.push('<text x="' + cnX + '" y="' + (cnY + 26 * k) + '" font-family="' + FONT_SERIF + '" font-size="' + fCn + '" font-weight="600" fill="#3A2E26">' + esc(nameLines[1]) + '</text>');
          }
          // 备注截断 + 显示
          if (l.note) {
            var noteMax = maxChars + 4;
            var noteText = l.note.length > noteMax ? (l.note.slice(0, noteMax - 1) + '…') : l.note;
            var noteY = nameLines[1] ? (cnY + 52 * k) : (cnY + 24 * k);
            bodyParts.push('<text x="' + cnX + '" y="' + noteY + '" font-family="' + FONT_SANS + '" font-size="' + fNote + '" fill="#B23A2E">' + esc(noteText) + '</text>');
          }
        });
        var rows = Math.ceil(lines.length / 3);
        y += rows * (cellH + gap);
      } else {
        var rowH = Math.round(44 * k);
        var plainMax = Math.floor(contentW / (fPlain * 0.95));
        lines.forEach(function (l, i) {
          var dishText = esc(l.cn || '未命名菜品');
          if (dishText.length > plainMax + 6) {
            dishText = esc((l.cn || '').slice(0, plainMax + 5) + '…');
          }
          var lineParts = ['<text x="' + M + '" y="' + (y + 28 * k) + '" font-family="' + FONT_SERIF + '" font-size="' + fPlain + '" fill="#3A2E26">'];
          // 菜名（黑色）
          lineParts.push('<tspan>' + dishText + '</tspan>');
          if (l.note) {
            var noteMax = plainMax + 6;
            var nt = l.note.length > noteMax ? (l.note.slice(0, noteMax - 1) + '…') : l.note;
            lineParts.push('<tspan font-family="' + FONT_SANS + '" font-size="' + fPlainNote + '" fill="#B23A2E">  （' + esc(nt) + '）</tspan>');
          }
          lineParts.push('</text>');
          bodyParts.push(lineParts.join(''));
          bodyParts.push('<line x1="' + M + '" y1="' + (y + rowH - 6 * k) + '" x2="' + (M + contentW) + '" y2="' + (y + rowH - 6 * k) + '" stroke="#F0E8D8" stroke-width="' + (1 * k) + '"/>');
          y += rowH;
        });
        y += 8 * k;
      }
    });

    // 页脚：留白即可，不显示品牌名水印（用户反馈难看）
    var pageH = Math.round(y + 48 * k);
    // 内边距：页面内容区缩进，形成外框效果
    var outerM = Math.round(14 * k);
    var innerW = pageW - outerM * 2;
    var innerH = pageH - outerM * 2;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + pageW + '" height="' + pageH + '" viewBox="0 0 ' + pageW + ' ' + pageH + '">' +
      // 页面底色
      '<rect width="' + pageW + '" height="' + pageH + '" fill="#F5F0E6"/>' +
      // 外框（新中式细线）
      '<rect x="' + outerM + '" y="' + outerM + '" width="' + innerW + '" height="' + innerH + '" rx="' + (10 * k) + '" fill="none" stroke="#D8C7A6" stroke-width="' + (1.5 * k) + '"/>' +
      // 顶部品牌条
      '<rect x="0" y="0" width="' + pageW + '" height="' + (8 * k) + '" fill="#B23A2E"/>' +
      // 抬头
      '<text x="' + M + '" y="' + (70 * k) + '" font-family="' + FONT_SERIF + '" font-size="' + fHead + '" font-weight="700" fill="#B23A2E" letter-spacing="1">' + esc(client) + ' · ' + esc(type) + '</text>' +
      '<text x="' + M + '" y="' + (100 * k) + '" font-family="' + FONT_SANS + '" font-size="' + fSub + '" fill="#A88A5E" letter-spacing="1">' + esc(getBrandName()) + ' · 宴席定制单</text>' +
      '<text x="' + (pageW - M) + '" y="' + (70 * k) + '" text-anchor="end" font-family="' + FONT_SERIF + '" font-size="' + fTotal + '" font-weight="700" fill="#8A6D1F" letter-spacing="1">' + esc(totalStr) + '</text>' +
      '<text x="' + (pageW - M) + '" y="' + (98 * k) + '" text-anchor="end" font-family="' + FONT_SANS + '" font-size="' + fTotalLbl + '" fill="#A88A5E">本单总价（元 / 桌）</text>' +
      '<line x1="' + M + '" y1="' + (124 * k) + '" x2="' + (pageW - M) + '" y2="' + (124 * k) + '" stroke="#D8C7A6" stroke-width="' + (1.5 * k) + '"/>' +
      bodyParts.join('') +
      // 底部装饰金线（无文字水印）
      '<line x1="' + M + '" y1="' + (pageH - 24 * k) + '" x2="' + (pageW - M) + '" y2="' + (pageH - 24 * k) + '" stroke="#E8DCBE" stroke-width="' + (1 * k) + '"/>' +
      '<rect x="' + (pageW / 2 - 6 * k) + '" y="' + (pageH - 28 * k) + '" width="' + (12 * k) + '" height="' + (3 * k) + '" rx="' + (1.5 * k) + '" fill="#C2A15A"/>' +
      '</svg>';
    return svg;
  }

  // 当前字号档位（三档：标准1 / 大1.3 / 特大1.6）
  function getExpScale() {
    var el = $('.exp-size-btn.on');
    var s = el ? parseFloat(el.getAttribute('data-scale')) : 1;
    return isNaN(s) || s <= 0 ? 1 : s;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  function safeName(s) { return (s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '定制单'; }

  // 高清倍率：手机端查看更清晰
  var EXPORT_DPR = 2;

  // 将 SVG 栅格化到 canvas（高清），回调 (canvas)
  function rasterize(svg, cb) {
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
      cb(canvas);
    };
    img.onerror = function () { cb(null); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
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

  // 价格未填提醒：红字晃动 + 输入框高亮，并返回是否需要拦截
  function triggerPriceHint() {
    var csTotal = $('#csTotal');
    var hint = $('#csPriceHint');
    if (csTotal) {
      csTotal.classList.add('shaking');
      setTimeout(function () { csTotal.classList.remove('shaking'); }, 1200);
      csTotal.focus(); csTotal.select();
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
    var base = safeName(draft.client) + '-' + safeName(draft.type) + '-定制单';
    // 预加载所有菜品图片获取原始尺寸，确保 SVG 裁切与菜品库一致
    preloadImages(draft.lines, function () {
      var svg = buildSVG(ver, k);
      rasterize(svg, function (canvas) {
        if (!canvas) { alert('导出失败，请重试'); return; }
        if (expFmt === 'pdf') {
          canvasToPdfBlob(canvas, base, function (blob, name) {
            if (blob) downloadBlob(blob, name);
            else canvas.toBlob(function (b) { if (b) downloadBlob(b, base + '.png'); }, 'image/png');
          });
        } else {
          canvas.toBlob(function (b) {
            if (b) downloadBlob(b, base + '.png');
            else alert('导出失败，请重试');
          }, 'image/png');
        }
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
    preloadImages(draft.lines, function () {
      var svg = buildSVG(ver, k);
      container.innerHTML = svg;
      // 缩放预览适应容器
      var svgs = container.querySelector('svg');
      if (svgs) { svgs.style.width = '100%'; svgs.style.height = 'auto'; svgs.style.maxHeight = '280px'; }
    });
  }

  // —— 事件绑定 ——
  function init() {
    // 抬头可编辑
    var csType = $('#csType'), csClient = $('#csClient'), csTotal = $('#csTotal');
    if (csType) csType.addEventListener('input', function () { if (draft) draft.type = csType.value; });
    if (csClient) csClient.addEventListener('input', function () { if (draft) draft.client = csClient.value; });
    if (csTotal) csTotal.addEventListener('input', function () { if (draft) draft.total = csTotal.value; var hint = $('#csPriceHint'); if (hint) hint.classList.remove('show'); csTotal.classList.remove('shaking'); });

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

    // 字号档位切换（三档界面大小）
    $$('.exp-size-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.exp-size-btn').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
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

  window.CustomOrder = { enter: enter, render: render, _buildSVG: buildSVG, _doExport: doExport, _getExpScale: getExpScale, _buildPdfWithJpeg: buildPdfWithJpeg, _setTotal: function (v) { if (draft) draft.total = v; }, _openExport: openExport, _preloadImages: preloadImages, _getDraft: function () { return draft; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
