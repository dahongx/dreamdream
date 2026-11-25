# UI Polish Foundation —— 全站美化地基（技术交接）

> 产品思考见 [docs/insights/ui-polish-foundation.md](../insights/ui-polish-foundation.md)。
> 源头调研：本次改动来自一轮全站 UI 现状调研（角色详情 / 对话 / pack studio
> 三个创作者美化区之外的所有页面），结论是「碎片化是最大的丑」——同一设计
> 意图长出了 N 种实现。这一批 commit 先收地基。

## 改了什么（按 commit）

### 1. `fix(design)` 颜色违规清零 + 新 token

- **新增 token**（globals.css `:root` + `@theme inline` 桥接，DESIGN.md 已镜像）：
  - `--currency-gold` `#f59e0b` / `--currency-silver` `#94a3b8` —— 双币制金银。
    **刻意不用 `--accent-gold`**：强调金留给徽章 / 特别标记，货币语义分离。
  - `--glow-accent` / `--shadow-cta` / `--shadow-overlay` —— effects。组件里
    禁止再写死 rgba 发光/阴影，Tailwind 用 `shadow-(--glow-accent)` 语法引用。
- 扫掉的违规点：ProfileTabs 的 `amber-500`/`slate-400`、DailyClaimCard 的
  emerald 系 CTA、auth 两处幽灵 token `--accent-warning`（永远 fallback 到
  写死 `#ff6b6b`）→ `semantic-error`、10 处 `shadow-[...rgba]`。
- **成功反馈统一 `semantic-success`**（之前 Settings 保存 flash / auth notice
  用 accent-primary 当成功色）。

### 2. `feat(shell)` rail active 态

- rail 导航抽成 `src/components/nav/RailNav.tsx`（client，Shell 是 RSC 拿不到
  pathname）。active 判定与 MobileTabBar 同源。
- active 视觉 = 高亮底色 + **金色细下划线**（Shell docblock 一直承诺但从未
  实现；金色作「你在这里」标记是它在 chrome 上唯一的合法出场）。

### 3. `feat(explore)` 探索页 hero

- `explore.eyebrow`（探索）/ `heroTitle`（心之所往）字典键早已存在但从未
  渲染；新增 `subtitle` 题记键。
- **`.hero-title-xl`**：`.hero-title` 是未分层规则（压过 `text-4xl` utility，
  元素上写字号 utility 是死代码），4xl 档走这个同为未分层、源顺序更晚的
  modifier。
- **`.cosmic-dust`**：DESIGN.md 装饰系统 #3 首次落地，radial-gradient 星点
  （零资源请求），只铺 hero 区。

### 4. `feat(loading)` 段级 loading 骨架

- `explore/loading.tsx`（hero 静态文案直接画 + 网格骨架错峰 pulse）、
  `characters/[id]/loading.tsx`（hero 区中央呼吸点）、`creators/[id]/loading.tsx`。
- 背景：全站只有根 loading + force-dynamic，探索页每次筛选整个内容区变
  60vh 呼吸点，页面骨骼消失重建。

### 5. `feat(share)` 分享落地页 + OG

- **middleware 变化**：`/share` 加入 `GUEST_BROWSABLE_PREFIXES`
  （`src/lib/supabase/proxy.ts`）。社交爬虫永远未登录，之前抓到的是登录页
  redirect —— 分享链接在微信/Twitter 里全是无封面默认卡。
- 三路行为：登录 → 302 详情（不变）；访客 + private → 302 signin（原门禁，
  不渲染任何字段）；访客 + public/unlisted → 落地页（200 + OG meta）。
- **字段红线**：只用 CLAUDE.md「Prompt 资产保护」白名单展示字段。
  generateMetadata 对 private/不存在一律回全站默认 meta。
- 新 i18n 命名空间 `share`（types/zh/en 三件套）。

### 6. `feat(feedback)` pending/loading 反馈补全

- **新组件 `src/components/ai/BreathingDots.tsx`**：呼吸点最小复用单元
  （ThinkingDots 是带文案独立行版）。⚠️ `.ai-loading-dot` 未分层自带紫底
  8px，utility 压不过 → `onAccent`/`size` 变体走 inline style。
