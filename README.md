# 山水 S 酒店宴席菜单系统

面向酒店销售人员的平板端宴席菜单工具，用于现场展示、菜单维护、定制报价和离线 PNG/PDF 导出。应用为纯前端 PWA，可离线使用；客人不直接操作系统，也不通过链接在线浏览菜单。

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
