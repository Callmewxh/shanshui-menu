# CODEMAP · 山水S酒店婚宴菜单系统

> 代码定位索引。**改动前先查这里**，直接跳到对应函数，避免全文件搜索。
> 行号是 2026-08-09 (`v7` / sw `ss-menu-v7`) 的快照，会随改动漂移 —— **以函数名和 `// ----------` 注释锚点为准**，行号只用来判断大致位置。

---

## 一、文件总览

| 文件 | 行数 | 职责 |
|---|---|---|
| `index.html` | 302 | 全部 DOM 结构：顶栏 / 点菜屏 / 管理屏 / 6 个弹窗 |
| `assets/app.js` | 1782 | 全部交互逻辑（点菜端 + 管理端 + 手势 + 事件绑定） |
| `assets/store.js` | 502 | 数据层：localStorage 读写、菜品库/菜单 CRUD、迁移、备份 |
| `assets/custom.js` | ~1270 | **定制单 + 导出引擎**：自选菜品草案、A4 SVG 排版、栅格化、PDF 生成、**二维码分享 / 整份菜单多页 PDF** |
| `assets/style.css` | ~740 | 全部样式，含手机端 3 处 `@media` 适配 |
| `assets/data.js` | 61 | 种子数据（仅新设备首次打开且云端拉取失败时用） |
| `assets/qrcode.js` | — | **内置二维码库**（qrcode-generator 1.4.4，MIT，无外部依赖/离线可用），全局函数 `qrcode(0,'M')` |
| `assets/webdav.js` | — | WebDAV 同步（设置里的备份通道） |
| `data/menu-config.json` | — | **已发布的真实菜单**（3.4 MB，含 base64 图），新设备首次打开自动拉取 |
| `sw.js` | 40 | PWA Service Worker，网络优先。**改版本号要同步改 `CACHE`** |
| `tools/publish-menu.js` | 178 | 发布脚本：扫描下载目录最新导出 → 校验 → 覆盖 `data/menu-config.json` |
| `tools/render-package-preview.js` | — | 用**真实菜单数据**渲出整份菜单每页 SVG + 对照 HTML（人眼验收视觉保真） |

---

## 二、数据模型（最容易踩坑的地方）

```
STATE = {
  library: [ { id:'L1', num:1, cn, en, cat, desc, image(base64), crop, cropAspect } ],
  menu: {
    wedding: { name:'婚宴', packages: [ {
        id:'A1', name, price, demo,
        dishes: ['L1','L7',...],              // 只存菜品库 id 引用
        nameOverrides: { L1: {cn,en} }        // 菜单内覆盖改名，兼容旧版字符串
    } ] },
    baby: {...}, engagement: null, ...        // null 表示空宴席，渲染处必须判空
  }
}
```

**三条铁律：**
1. 图片只存在 `library` 里一份，菜单只存 id → 一处改，处处同步。
2. `nameOverrides` 有两种形态：旧数据是字符串（仅中文名），新数据是 `{cn,en}` 对象。取值时**永远不要直接把对象塞进 input**（历史 bug：显示 `[object Object]`）。
3. `crop` = `{x,y,w,h}` 归一化矩形 + `cropAspect`（图片宽/高）。展示端**与管理端缩略图统一用 `cropBg()`** 输出 background-size/position（WYSIWYG 一致）；旧版 `objPos`/`objPosFixed` 已移除，勿再调用。

**持久化键：** `ss_menu_v1`（主数据）· `ss_menu_v1_backup`（每次保存自动备份）· `ss_pinhdr`（红条固定）· `ss_showdesc`（简介开关）

---

## 三、app.js 功能地图

### 点菜端（前台）

| 功能 | 函数 | 行 |
|---|---|---|
| 轻提示 / 撤销提示 | `toast` `showUndo` | 80 / 90 |
| 当前套餐菜品解析 | `resolvedDishes` | 111 |
| **菜品显示编号**（按菜单内顺序，非菜品库号） | `dishNo` | 116 |
| 简介开关读取 | `showDesc` | 123 |
| 宴席标签 / 套餐条 / 横幅 | `renderTopTabs` `renderPkg` `renderBanner` | 128 / 141 / 159 |
| **红色菜单条**（含图钉按钮） | `renderHero` `applyHeroPin` | 166 / 188 |
| 菜品卡片 | `thumbHTML` `cardHTML` `renderList` | 196 / 204 / 215 |
| 上滑隐藏顶栏（沉浸式） | `initImmersive` | 241 |
| **详情弹窗**（跨菜品循环浏览） | `openModal` `renderModal` `viewerGo` | 276 / 284 / 316 |
| 红条左右滑切套餐 | `switchPkg`（在 `bindStatic` 内） | 1311 |

### 管理端（后台）

