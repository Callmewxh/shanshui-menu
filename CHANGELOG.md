# CHANGELOG · 山水S酒店婚宴菜单 PWA

> 重建自 2026-08 代码审查，记录能力演进关键节点，便于跨设备 / 跨会话对齐版本。
> 版本号即 `sw.js` 的 `CACHE = 'ss-menu-v[N]'`；**每次部署必须 +1**，否则已安装 PWA 不会拉取新代码。

## 当前状态（v20，本次发布升 v20；工作树此前 v19、上次提交部署 v16）
- **数据规模**：56 道菜品 / 42 张图 / 5 宴席类型（wedding·baby·engagement·yearEnd·housewarming）/ 20 套餐。
- **PWA**：`manifest.webmanifest` + `sw.js`（v20，网络优先 + 离线回退，fetch 带 `no-cache`）。注册 `updateViaCache:'none'`。
- **皮肤**：仅默认新中式红（shanshui）；原 apple/glass/wabi/zhifou 四套可选皮肤及设置内切换器已于 2026-08-20 移除。
- **云端同步**：WebDAV 代理（Cloudflare Worker，`worker/`），只读发布模型——管理端写、设备只读。
- **导出引擎**：`custom.js` 定制单 / 整份菜单，PNG + SVG，缩略图 + 无图两种版式，二维码分享。

## 能力演进关键节点
- **裁剪模型（方案 B）**：完整图上拖 4:3 取景框 + 缩放，`crop={x,y,w,h}` 归一化矩形；`background-size/position` 精确还原，编辑框与展示端所见即所得。`app.js:cropBg` 与 `custom.js` 导出共用同一裁切数学，保证展示 / 导出一致。
- **导出保真（H1 收口，2026-08）**：`app.js` 的 `cropBg` 暴露为 `window.cropBgStyle` 单一真相源，`custom.js` 优先复用、独立运行保留兜底，彻底消除"展示与导出裁切漂移"风险。
- **裁剪底色令牌化（M2 收口，2026-08）**：原硬编码 `#EDE4D3` 改为展示端 `var(--img-bg)`、导出端 `resolveImgBg()` 取当前皮肤具体值，避免非默认皮肤错位。
- **WebDAV 同步**：浏览器无法直连坚果云 / InfiniCLOUD（缺 CORS 头），引入 Cloudflare Worker 作同源代理，密码只在 Worker 服务端。
- **沉浸式封面（v3）**：`immersive.js` 驱动的"上滑进入菜单 + 宴席选择"封面层（`index.html` cover 区），当前由 `PAD_ENABLED` 控制、主要服务平板。
- **PWA 缓存策略**：`sw.js` 缓存键自增约定（v7→…→v20），配合 `no-cache` fetch 规避"代码改了设备没反应"。

## 运维须知
- **部署前**：`sw.js` 的 `CACHE` 版本号 +1（v19→v20，已于本次收口执行）；`index.html` 注册选项保持 `updateViaCache:'none'`。
- **数据膨胀**：`data/menu-config.json` 含 base64 内嵌图（约 4.19MB），已执行 `git lfs track data/menu-config.json`（不改写历史、前向生效）；部署前仍含 `publish-menu.js` 的"内容一致则跳过"闸门。
- **发布链路**：`tools/publish-menu.js` 同步导出配置 → 校验 → `git push` → CloudStudio 覆盖部署 → 平板"添加到主屏幕"→ 离线（飞行模式）验证。

## 待办 / 已知
- 加载界面（splash）当前缺失，启动拉取 4.19MB JSON 期间为裸屏；发布版建议补纯内联加载层。
- 进入系统封面（`PAD_ENABLED`）默认关闭、仅平板；发布前需决定是否点亮并放宽设备判定。
- `tools/` 下 `edge-*` 调试探针与预览 `*.png` 已加入 `.gitignore`，建议归档至 `tools/_archive/`（需文件移动权限）。
