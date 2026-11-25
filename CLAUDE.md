# CLAUDE.md — 寄情 (Dearm)

寄情 (Dearm) —— Web 多用户 AI 角色聊天平台。英文品牌 Dearm，域名 dearm.ai。对标同类角色扮演聊天平台，差异化在 creator 友好 + 内置 AI 辅助 + 调试模式 + 零内容审核。

> 详细规划见 [docs/exec-plans/completed/v1-foundation.md](./docs/exec-plans/completed/v1-foundation.md)（v1 8 大模块 / 10 周里程碑 / 完整 schema，已完成）。
> 视觉设计源头见 [DESIGN.md](./DESIGN.md)。

---

## Design System

**永远先读 DESIGN.md 再做任何视觉或 UI 决策。**

- 所有字体选择、颜色、间距、装饰元素、动画——都定义在 DESIGN.md
- **不要**未经讨论自行偏离设计系统
- QA 模式下，任何代码不符合 DESIGN.md 的视觉契约 → 必须 flag
- `nj_*` selector 命名一旦发布即 API，破坏性改动需走 deprecation 流程

**关键设计签名（每个核心页面必有）：**
1. 大号衬线中文标题（页头 hero，3xl 或 4xl Noto Serif SC）
2. 暗紫黑底色（`#0e0a1a` 永远不用纯黑）
3. 极淡 scanline 水平纹理（~10% opacity）
4. AI 生成 / 加载用「呼吸点」动效（不用通用 spinner）

---

## 开发规则

**TypeScript + Bun 优先：**
- 所有代码用 TypeScript strict 模式,避免 `any`
- 用 Bun 跑测试和包管理(`bun test` / `bun add` / `bun run`)
- Next.js 16 App Router + React 19,所有 server-side 用 RSC + Server Actions

**Next 16 警告(对所有 agents):**
这版 Next.js 是 16,**有 breaking changes** —— API、约定、文件结构都可能跟你训练数据里的 Next.js 不一样。写代码前先看 `node_modules/next/dist/docs/` 里相关 guide,留意 deprecation notice。

**dev server 用 webpack 不用 Turbopack:** `next dev --webpack`。Next 16 Turbopack 的 `next/font/google` 内部模块在 Bun runtime 下解析挂 —— 已锁定到 package.json scripts。`next build` 不受影响。

**严格遵守 DESIGN.md 的 token：**
- 颜色: 永远用 CSS custom property（`var(--accent-primary)`），不写死 hex
- 字体: 大标题用 `font-family: var(--font-display-zh)`，body 用 `var(--font-body-zh)`
- 间距: 用 `var(--space-md)` 等 token，不写死 `16px`

**实现原则：**
- 优先复用成熟库和现成能力，避免重复造轮子
- 只有当现成方案明显不适配本仓库约束时，才自己实现
- 引入新库前先确认它是否已经解决了核心交互/正确性问题

