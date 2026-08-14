# WebDAV 代理部署说明（Cloudflare Worker）

菜单 App 是浏览器 PWA，无法直连坚果云 / InfiniCLOUD 的 WebDAV（它们不返回 CORS 头，
跨域请求会被浏览器拦截）。本 Worker 作为「同源/可控代理」：

- PWA 调 `https://你的worker.workers.dev/dav/menu-config.json`
- Worker 服务端持 WebDAV 账号密码，转发到坚果云 / InfiniCLOUD
- Worker 主动补 `Access-Control-Allow-Origin` + 处理 `OPTIONS` 预检 → 绕开 CORS
- WebDAV 密码只在 Worker 服务端，浏览器只持一个 `DAV_TOKEN`（可选校验）

## 模型

- **拉取（各设备）**：`GET /dav/menu-config.json` → 返回菜单 JSON
- **发布（管理端）**：`PUT /dav/menu-config.json` → 写入菜单 JSON（替代原「上传 GitHub」）

只读发布模型下只有管理端写，设备只读，无并发覆盖风险。

## 部署步骤

1. 登录 https://dash.cloudflare.com → Workers & Pages → 创建 Worker（随便起名，如 `shanshui-dav`）。
2. 把 `webdav-proxy.js` 的内容粘到编辑器的 `worker.js` 处，保存并部署。
3. 进入该 Worker → Settings → Variables，添加以下变量（建议点「Encrypt」设为加密）：
   - `WEBDAV_BASE` = `https://dav.jianguoyun.com/dav`（坚果云）或 `https://dav.infini-cloud.net/你的用户名`（InfiniCLOUD）
   - `WEBDAV_USER` = WebDAV 登录名
   - `WEBDAV_PASS` = WebDAV 密码 / Apps Password
   - `DAV_TOKEN`（可选但推荐）= 任意随机串，例如 `openssl rand -hex 16` 生成
   - `ALLOW_ORIGIN`（可选）= 你的 PWA 源，如 `https://xxx.cloudstudio.app`，默认 `*`
4. 记下你的 Worker 地址，形如 `https://shanshui-dav.你的子域.workers.dev`。

## PWA 端配置

1. 打开菜单 App → 管理 → ⚙ 设置 → 拉到「WebDAV 云端同步」区块。
2. **代理地址** 填：`https://shanshui-dav.你的子域.workers.dev/dav`
3. **访问令牌** 填：与上面 `DAV_TOKEN` 一致（若 Worker 未设 `DAV_TOKEN` 则留空）。
4. 管理端编辑完菜单后，点「**发布到 WebDAV**」即推送；各设备点「从云端拉取菜单」即更新。

## 安全提示

- Worker 等于你家 WebDAV 的公开写入代理，**务必设 `DAV_TOKEN`**，并把 `ALLOW_ORIGIN` 限定为 PWA 域名。
- 3.4MB 菜单文件偶尔推送/拉取一次，免费 Worker 额度足够。
- 若担心代理被滥用，可进一步在 Worker 里加 IP 白名单或限流。

## 排错

- 拉取/发布报 `401`：检查 `DAV_TOKEN` 是否与 PWA 端一致；或 Worker 是否设了 `DAV_TOKEN` 而 PWA 未填。
- 报 `CORS` / `Failed to fetch`：确认 Worker 已部署且地址填的是 `.../dav`（带 `/dav` 后缀）。
- 报 `WebDAV GET 401/403`：检查 `WEBDAV_USER` / `WEBDAV_PASS` 是否正确（坚果云用账号邮箱，InfiniCLOUD 用 Connection ID + Apps Password）。
