# 山水 S 酒店宴席菜单系统

面向酒店销售人员的平板端宴席菜单工具，用于现场展示、菜单维护、定制报价和离线 PNG/PDF 导出。目标为 Android APK 本地优先；现有纯前端 PWA 保留为迁移前基线。客户可在销售控制的受限状态浏览，不是系统用户，也不通过链接在线浏览。四份正式文档已按 2026-09-06 用户反馈统一，当前仅进入阶段 1 技术验证。

## 项目结构

```text
.
├─ AGENTS.md
├─ README.md
├─ docs/
│  ├─ PRODUCT.md
│  ├─ ARCHITECTURE.md
│  ├─ UI.md
│  └─ DECISIONS.md
└─ src/
   ├─ index.html
   ├─ assets/
   ├─ data/
   ├─ tools/
   ├─ worker/
   └─ ...
```

## 本地运行

进入 `src/` 后，用任意静态文件服务器打开项目。例如：

```powershell
cd src
npx serve .
```

## 开发命令

```powershell
cd src
npm install
npm test
npm run build
```

产品、架构、界面和关键决策分别见 `docs/` 下四份文档。

阶段 1 Android 内测包由 `.github/workflows/stage1-apk.yml` 云端构建，源码在 `src/stage1`；不要求本机安装 Android SDK。成功运行的 Artifacts 提供 APK、SHA-256 和测试清单。安装与真实平板门禁见 `docs/DECISIONS.md`「阶段 1 云端构建与真机门禁」。内测包独立应用 ID、合成数据与临时测试签名，不接生产，不上架。