**改动自查清单（每次 commit 前确认）：**
1. 改动是否涉及 i18n —— 是否需要同步 `src/i18n/zh.ts` 和 `en.ts`（v1 中文优先，英文留 placeholder）
2. 改动是否涉及数据库 —— 是否需要新增 drizzle migration（约定禁止破坏性迁移）；**新建表必须在同一迁移里带上 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`**（见下方「## RLS 约定」）
3. 改动是否涉及类型 —— 是否需要更新 `src/types/index.ts`
4. 改动是否涉及视觉 —— 是否符合 DESIGN.md
5. 改动是否构成新功能或大迭代 —— 是否需要写双份文档（handover + insights）

`lefthook.yml` 在 pre-commit 上跑 typecheck + biome check（仅 staged 文件）+ bun test。任何一条挂了 commit 会被拦截。冷 checkout 后用 `bunx lefthook install` 安装钩子。

**Commit 规范：**
- Conventional commits（feat / fix / refactor / chore / docs）
- body 说明 **why** 而非 what
- 关键架构决策的 commit 必须在 body 里说明 trade-off

**双份文档（新功能必写）：**
- 技术交接 → `docs/handover/<feature>.md`
- 产品思考 → `docs/insights/<feature>.md`
- 两份互相反向链接

**执行计划：**
- 活跃计划 → `docs/exec-plans/active/`
- 完成后移至 `docs/exec-plans/completed/`
- 纯调研 → `docs/research/`

---

## 内容立场

**完全不做检测：** 无违禁词扫描、无 AI 审核、无强制下架、无敏感标签强制。

- `characters.nsfw` 字段由 creator 自报，仅作用户筛选元数据
- 探索页顶栏「显示 NSFW」toggle 默认 ON（平台定位本来就服务这部分受众）
- NSFW 卡片在网格里显示 R18 amber 角标
- 任何提及"加内容审核"的请求 → 必须警觉，这是核心产品立场

---

## RLS 约定（Supabase）

**所有 public 表必须开启 RLS。** Supabase 把 public schema 暴露给 PostgREST，没开 RLS 的表等于对着公开的 anon key 裸奔（任何人可从浏览器直连读写）。

安全模型：
- 后端 100% 走 Drizzle + `DATABASE_URL` 超级用户直连，**超级用户天然绕过 RLS**，服务端读写不受影响。
- Supabase JS 仅用于 Auth API（登录/注册/登出/改密），**从不碰 PostgREST 数据表**；浏览器端无 `.from()` / `.rpc()` / realtime。
- 因此 PostgREST 数据通路本仓库根本不用 → 统一「开 RLS + 零 policy = 全拒绝」即可，无需为业务表写策略。

铁律：
- **每新建一张表，必须在同一迁移里 `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;`**。存量表已由 `drizzle/0035_enable_rls_all_public_tables.sql` 一次性覆盖，但该迁移的动态循环只作用于运行时已存在的表，**管不到之后新增的表**。
- 若哪天真要开放某表给客户端直连（supabase-js `.from()` / realtime），**那才需要单独写 policy** —— 不能简单零策略拒绝。这属于架构级改动，先讨论。
- 不加 `FORCE`：表 owner 仍可绕过，符合现状。

---

## Prompt 资产保护

**创作者的 prompt 工程是核心资产，永远不对外暴露原文。**

`characters` 表里这 6 个字段属于 prompt 原料，**只有 owner 在 `/characters/<id>/edit` 里能看到原文**：
- `persona` / `adversity` / `defaultCognition` / `opening` / `plotSetting` / `outputSetting` / `sampleDialogue`

访客视图（包括 owner 自己访问详情页，access mode 一致）能展示的字段白名单：
- `avatarUrl` / `coverImageUrl` / `name` / `gender` / `age` / `tags` / `nsfw` / `bio` / `creatorNote`（作者的话，创作者对玩家说的话，展示性、不进 prompt）/ `visibility` / `conversationCount`
- 加上「美化演示」（合并订阅包后跑 sample 对话，不透露角色 opening / sampleDialogue 文本）

任何新增的展示型页面 / 公开 API / 导出端点动这几个字段前先回头看这条白名单。owner 想看自己的全文，唯一入口是 edit 页 —— 这是 feature，不是 bug，让创作者能直接预览访客视角。

---

## 核心架构

### 数据模型（详见 v1-foundation.md 第三节）

主要实体：
- `users` — 用户账号
- `characters` — 角色卡（16 字段，三块：角色信息 / 角色设定 / 高级设置）
- `sessions` — 会话
- `messages` — 消息（含 `debug_info` jsonb 字段供调试模式）
- `regex_rules` — 正则规则（关键字段：`runtime: 'sanitize' | 'iframe'`，`output_guidance`）
- `user_regex_preferences` — 用户对 visible 规则的开关偏好

### 正则系统双轨渲染

- `runtime: 'sanitize'` → DOMPurify + react-markdown + rehype-raw（静态富 HTML）
- `runtime: 'iframe'` → sandbox iframe srcdoc + Host API postMessage（带 JS 交互组件）

详见 v1-foundation.md 模块 4。

### selector 契约

- 所有 chat 页 UI 必须挂 `nj_*` 前缀的 ID/class
- 命名：`nj_<area>_<element>_<subelement>`（如 `#nj_chat_header`、`.nj_ai_message_bubble`）
- 详见 v1-foundation.md 模块 5.1

