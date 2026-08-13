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

  // 构造导出 SVG（A4 竖版单页：thumb=带图版 4×4 网格 / plain=无图版分品类段）
  // 带图版沿用 v2.2 效果：单一 4×4 网格（按菜单顺序排，无分类段标题），图片按菜品库裁剪一致。
  // 缩略图用 preloadImages 预渲染的 4:3 JPEG（_thumb），rasterize 用 Blob URL 保证图片不丢失。
  // 整体按 A4(210×297mm) 比例出图，rasterize→PDF 时自动得到标准 A4 页面。
  function buildSVG(ver, k) {
    k = k || 1;
    var MM = 5.90476; // px per mm @ k=1
    var m = function (mm) { return +(mm * MM * k).toFixed(2); };
    var PAGE_W = m(210), PAGE_H = m(297);

    var C = {
      bg: '#F5F0E6', surface: '#FFFFFF', ink: '#3A2E26', muted: '#A88A5E',
      primary: '#B23A2E', gold: '#C2A15A', goldDeep: '#8A6D1F', goldHair: '#D8C7A6', line: '#ECE3D2'
    };
    var FS = FONT_SERIF;
    var FK = '&quot;KaiTi&quot;, &quot;STKaiti&quot;, &quot;楷体&quot;, serif';
    var FN = FONT_SANS;

    function esc2(s) { return esc(s); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    var client = (draft.client || '').trim() || '贵宾';
    var type = (draft.type || '').trim() || '宴席';
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
      for (var ci = 0; ci < CATS.length; ci++) {
        var cr = 0;
        for (var di = 0; di < draft.lines.length; di++) {
          if (draft.lines[di].cat === CATS[ci]) cr++;
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
    parts.push('<rect x="0" y="0" width="' + PAGE_W + '" height="' + m(topBandH) + '" fill="' + C.primary + '"/>');
    parts.push('<rect x="0" y="' + m(topBandH) + '" width="' + PAGE_W + '" height="' + m(0.8) + '" fill="' + C.gold + '"/>');

    // —— 抬头 ——
    var hy = PAD_T + 2;
    parts.push('<rect x="' + m(SX) + '" y="' + m(hy) + '" width="' + m(13) + '" height="' + m(13) + '" rx="' + m(3) + '" fill="' + C.primary + '"/>');
    parts.push('<text x="' + m(SX + 6.5) + '" y="' + m(hy + 9.5) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(8) + '" font-weight="700" fill="#fff">S</text>');
    parts.push('<text x="' + m(SX + 17) + '" y="' + m(hy + 9) + '" font-family="' + FK + '" font-size="' + m(7.4) + '" font-weight="700" fill="' + C.primary + '" letter-spacing="' + m(0.8) + '">' + esc2('山水S酒店') + '</text>');
    parts.push('<text x="' + m(SX + 17) + '" y="' + m(hy + 13) + '" font-family="' + FN + '" font-size="' + m(2.8) + '" fill="' + C.muted + '" letter-spacing="' + m(1.6) + '">SHANSHUI HOTEL</text>');
    parts.push('<text x="' + m(contentR) + '" y="' + m(hy + 9) + '" text-anchor="end" font-family="' + FK + '" font-size="' + m(9.5) + '" font-weight="700" fill="' + C.ink + '" letter-spacing="' + m(1.6) + '">宴席定制单</text>');
    parts.push('<text x="' + m(contentR) + '" y="' + m(hy + 13.5) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(2.8) + '" fill="' + C.goldDeep + '" letter-spacing="' + m(1.8) + '">BANQUET CUSTOM ORDER</text>');

    // —— 信息条：左(客户) / 中(宴席) / 右(红色价格块) 三段式，左右视觉重量平衡 ——
    var iy = hy + 15, infoH = 17;
    parts.push('<rect x="' + m(SX) + '" y="' + m(iy) + '" width="' + m(contentW) + '" height="' + m(infoH) + '" rx="' + m(2.6) + '" fill="#FFFDF7" stroke="' + C.line + '" stroke-width="' + m(0.4) + '"/>');
    // 左：金色细竖条 + 客户名（衬线大字），给左段一个明确的视觉边界
    parts.push('<rect x="' + m(SX + 2) + '" y="' + m(iy + 3) + '" width="' + m(0.6) + '" height="' + m(infoH - 6) + '" fill="' + C.gold + '"/>');
    parts.push('<text x="' + m(SX + 6.5) + '" y="' + m(iy + 11.5) + '" font-family="' + FS + '" font-size="' + m(6.4) + '" font-weight="700" fill="' + C.ink + '">' + esc2(client) + '</text>');
    // 中：宴席类型居中 + 下方金线（填满中间空白，平衡左右）
    var infoCx = contentL + contentW / 2;
    var typeText = esc2(type);
    parts.push('<text x="' + m(infoCx) + '" y="' + m(iy + 10.5) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(4.2) + '" font-weight="700" fill="' + C.goldDeep + '" letter-spacing="' + m(0.4) + '">' + typeText + '</text>');
    parts.push('<rect x="' + m(infoCx - 10) + '" y="' + m(iy + 13) + '" width="' + m(20) + '" height="' + m(0.5) + '" fill="' + C.gold + '"/>');
    // 右：红色价格块（宽度稍减，与左段视觉重量接近）
    var pw = 36, px = contentR - pw;
    parts.push('<rect x="' + m(px) + '" y="' + m(iy) + '" width="' + m(pw) + '" height="' + m(infoH) + '" rx="' + m(2.6) + '" fill="' + C.primary + '"/>');
    parts.push('<text x="' + m(px + pw / 2) + '" y="' + m(iy + 5.5) + '" text-anchor="middle" font-family="' + FN + '" font-size="' + m(2.4) + '" fill="#fff" letter-spacing="' + m(1) + '">本单总价</text>');
    parts.push('<text x="' + m(px + pw / 2) + '" y="' + m(iy + 14) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(8.5) + '" font-weight="700" fill="#fff">' + esc2(totalStr) + '<tspan font-size="' + m(2.8) + '" font-weight="400" dx="' + m(0.8) + '">元/桌</tspan></text>');

    if (isPhoto) {
      // —— 带图版：单一 3 列网格（v2.2 灵活排版，一行3个），按菜单顺序排，无分类段标题 ——
      // 缩略图用 cover（xMidYMid slice）裁切：缩略框严格 4:3，与 _thumb(4:3) 一致 → 100% 不变形，且与菜品库裁切位置一致。
      // 最后一行不足 3 个时整行居中，视觉更匀称。
      var gapCol = 4;
      var cw = (contentW - (cols - 1) * gapCol) / cols;
      var gy = secTop; // 顶部对齐：去掉居中留下的顶部大空，让网格贴紧信息条
      var N = draft.lines.length;
      draft.lines.forEach(function (l, i) {
        var col = i % cols, row = Math.floor(i / cols);
        var rowStart = row * cols;
        var rowEnd = Math.min(rowStart + cols, N);
        var cnt = rowEnd - rowStart;
        var offset = (cols - cnt) * (cw + gapCol) / 2; // 末行居中
        var cx = SX + offset + col * (cw + gapCol);
        var cy = gy + row * (cardH + gapRowS);
        parts.push('<rect x="' + m(cx) + '" y="' + m(cy) + '" width="' + m(cw) + '" height="' + m(cardH) + '" rx="' + m(3) + '" fill="' + C.surface + '" stroke="' + C.goldHair + '" stroke-width="' + m(0.4) + '"/>');
        var tx = cx + 1.2, ty = cy + 1.2;
        var clipId = 'clip_p' + i;
        parts.push('<clipPath id="' + clipId + '"><rect x="' + m(tx) + '" y="' + m(ty) + '" width="' + m(thumbW) + '" height="' + m(thumbH) + '" rx="' + m(2) + '"/></clipPath>');
        parts.push('<rect x="' + m(tx) + '" y="' + m(ty) + '" width="' + m(thumbW) + '" height="' + m(thumbH) + '" rx="' + m(2) + '" fill="#EDE4D3"/>');
        var src = l._thumb || l.image;
        if (src) {
          // cover 裁切：缩略框严格 4:3，与 _thumb(4:3) 一致 → 不变形、且与菜品库裁切位置一致
          parts.push('<g clip-path="url(#' + clipId + ')"><image href="' + src + '" xlink:href="' + src + '" x="' + m(tx) + '" y="' + m(ty) + '" width="' + m(thumbW) + '" height="' + m(thumbH) + '" preserveAspectRatio="xMidYMid slice"/></g>');
        }
        var maxChars = Math.max(4, Math.floor((cw - 4) / 3));
        var cn = l.cn || '未命名菜品';
        if (cn.length > maxChars) cn = cn.slice(0, maxChars - 1) + '…';
        var metaY = cy + 1.2 + thumbH + metaH * 0.5;
        parts.push('<text x="' + m(cx + cw / 2) + '" y="' + m(metaY) + '" text-anchor="middle" font-family="' + FS + '" font-size="' + m(3.3 * fScale) + '" font-weight="700" fill="' + C.ink + '">' + esc2(cn) + '</text>');
        if (l.note) {
          var nt = l.note; if (nt.length > maxChars) nt = nt.slice(0, maxChars - 1) + '…';
          parts.push('<text x="' + m(cx + cw / 2) + '" y="' + m(metaY + 4 * fScale) + '" text-anchor="middle" font-family="' + FN + '" font-size="' + m(2.6 * fScale) + '" fill="' + C.primary + '">' + esc2(nt) + '</text>');
        }
      });
    } else {
      // —— 无图版：分品类段编号清单 ——
      var segs = CATS.map(function (cat) {
        return { cat: cat, rows: draft.lines.filter(function (l) { return l.cat === cat; }) };
      }).filter(function (s) { return s.rows.length; });
      var y = secTop;
      var rowH = 8 * fScale;
      var catHeadH = 9 * fScale;
      var CN = { '凉菜': '壹', '主菜': '贰', '主食点心': '叁' };
      segs.forEach(function (s) {
        parts.push('<rect x="' + m(SX) + '" y="' + m(y + 3 * fScale) + '" width="' + m(3) + '" height="' + m(3) + '" fill="' + C.primary + '" transform="rotate(45 ' + m(SX + 1.5) + ' ' + m(y + 4.5 * fScale) + ')"/>');
        parts.push('<text x="' + m(SX + 7) + '" y="' + m(y + 6.5 * fScale) + '" font-family="' + FK + '" font-size="' + m(6 * fScale) + '" font-weight="700" fill="' + C.primary + '" letter-spacing="' + m(1) + '">' + (CN[s.cat] || '') + ' · ' + esc2(s.cat) + '</text>');
        parts.push('<text x="' + m(SX + 38) + '" y="' + m(y + 6.5 * fScale) + '" font-family="' + FN + '" font-size="' + m(2.8 * fScale) + '" fill="' + C.muted + '">共 ' + s.rows.length + ' 道</text>');
        parts.push('<rect x="' + m(SX + 55) + '" y="' + m(y + 5.5 * fScale) + '" width="' + m(contentW - 55) + '" height="' + m(0.5) + '" fill="' + C.gold + '"/>');
        y += catHeadH + 2 * fScale;
        s.rows.forEach(function (l, i) {
          var cy = y + i * rowH;
          parts.push('<text x="' + m(SX) + '" y="' + m(cy + rowH * 0.6) + '" font-family="' + FS + '" font-size="' + m(3.6 * fScale) + '" fill="' + C.goldDeep + '">' + ('0' + (i + 1)).slice(-2) + '</text>');
          parts.push('<text x="' + m(SX + 10) + '" y="' + m(cy + rowH * 0.6) + '" font-family="' + FS + '" font-size="' + m(4.6 * fScale) + '" font-weight="700" fill="' + C.ink + '">' + esc2(l.cn || '未命名菜品') + '</text>');
          if (l.note) {
            parts.push('<text x="' + m(contentR) + '" y="' + m(cy + rowH * 0.6) + '" text-anchor="end" font-family="' + FN + '" font-size="' + m(3 * fScale) + '" fill="' + C.primary + '">（' + esc2(l.note) + '）</text>');
          }
          if (i < s.rows.length - 1) parts.push('<line x1="' + m(SX) + '" y1="' + m(cy + rowH - 2 * fScale) + '" x2="' + m(contentR) + '" y2="' + m(cy + rowH - 2 * fScale) + '" stroke="' + C.line + '" stroke-width="' + m(0.35) + '"/>');
        });
        y += s.rows.length * rowH + 4 * fScale;
      });
    }

    // —— 页脚：中间免责语 + 金菱 + 两侧金线（无左右文字）——
    var fy = footerY;
    parts.push('<line x1="' + m(SX) + '" y1="' + m(fy) + '" x2="' + m(70) + '" y2="' + m(fy) + '" stroke="' + C.gold + '" stroke-width="' + m(0.5) + '"/>');
    parts.push('<line x1="' + m(140) + '" y1="' + m(fy) + '" x2="' + m(contentR) + '" y2="' + m(fy) + '" stroke="' + C.gold + '" stroke-width="' + m(0.5) + '"/>');
    parts.push('<rect x="' + (PAGE_W / 2 - m(1.2)) + '" y="' + m(fy - 2.4) + '" width="' + m(2.4) + '" height="' + m(2.4) + '" fill="' + C.gold + '" transform="rotate(45 ' + (PAGE_W / 2) + ' ' + m(fy - 1.2) + ')"/>');
    parts.push('<text x="' + (PAGE_W / 2) + '" y="' + m(fy + 4) + '" text-anchor="middle" font-family="' + FN + '" font-size="' + m(2.9) + '" fill="' + C.muted + '" letter-spacing="' + m(0.6) + '">本单仅作报价参考，菜品请以实物为主</text>');

    parts.push('</svg>');
    return parts.join('');
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
      // 预览：按高度等比缩放，保证整页 A4 完整可见（不裁切、不压扁）
      var svgs = container.querySelector('svg');
      if (svgs) {
        svgs.style.height = '260px';
        svgs.style.width = 'auto';
        svgs.style.maxWidth = '100%';
        svgs.style.display = 'block';
        svgs.style.margin = '0 auto';
      }
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