- auth 登录/注册提交 pending（SignUpForm 从 server 表单转 client）、shop
  付款轮询浮条（新 i18n 键 `shop.payConfirming`）、admin billing 历史加载、
  studio 创建 overlay、CharacterForm 图片上传（原 animate-pulse）。
- 新 i18n 键 `auth.signingInButton`。

### 7. `refactor(characters)` CharacterGridCard 收敛

- **`src/components/characters/CharacterGridCard.tsx`** 是角色卡 grid item
  唯一实现，variant 预设：`explore` / `creator` / `library` / `profile` / `mini`。
  五处复制（explore、creators/[id]、create 库、me 角色 tab、CreatorCard
  三连预览）全部替换。
- `/me` 网格修复：原来掉了 R18/可见性角标（数据查了没渲染）。
- **`src/lib/util/format-stat.ts`** 统一大数缩写（原两份实现行为不同）。
- 行为统一：CreatorCard 预览改 hardNav（原 `<Link>` 会弹 @modal，与探索
  网格 `<a>` 直出详情页分裂）。

### 8. `feat(polish)` 设置页 hero

- 设置页渲染字典里备好的 eyebrow/heroTitle。

## 关键 gotcha（后来者必读）

1. **未分层 CSS 的优先级陷阱**：`.hero-title` / `.ai-loading-dot` /
   `.glass-card` 等 globals.css 里的类不在 `@layer`，Tailwind v4 的
   utilities 在 layer 里 —— **元素上的 utility 永远输给这些类**。改字号用
   `.hero-title-xl` 这种后置 modifier，改点的颜色/尺寸用 inline style。
2. **创作者美化保护区**（组件级，不是页面级）：`PreviewCanvas`、
   `PackPreview`、`RegexForm` 右列测试面板、`CreatorSandboxPanel`
   （CharacterForm 内）、chat 页 `data-character-css` 子树、
   `CharacterReelSection`。所有 `nj_*` selector 发布即 API。本批 commit
   均未触碰这些区域（chat 弹层的阴影 token 化是等值替换，utility 本来就
   输给 creator CSS）。

## 第二批（同分支后续 commit）

- **P0 管线修复**（`fix(regex)`）：`BridgePayload.cssScope` → iframe
  `<body>` 挂 `data-character-css` 宿主属性（OpeningSlot 传 "opening"，
  不传行为不变）；`CharacterReelSection` 补 sanitize 轨的 wrapper +
  scoped `<style>`。创作者皮肤在详情页播放厅 / opening iframe **首次
  真正生效**。附 3 条回归测试（segments-iframe.test.ts）。
- **共享表单控件层**（`feat(ui)`）：`src/components/ui/field.ts`
  （fieldBaseCls + md/sm 两档，纯 class 字符串模块）；四套规格全部
  迁移（SettingsForm / SignIn / SignUp / TierSection / CharacterForm
  紧凑档）；`html { color-scheme: dark }` 让原生 select 弹层 / 滚动条
  落回暗色。
- **EmptyState 统一**（`refactor(ui)`）：`src/components/ui/EmptyState.tsx`，
  /create、sessions ×2、shop 直购四处替换。
- **DialogProvider 统一**（`refactor(ui)`）：StudioLayout 7 处 +
  CreatorCard 2 处的原生 window.confirm/alert 清零。

## 遗留 backlog（调研已完成、未做）

- 三种 tab 视觉收敛（/create 短线式 vs /sessions 下划线式 vs /me 胶囊式）
- sessions/聊天侧栏加最后消息预览 + 时间；composer autosize；流式淡入
- PackPreview / PreviewCanvas 的 iframe 轨皮肤注入（与 opening 同构的
  no-op，本批只修了 OpeningSlot 链路，studio 侧属保护区留待单独 review）
- i18n 漏网（ProfileTabs 钱包区、studio 一片、TierSection「复制」等）
- selector 字典欠账（studio 15+ 只登记 4、shop 8 个只在 handover、
  `.nj_ai_message_row` 未入典）
- 非视觉风险（已上报待产品决定）：creators 主页公开展示 email、
  SignInForm 明文密码 base64 存 localStorage、死代码
  CharacterChatPreview.tsx / CssTab.tsx
