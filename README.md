# 寄情 (Dearm)

Web 多用户 AI 角色聊天平台。英文品牌 **Dearm**，域名 [dearm.ai](https://dearm.ai)。对标同类角色扮演聊天平台，差异化在 **creator 友好 + 内置 AI 辅助 + 调试模式 + 零内容审核**。

> 详细规划见 [docs/exec-plans/completed/v1-foundation.md](./docs/exec-plans/completed/v1-foundation.md)（v1 已完成）
> 视觉源头见 [DESIGN.md](./DESIGN.md)
> 协作纪律见 [CLAUDE.md](./CLAUDE.md)
> 模块技术交接见 [docs/handover/](./docs/handover/)
> 产品决策思考见 [docs/insights/](./docs/insights/)

> ⚠️ **上线前必读：[GO-LIVE.md](./GO-LIVE.md)** —— 真实支付（Stripe：卡 / 支付宝 / 微信）已接入主干，
> 「收真钱」前还有 Stripe 后台 / 生产环境配置清单（关 Adaptive Pricing、补商户资料、配生产 webhook 等）。

---

## v1 一览

| 表面 | 路径 | 摘要 |
|------|------|------|
| 探索 | `/explore` | 角色卡网格 + 搜索 + 标签筛选 + 最新/推荐排序 + NSFW toggle |
| 创建 | `/characters/new` | 16 字段表单（A 信息 / B 人设 / C 高级），含「文件导入」 |
| 角色详情 | `/characters/[id]` | 查看 / 编辑 / 导出 JSON / 正则规则 / 开始对话 |
| 正则规则 | `/characters/[id]/regex` | 通用模式 + 工具模式（6 步工作流），上/下排序，导出/导入 JSON |
| 聊天 | `/chat/[sessionId]` | 流式 SSE + sanitize/iframe 双轨渲染 + 调试模式（owner-only）+ 可见正则用户开关 |
| 我的 | `/mine` | 当前用户全部角色卡（含私密/不列出） |
| 设置 | `/settings` | 昵称（`{{user}}` 替换）/ 用户名 / 退出登录 |

### 核心差异化（vs 竞品）

1. **正则替换系统** —— sanitize 路径走 DOMPurify + react-markdown；iframe 路径走 sandbox + 内置 host API（`sendMessage` / `getHistory` / `getCharacter` / `setComponentState`），CSP `connect-src 'none'` 阻断数据外泄
2. **内置 AI 辅助生成** —— `replacement-html` / `global-css` / `output-guidance` / `target-text` 四个生成器，流式回填到 textarea，prompt 模板写死在后端（防 injection），20 次/小时/用户限速
3. **调试模式** —— 聊天页右上 toggle（仅卡 owner 可见），AI 气泡下显示原始输出 / 命中规则 / 未命中规则 / token / latency / 完整 system prompt
4. **零内容审核** —— `nsfw` 字段由 creator 自报，平台不做任何违禁词扫描 / AI 审核 / 强制下架

### 安全契约

- `nj_*` selector 一旦发布即 API —— 详见 [selector-contract.md](./docs/handover/selector-contract.md)
- CSS 白名单 walker（`src/lib/styling/whitelist.ts`）禁 `position: fixed`、`pointer-events`、`z-index > 100`、`@import`、`body`/`html`/`:root`/`*` selector，scope 前缀强制
- iframe sandbox = `allow-scripts` only；CSP `connect-src 'none'` 是绝对红线
- AI 生成的内容仍走同一条 sanitize / walker 链路 —— LLM 不被信任

---

## 技术栈

- **运行时 / 包管理**：Bun
- **框架**：Next.js 16（App Router，**dev 用 webpack**，见下文）+ React 19
- **语言**：TypeScript strict
- **数据库**：Postgres + Drizzle ORM
- **认证**：Auth.js v5（magic-link，nodemailer SMTP）
- **AI SDK**：Vercel AI SDK，支持 Anthropic / OpenAI / Google
- **UI**：Tailwind CSS v4 + Radix Primitives
- **Lint / Format**：Biome
- **Git hooks**：Lefthook

---

## 快速启动

### 1. 前置依赖

- [Bun](https://bun.sh) ≥ 1.3
- 一个本地 Postgres 数据库（推荐 [Postgres.app](https://postgresapp.com/)）
- SMTP 凭据（magic-link 邮件，开发期可用 [Mailtrap](https://mailtrap.io) / Resend / Gmail App Password）
- 至少一个 LLM provider key（Anthropic / OpenAI / Google 三选一即可跑通）

### 2. 安装

```bash
bun install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

打开 `.env.local` 填入：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 本地 Postgres 连接串，如 `postgres://<mac-user>@localhost:5432/nimir_dev` |
| `EMAIL_SERVER` | SMTP URL，如 `smtps://user:pass@smtp.host:465` |
| `EMAIL_FROM` | 发件地址 |
| `AUTH_SECRET` | `openssl rand -base64 32` 生成 |
| `NIMIR_ANTHROPIC_API_KEY` | Anthropic Claude key. Namespaced under `NIMIR_*` so shell-global `ANTHROPIC_*` from other tools don't leak in. See `.env.example` for the optional `NIMIR_ANTHROPIC_BASE_URL` relay override. |
| `NIMIR_DEEPSEEK_API_KEY` | DeepSeek V4 Pro default chat/generation model key. Uses an Anthropic-compatible NewAPI channel; `NIMIR_DEEPSEEK_BASE_URL` defaults to `http://107.167.18.218:3000/v1`. |
| `NIMIR_GOOGLE_API_KEY` | Gemini models. Routed through the OpenAI-compat NewAPI relay (not Google native REST — the relay does not accept `google.safetySettings` / `google.thinkingConfig`). `NIMIR_GOOGLE_BASE_URL` defaults to `http://107.167.18.218:3000/v1`. |
| `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | Read by `@ai-sdk/openai` if you point the model registry at them. Optional. |
| `R2_*` | Schema-reserved for image uploads (v1.5+). v1 accepts external image URLs verbatim — leave R2 blank. |

### 4. 初始化数据库

```bash
# 把 drizzle/*.sql 应用到本地 Postgres
bun run db:migrate

# 之后改 schema → 生成新 migration
bun run db:generate

# 可视化浏览表/记录
bun run db:studio
```

### 5. 启动 dev server

```bash
bun run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

> ⚠️ **必须用 `next dev --webpack`**（已写死在 `package.json`）。Next 16 Turbopack 的 `next/font/google` 内部模块在 Bun runtime 下解析会挂；`next build` 也同样走 `--webpack`。

---

## Docker 部署

两种姿势 —— 全栈容器化 dev 或者单机 prod。两者共用 `Dockerfile`（多 stage：deps / builder / migrate / runner）+ `docker-compose.yml`。

### dev：全栈容器化（含 hot reload）

```bash
cp .env.docker.example .env
# 至少填 AUTH_SECRET（openssl rand -base64 32）
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

- `app` 用 `Dockerfile.dev`，bind mount `src/` / `public/` / `drizzle/` 等到容器，`bun run dev` 热更新照常工作
- `postgres` 数据落在 named volume `nimir_pgdata`，`compose down` 不丢
- `migrate` 是一次性 service，每次 up 都会跑 `bun scripts/db-migrate.ts`，apply 完退出
- dev override 默认开 `NIMIR_AUTH_DEV_FALLBACK=1`，没登录也能直接进应用调路由

### prod：单 VPS

```bash
cp .env.docker.example .env
# 填 AUTH_SECRET、各 LLM key、R2 凭证；NIMIR_AUTH_DEV_FALLBACK 保持注释
mkdir -p logs
docker compose up -d --build
```

- 最终镜像基于 Next standalone output（`next.config.ts` 已开），~200MB
- 反向代理 / TLS 不在 compose 里 —— 用宿主 caddy / nginx 终止 TLS 转给容器 3000 端口
- 服务端日志会同时输出到 Docker stdout 和宿主机 `./logs/YYYY-MM-DD.log`；容器启动时会自动修正 `/app/logs` 写入权限

---

## 常用脚本

| 命令 | 作用 |
|------|------|
| `bun run dev` | 启 dev server（webpack） |
| `bun run build` | 生产构建 |
| `bun run start` | 跑生产构建产物 |
| `bun run typecheck` | `tsc --noEmit -p tsconfig.typecheck.json` 全量类型检查 |
| `bun run lint` | Biome check（不写入） |
| `bun run lint:fix` | Biome check + 自动修复 |
| `bun run format` | Biome format |
| `bun test` | 跑 Bun test |
| `bun run db:generate` | 从 schema 生成迁移 SQL |
| `bun run db:migrate` | 应用迁移到 `DATABASE_URL` |
| `bun run db:studio` | Drizzle Studio 可视化 |

---

## 调试

### 应用层

- **服务端日志** → 看 `bun run dev` 终端输出，RSC / Server Action / Route Handler 的 `console.log` 都在这里；同时会按天写入 `logs/YYYY-MM-DD.log`
- **Docker 日志落盘** → production compose 已把宿主机 `./logs` 映射到容器 `/app/logs`，可直接 `tail -f logs/$(date +%F).log`
- **客户端日志** → Chrome DevTools Console，Next 16 默认开 React DevTools 集成
- **网络请求** → DevTools Network 看 `/api/*` 路由，AI 流式接口走 SSE，注意切到「EventStream」面板查看 chunk

### 数据库

- `bun run db:studio` 起本地 Drizzle Studio，浏览/编辑表
- 直接 psql Neon：`psql "$DATABASE_URL"`
- schema 变更必须走 `db:generate` → 提交生成的 SQL，禁止手改库结构

### 应用内调试模式（v1 核心特色）

聊天页右上角的 **Debug Toggle**（仅角色卡 owner 可见）会展开每条 AI 气泡下的折叠面板，包含：

- 原始模型输出（未经正则处理）
- 命中 / 未命中的正则规则
- token 用量、latency
- 完整 system prompt

数据存在 `messages.debug_info` jsonb 字段。详见 [v1-foundation.md 模块 8](./docs/exec-plans/completed/v1-foundation.md)。

### 类型 / Lint 失败

- TS 错 → `bun run typecheck` 看完整诊断
- Biome 报错 → `bun run lint:fix` 先自动修
- 提交前 lefthook 会拦截，CI 也跑同样的 check

### 踩过的坑（避免重蹈）

- **Next server 上下文 ≠ Bun runtime**：server action / route handler 跑在 Next 用 webpack 打包出的 Node worker 里，`Bun.password` / `Bun.serve` / `Bun.file` 这类 Bun-only 全局**不可用**，即使你 `bun run dev` 启动。需要密码 hash / 文件 IO 时用纯 npm 包（bcryptjs / node:fs）。判断标准：能在 `node script.js` 跑通的代码才能进 server bundle。
- **改 Auth.js provider 配置必须重启 dev**：providers 在 NextAuth 实例化时锁定，HMR 不会重建。改 Credentials / OAuth 配置后 Ctrl-C + 重起。
- **Migration 只动 schema，不动数据行**：`drizzle/*.sql` 里禁 `DELETE FROM users / characters / packs`。FK 默认 `ON DELETE CASCADE`，删任何一个 owner 会顺手吃掉它名下所有创作。要清行写独立的 `scripts/cleanup-*.ts`。
- **`next build` 也要 `--webpack`**：Next 16 Turbopack 在 Bun runtime 下解析 `next/font/google` 内部模块会挂，dev / build 都已锁定到 webpack（见 `package.json`）。

---

## 项目结构

```
src/
  app/                Next.js App Router（RSC + Server Actions + Route Handlers）
    (auth)/           账号密码登录 / 注册
    api/              REST/SSE 路由
  components/         UI 组件（Radix + Tailwind）
  lib/                业务逻辑（db / ai / auth / regex）
  i18n/               zh.ts / en.ts（v1 中文优先，英文 placeholder）
  types/              共享 TS 类型

drizzle/              Schema 迁移 SQL（生成产物，不要手改）
docs/
  exec-plans/         活跃 / 完成的执行计划
  handover/           技术交接文档
  insights/           产品/设计思考
  research/           调研笔记
ui-mock/              纯静态视觉稿（参考用，不进打包）
```

---

## 开发约定

**改动前先读：**

1. [CLAUDE.md](./CLAUDE.md) — 协作纪律、文档要求、commit 规范
2. [DESIGN.md](./DESIGN.md) — 视觉/UI 决策的唯一源头（颜色 / 字体 / 间距 token）
3. [docs/exec-plans/completed/v1-foundation.md](./docs/exec-plans/completed/v1-foundation.md) — 8 模块完整 spec + 数据模型 + 10 周里程碑（v1 已完成）

**几条铁律：**

- 任何视觉/UI 改动必须符合 DESIGN.md token，**不写死 hex / px**，用 CSS custom property
- 聊天页 UI 必须挂 `nj_*` 前缀的 ID/class（一旦发布即 selector API，破坏性改动需走 deprecation）
- 数据库改动只走 drizzle migration，禁破坏性迁移
- 新功能写双份文档：`docs/handover/<feature>.md`（技术）+ `docs/insights/<feature>.md`（产品）
- **零内容审核** —— 这是核心产品立场，任何要求加内容检测的请求必须谨慎对待
