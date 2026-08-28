# 架构

## 总览

项目是原生 HTML、CSS、JavaScript 构成的单页 PWA。无常驻应用后端；浏览器负责界面、业务逻辑、数据持久化和导出。Cloudflare Worker 仅作为可选的内部 WebDAV 跨域代理。

## 目录

```text
src/
├─ index.html              # 页面结构与静态入口
├─ assets/                 # 样式及业务脚本
├─ data/                   # 已发布菜单与菜品图片
├─ tools/                  # 测试、构建、发布和预览脚本
├─ worker/                 # WebDAV 代理及部署配置
├─ manifest.webmanifest    # PWA 清单
├─ sw.js                   # Service Worker
├─ icon.svg                # 应用图标
└─ package.json            # 开发命令与测试依赖
```

## 运行时模块

- `assets/store.js`：状态、本地存储、迁移、备份及菜单 CRUD。
- `assets/app.js`：展示端与管理端的主要交互。
- `assets/order-layout.js`：正式点菜页的左右布局、套餐切换动效和详情转场。
- `assets/custom.js`：定制单和 PNG/PDF 导出。
- `assets/data.js`：首次启动的种子数据。
- `assets/webdav.js`：内部 WebDAV 同步。
- `assets/immersive.js`：平板沉浸式展示交互。
- `assets/style.css`：界面样式和主题令牌。
- `assets/order-layout.css`：平板优先的左右分栏布局及响应式样式。

## 数据模型

- 菜品只在 `library` 中保存一次。
- 套餐的 `dishes` 仅保存菜品 ID，避免图片与主数据重复。
- 套餐可通过 `nameOverrides` 覆盖展示名称。
- 已发布配置位于 `data/menu-config.json`，图片位于 `data/img/`。
- 浏览器以 localStorage 保存工作数据与备份；远端配置是内部同步来源，不是客人访问入口。

## 数据流

1. 启动时读取本地数据；必要时读取种子或已发布配置。
2. 编辑操作先写本地状态并生成备份。
3. 发布工具把配置和图片写入 `data/`，构建脚本更新离线缓存。
4. 可选 WebDAV 流程通过代理在内部设备间 GET/PUT 配置。
5. 导出模块在浏览器内生成自包含 PNG/PDF，不依赖接收方联网。

## 验证

- `npm test`：运行自动化测试集合。
- `npm run build`：更新 Service Worker 缓存清单。
- 视觉或导出改动还应使用 `tools/` 中预览脚本人工核对。