| 功能 | 函数 | 行 |
|---|---|---|
| 模式切换（点菜 ⇄ 管理） | `setMode` | 329 |
| 管理端总渲染 | `renderManage` | 362 |
| 套餐条渲染 / 拖动排序 | `renderPkgRow` `onPkgPointerDown/Move/Up` | 384 / 420-454 |
| **套餐右键 + 长按菜单**（编辑/副本/删除） | `openPkgCtx` `onPkgContextMenu` | 483 / 497 |
| 创建套餐副本（含改名独立拷贝） | `duplicatePackage` | 503 |
| 菜品库列表 | `renderLibList` `libCardHTML` | 536 / 552 |
| 菜单板块（卡片 / 排序两种视图） | `renderMenuTab` `renderMgList` | 573 / 575 |
| **菜单内改名弹窗** + 其他命名下拉 | `openMenuDishEditor` `saveMenuDishName` `collectOtherNames` | 641 / 663 / 679 |
| **排序模式拖拽**（仅右侧把手可拖） | `onMgPointerDown/Move/Up` | 713-747 |
| 菜品库编辑 / 重名校验 | `openLibEditor` `checkCnDuplicate` `saveLibDish` | 766 / 811 / 819 |
| 批量导入图片建菜品 | `handleBatchFiles` | 861 |
| **套餐编辑**（编号可改，默认字母序） | `nextPkgId` `openPkgEditor` `savePkg` | 901 / 913 / 937 |
| 从菜品库选择（批量应用多套餐） | `openPicker` `renderPickGrid` `confirmPicker` | 970 / 1009 / 1045 |
| 导出配置 / 云端拉取 | `exportConfig` `pullFromCloud` | 1068 / 1080 |
| 设置折叠菜单（含防溢出定位） | `toggleSettings` | 1099 |
| 恢复默认二次确认 | `openResetConfirm` `confirmReset` | 1120 / 1124 |
| **图片裁剪器**（4:3 取景框，可平移缩放） | `openCrop` `setCropXY` `setCropZoom` `initCrop` `applyCrop` | 1136-1237 |
| 内联改名（点菜名直接编辑） | `inlineEditName` | 1247 |
| **全部事件绑定** | `bindStatic` | 1309 |
| 启动入口 | — | 1766 |

---

## 四、store.js API 地图

| 分类 | 函数 | 行 |
|---|---|---|
| 加载 / 迁移 / 清理脏字段 | `load` `stripLegacyFields` `needsMigration` `migrate` | 31 / 48 / 60 / 73 |
| 保存（**含自动备份**）+ 图片瘦身 | `save` `shrinkImages` | 129 / 146 |
| 菜品库 CRUD | `getLibDish` `addLibDish` `updateLibDish` `removeLibDish` `usageCount` | 163-197 |
| 套餐 CRUD | `getPackage` `addPackage` `updatePackage` **`renamePackage`** `removePackage` | 213-249 |
| 套餐排序 | `reorderPackages` `movePackage` | 256 / 271 |
| 套餐内菜品 | `addDishesToPackage` `removeDishRef` `reorderPackage` | 286 / 295 / 301 |
| **解析菜单**（合并覆盖名） | `resolvePackage` `applyOverride` | 313 / 335 |
| 覆盖改名 | `setDishNameOverride` `setDishEnOverride` `clearDishNameOverride` | 348 / 357 / 365 |
| 图片处理 | `uploadImage` `compressImage` | 375 / 393 |
| **备份 / 撤销恢复** | `getBackupMeta` `restoreBackup` `getUsages` `restoreLibDish` `restoreRefs` `restorePackage` | 414-461 |
| 重置 / 导入 | `reset` `importConfig` | 471 / 477 |

> `restorePackage(banquetId, pkg, idx)` —— 第三个参数是**原位置索引**，撤销删除时必须传，否则恢复到列表末尾。

---

## 四·五、custom.js 导出引擎地图

### 定制单（自选菜品 → 一页 A4）

| 功能 | 函数 |
|---|---|
| 进入定制单 / 渲染草案 | `enter` `render` |
| 从菜品库挑菜 | `openPick` `renderPick` `applyLibDish` |
| 图片裁切（与菜品库一致） | `cropBgStyle` `coverRect` `renderThumb` `preloadImages` |
| 菜名换行（卡片内不溢出） | `wrapCn` |
| **A4 单页排版** | `buildSVG(ver, k)` — `ver='thumb'` 带图 4 列画册 / `'plain'` 无图分类段；`k` 为字号档位 |
| SVG → canvas（高清 2×） | `rasterize` |
| canvas → 单页 PDF | `canvasToPdfBlob` `buildPdfWithJpeg` |
| 导出主流程 | `doExport` `openExport` `renderExpPreview` |

### 二维码分享 / 整份菜单（本次新增）

| 功能 | 函数 | 说明 |
|---|---|---|
| 生成二维码 canvas | `makeQRCanvas(text, size)` | 容错级 M，四周留 4 模块静区；无 canvas 环境 resolve(null) |
| 线上菜单深链 | `shareUrl(banquetId)` | `origin + pathname + ?banquet=xxx`（不用 hash，防扫码 App 截断） |
| 烧码进导出物 | `burnQR(canvas, banquetId)` | 右下角 ~15%，白底 + 金线框 + 「扫码看菜单」字样 |
| **多页 PDF** | `buildMultiPagePdf(pages)` | `pages=[{bytes,w,h}]`；1=Catalog、2=Pages，每页占 3 个对象（Page/Image/Contents） |
| **单套餐一页 SVG** | `buildPackageSVG(banquetId, pkgId, k)` | 抬头「宴席菜单」、信息条 = 宴席名/套餐名/套餐价、4 列画册（与 `buildSVG` 同参数） |
| **整份菜单导出** | `exportWholeMenu(banquetId, {withQr, scale})` | 每套餐一页 → 逐页栅格化 → 可选烧码 → 合成多页 PDF 下载 |
| 分享二维码弹窗 | `showQrModal(url)` | 填 `#qrImg`/`#qrLink` 并展开 `#qrModal` |