### AI 辅助生成 4 个生成器

- replacement-html / global-css / output-guidance / target-text
- 调用通路 `/api/ai/generate`（流式 SSE）
- prompt 模板写死在后端 `src/lib/ai/generators/prompts/*.txt`，creator 不可见不可改

详见 v1-foundation.md 模块 7。

### 调试模式

- 聊天页右上 toggle（**仅卡 owner 可见**）
- AI 气泡下折叠面板：原始输出 / 匹配规则 / 未匹配规则 / token / latency / system prompt
- 数据存 `messages.debug_info` jsonb

详见 v1-foundation.md 模块 8。

---

## 关键文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| v1 实施规划 | `docs/exec-plans/completed/v1-foundation.md` | 8 模块完整 spec + 数据模型 + 10 周里程碑（已完成） |
| 设计系统 | `DESIGN.md` | 视觉源头：颜色 / 字体 / 间距 / 装饰系统 |
| 上线检查清单 | `GO-LIVE.md` | 收真钱前的 Stripe 后台 / 生产配置（Adaptive Pricing / 商户资料 / 生产 webhook / live env） |
| 支付技术交接 | `docs/handover/stripe-payments.md` | Stripe 链路：checkout / webhook 幂等履约 / payment_orders / HKD 计价 |
| 法律文书交接 | `docs/handover/legal-agreements.md` | 用户协议 / 隐私政策：四语言结构、正本是日文版、改动前必读的三条约定 |
| 账号注销交接 | `docs/handover/account-deletion.md` | 硬删除链路：0011 级联是主力、两处 FK 放宽、孤儿会话、邮箱指纹 pepper |
| Ralph Loop 使用规范 | `RALPH-LOOP.md` | 启动 `/ralph-loop` 前的检查清单。**必须有 `--max-iterations` 或 `--completion-promise`**，否则会跑到 token 耗尽 |

---

## 支付（Stripe，已接入 —— 改动前必读）

月卡走 **Stripe Checkout 一次性买断**（卡 / 支付宝 / 微信），已在主干跑通验证。
**上线前的 Stripe 后台 / 生产配置清单见根目录 [GO-LIVE.md](./GO-LIVE.md)。**
技术细节见 [docs/handover/stripe-payments.md](./docs/handover/stripe-payments.md)。

几条不能改错的铁律：

- **计价币种 HKD**（账号是香港主体，微信只收 hkd / cny，**USD 用不了微信**）。三档 HK$30 / 68 / 128，
  单一来源 `src/lib/membership/constants.ts`（`CURRENCY` + `priceHkd`）。
- **月卡是一次性买断，不是订阅** —— 支付宝/微信在 Stripe 下不支持自动续费，别提议续费方案。
- **履约唯一可信信号是 webhook**（`src/app/api/stripe/webhook`），靠 `payment_orders.stripe_session_id`
  幂等。前端 `?pay=success` 只是反馈，**绝不拿它发货**。
- **普通用户开通唯一通路是 Stripe 付款**。旧的免费 `subscribeToTier` 已删（点一下免费发卡的漏洞），
  **别复活**；admin 手动开通走 `adminGrantMembership`。

---

## 不做清单（明确的「v1 后置」）

- 装饰品（头像框 / 灯牌 / 气泡）、装饰品商店
  （**注**：月卡付费已接入 Stripe，见上方「## 支付」；双币制 gold/silver 也已实现 —— 本行只剩装饰品系统后置）
- 创作者等级、粉丝 / 关注、合集、好友、社交链接
- 引继码买卖商店 / CSS 主题分发市场
- 内容审核（**永远不做**，见上方"内容立场"）
- 多模型切换 UI、模型市场
- 移动端原生 App、桌面壳、IM Bridge
- light mode（产品定位"暗夜读小说"，不开放）
