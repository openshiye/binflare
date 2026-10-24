<p align="center">
  <img src="docs/logo.png" alt="Binflare logo" width="440">
</p>

# Binflare

**跑在 Cloudflare Workers + D1 上的零知识粘贴板，使用 PrivateBin v2 协议。**

粘贴在浏览器端完成加密后再上传。服务端只保存密文，以及过期、焚毁、评论和删除所必需的最小元数据。解密密钥只存在于 URL 的 `#fragment`，不会发送到服务端。

## 协议兼容

Binflare 实现 **PrivateBin 2.1.0 的 v2 线格式与 JSON API**：

- 现有 PrivateBin 客户端只需把 base URL 指向 Binflare，即可继续使用相同的粘贴格式、fragment 密钥、过期选项、评论和删除链接。
- 协议基线固定在 [`docs/PROTOCOL.md`](docs/PROTOCOL.md)；不支持 v1/ZeroBin。
- Binflare **不导入、不迁移**已有实例中的粘贴。改域名只对目标实例上已有的数据生效；旧粘贴留在原实例。

> **Binflare 是独立实现，与 PrivateBin 项目无隶属、无背书，也不是官方移植。** PrivateBin 版权归 Sébastien Sauvage 及贡献者，使用 Zlib/libpng 许可证。见 [NOTICE](NOTICE)。

## v0.1 能力

- 创建、读取、过期、阅后即焚、删除令牌。
- 可选口令保护（纯客户端；无法找回）。
- 纯文本、Markdown、语法高亮，带预览。
- 评论 / 开放讨论，含回复和可选昵称。
- 兼容 PrivateBin 的粘贴与评论，包括附件 payload（v0.1 只读：列出文件并提供下载，不做内联预览）。
- 保留并展示版本链 `children` 链接。
- 预渲染 SPA 壳；粘贴内容只在浏览器拉取和解密，服务端不做粘贴内容的 React SSR。
- D1 存储、首次读取原子焚毁、读时过期判定、Cron 清理。
- 可选 Turnstile，以及按 IP 的写入限流。

附件作者能力、内联预览、二维码/邮件/克隆、中文 UI 和主题打磨属于 v0.1.x，见 [ROADMAP](docs/ROADMAP.md)。

## 工作方式

```
浏览器（静态 SPA 壳）
  ├─ /?<id>#<key>       创建 / 查看 / 焚毁确认
  ├─ /api/*             REST 别名
  └─ fetch
       └─ Cloudflare Worker
            ├─ /         PrivateBin 兼容 JSON API
            ├─ /api/*    REST API
            ├─ D1        pastes、comments、rate_limits
            └─ Cron      过期清理
```

- SPA 壳在构建时预渲染；React 不在服务端渲染粘贴页面。
- 根路径同时提供 PrivateBin 兼容 API（`status: 0/1`、`?pasteid=`、`?id#key`、删除链接）和 SPA 壳；`/api/*` 用普通 HTTP 状态码提供同一组操作。
- 存储使用 Cloudflare D1。阅后即焚在一个 D1 batch 事务内完成：读取并删除粘贴及其评论；并发首读只有一个读者能拿到 payload。

## 安全模型

- 加密只在客户端进行：新粘贴使用 AES-GCM；密钥由 256 位随机 fragment key 加可选口令派生。服务端永远收不到密钥或口令。
- 服务端保存密文和策略所需的元数据：过期、格式、讨论/焚毁标记、评论时间、密文大小。AAD 覆盖格式/讨论/焚毁标记；过期由服务端强制执行。
- 粘贴 ID 是协议规定的密文 FNV-1a64 校验和。删除令牌是 HMAC-SHA256(paste ID, 每个 paste 的 salt)；salt 永不下发。
- 评论沿用粘贴密钥；评论正文和昵称都加密。
- HTML 壳使用严格脚本 CSP（脚本不使用 `unsafe-inline`）、`Referrer-Policy: no-referrer`、`X-Frame-Options: DENY`、`noindex`；API 响应 `no-store`。
- 无账户、无 Cookie、无分析、无第三方字体或脚本（可选 Turnstile 除外）。

### 限制