**两个必须记住的坑：**
1. `Store.resolvePackage()` **直接返回菜品数组**，不是 `{dishes:[...]}`。按对象取值会静默拿到空列表 → 导出页「有框无图」。
2. 二维码里放的是**网址**不是菜单数据。整份菜单含图 3.4 MB，二维码上限仅 ~3 KB，物理上放不进去；放网址还顺带让客户永远看到线上最新版。

### 深链参数（`app.js` `handleDeepLink`）

| 参数 | 作用 |
|---|---|
| `?banquet=wedding` | 打开即切到指定宴席（二维码默认指向） |
| `?pkg=A1` | 再定位到指定套餐 |
| `?export=pdf` | 打开后自动触发整份菜单 PDF 下载（扫码即下载，无需托管文件） |

---

## 五、index.html DOM id 速查

**顶栏**：`brandBtn` `brandMenu`（模式切换在这）· `banquetSelect` `bsTrigger` `bsMenu` · `search`

**点菜屏** `#orderScreen`：`pkgbar` `banner` `content` `hero` `list`

**管理屏** `#manageScreen`：
- 工具栏 `mgToolbar` → 子标签 `mgTabs` · 菜品库栏 `mgLibbar`（`libCat` `mgAddLibDish`）· 菜单栏 `mgCtxbar`（`mgBanquet` `mgPkgRow` `mgAddPkg` `mgAddFromLib`）
- 设置 `mgSetWrap` → `mgSettings` `mgSetMenu` → `setPull` `setImportJson` `setExport` **`setShareQr`（分享二维码）** **`setExportMenu`（导出整份菜单 PDF）** `setRestore` `setBatch` `setShowDesc`+`setShowDescCb` `setReset`
- 列表 `mgLibList`（菜品库）· `mgList`（菜单）· `mgDrop`（拖图遮罩）
- 右键菜单 `pkgCtxMenu`

**弹窗**：`modal`（详情）· `editModal`（菜品库编辑）· `pkgModal`（套餐编辑）· `cropModal`（裁剪）· `pickModal`（菜品选择器）· `resetConfirmModal` · `menuDishModal`（菜单内改名）

---

## 六、style.css 分区

| 行 | 区块 |
|---|---|
| 1-25 | CSS 变量（`--primary: #B23A2E` 喜庆红） |
| 26-94 | 顶栏 + 品牌下拉 |
| 95-190 | 套餐条 / 横幅 / 主体布局 / 红条 / 卡片网格 |
| 191-229 | 详情弹窗 |
| **230-286** | **@media 手机端适配**（网格稳定 3 列） |
| 287-425 | 管理模式：工具栏 / 设置菜单 / 排序列表 |
| 426-537 | 各类编辑弹窗 / 裁剪器 / 内联改名 |
| 539-628 | 提示 / 撤销 toast / 子标签 / 选择器 / 右键菜单 |
| **630-677** | **@media 管理端手机适配** |
| 679-711 | 沉浸式隐藏 / 拖放遮罩 |

---

## 七、常见改动落点速查

| 想改什么 | 去哪 |
|---|---|
| 点菜卡片长什么样 | `app.js` `cardHTML` (204) + `css` 168-190 |
| 详情弹窗内容 | `app.js` `renderModal` (284) + `index.html` `#modal` (115) |
| 菜品编号规则 | `app.js` `dishNo` (116) |
| 顶栏加/删按钮 | `index.html` 17-37 + `app.js` `bindStatic` (1309) |
| 设置里加一项 | `index.html` 83-92（照抄一行 `.set-row`）+ `app.js` `bindStatic` 里绑事件 |
| 管理端列表行 | `app.js` `renderMgList` (575) |
| 拖拽手感 / 阈值 | `app.js` 713-763（排序）· 420-473（套餐条） |
| 手机端布局问题 | `css` 230-286 或 630-677 两段 `@media` |
| 数据结构变更 | `store.js` `migrate` (73) 必须同步加迁移逻辑 |
| 新增持久化开关 | `app.js` 仿 `showDesc` (123) + `bindStatic` 里绑定 |

---

## 八、维护约定

- **改了功能位置 → 顺手更新本文件**，否则很快过期。
- 改 `sw.js` 的 `CACHE` 版本号能强制所有设备刷新缓存。
- 部署 = `workbuddy_cloudstudio_deploy` 推整个目录；GitHub push 只是备份，**两者互不影响**。
- 完整发布流程见 skill `shanshui-menu-publish`（同步菜单 → commit → push → 部署 → 验证）。