- **粘贴大小**：D1 单行/单值上限 2,000,000 字节；Binflare 将密文限制在 1.875 MB（base64 请求最多 2.5 MB）。附件在密文内，共享该上限；更大附件需要 R2（计划中）。
- **D1 单主库**（未开启读复制）：主库写后读一致；远端客户端承担一个往返延迟。
- **无原生 TTL**：过期粘贴读取时返回通用「不存在」；物理删除由读时清理和 Cron 完成。
- **焚毁依赖诚实服务端**：首次读取即删，但恶意运营者可以保留副本；任何服务端粘贴板都同理。
- **运营者可以替换 JavaScript**：任何浏览器端零知识工具都无法完全防住被篡改的部署；CSP 和审查只能降低风险。
- **`ctr`/`cbc` 仅只读兼容**：无认证，界面会标注警告；Binflare 新建始终用 AES-GCM。
- **焚毁 + 口令是破坏性的**：客户端会在读取焚毁链接前询问口令，但读取本身就会销毁文档；口令错误也会消耗掉它。
- **评论**：无分页、不能单条删除；随粘贴一起删除。
- **不迁移数据**：不导入已有 PrivateBin 粘贴；协议兼容，但数据不搬家。
- **v0.1 不做**：v1/ZeroBin、JSON-LD、短链代理、模板切换、admin CLI、多存储后端、39 种语言。
- **免费额度**：D1 免费版 5M 行读/天、100K 行写/天、单库 500 MB（账户 5 GB）；Workers 免费版 100K 请求/天、10 ms CPU；静态资源不按请求计费。公共演示应开启限流，可选 Turnstile。本地实测最大粘贴创建约 156 ms、读取约 77 ms（含本地 D1/网络）；Workers 运行时对 2.5 MB base64 的 FNV 约 27 ms CPU，满尺寸请求可能超过免费版 10 ms CPU。必要时降低 `MAX_PASTE_CT_BYTES`、使用付费计划或等待 R2 路径。

## 技术栈

- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router)（不使用 Query/Form/Table/Virtual/Store/DB）。
- React 19、Vite、TypeScript。
- Cloudflare Workers、D1、Cron Triggers、可选 Turnstile。
- 客户端加密：WebCrypto（PBKDF2-SHA256、AES-GCM/CTR/CBC），原生 `CompressionStream`/`DecompressionStream` 做 raw DEFLATE。
- Markdown：marked + DOMPurify；高亮：highlight.js。

`package.json` 精确锁版本；升级单独提交，并用兼容 harness 验证。

## 快速开始

前置：Node.js >= 22、pnpm、Cloudflare 账号、Wrangler 登录。

```bash
pnpm install
# 创建 D1，把 id 写进 wrangler.jsonc
pnpm exec wrangler d1 create binflare
pnpm db:migrate:local
pnpm dev
```

打开 `http://localhost:3000`。

`pnpm dev` 是 Vite 开发服务器。要验证构建后的真实 Worker（含 nonce/CSP 层和根兼容 API），运行：

```bash
pnpm preview:worker
```

生产部署：

```bash
pnpm db:migrate:remote
pnpm deploy
```

需要 Turnstile 时配置 `TURNSTILE_SITE_KEY`（var）和 `TURNSTILE_SECRET`（secret），否则留空。仓库公开后可使用一键 Deploy to Cloudflare 按钮。绑定、Cron 和配置见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## API

- PrivateBin 兼容 API：`GET /?pasteid=<id>`、`POST /`（v2 body）、`GET /?pasteid=<id>&deletetoken=<token>`、评论用 `POST /`。
- REST 别名：`POST /api/pastes`、`GET /api/pastes/:id`、`DELETE /api/pastes/:id`、`POST /api/pastes/:id/comments`。
- `GET /api/config`、`GET /api/health`。

完整契约和示例见 [docs/API.md](docs/API.md)。

## 文档

- [协议契约](docs/PROTOCOL.md)
- [上游对齐矩阵](docs/PARITY.md)
- [架构](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [安全](docs/SECURITY.md)
- [路线图](docs/ROADMAP.md)

## 上游致谢

Binflare 是 PrivateBin 协议的独立重实现。未复制上游源码、资产或捆绑第三方库（包括 GPLv2 的 rawinflate）。协议基线是 PrivateBin 2.1.0 release。PrivateBin 版权归 Sébastien Sauvage 及贡献者，使用 Zlib/libpng 许可证。

**Binflare 与 PrivateBin 项目无隶属、无背书，也不是官方发行版。**

## 许可证

Binflare 自身代码使用 MIT 许可证。见 [LICENSE](LICENSE) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
