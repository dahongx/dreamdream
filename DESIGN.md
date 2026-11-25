# Design System — 寄情 (Dearm)

> 设计基准：approved variant B（沉浸氛围、古风言情路线）。批准 mockup 在 `~/.gstack/projects/mufylikeu/designs/design-system-20260518/variant-b.png`（gstack slug 跟工作目录走，未随品牌改名）；图中的角色卡角落装饰已于 2026-08-02 移除，不再作为实现参考。
>
> 设计源头：详见 `docs/exec-plans/active/v1-foundation.md` 第 5 节「全局美化系统」。creator CSS 美化的 selector 契约（`nj_*` 前缀）也定义在该文档。

---

## Product Context

- **What this is:** 寄情 (Dearm) — Web 多用户 AI 角色扮演聊天平台 + creator 工具集
- **Domain:** dearm.ai
- **Who it's for:** 18-30 岁中文女性，女性向 / BL / 言情 / 二次元 / 古风受众
- **Space/industry:** AI 角色聊天平台（对标 Mufy chat.mufy.ai，参考 Character.AI / Janitor AI）
- **Project type:** Web 多页面应用（探索 / 聊天 / 角色卡 CRUD / 正则编辑 / AI 辅助生成 / 调试模式）
- **Content posture:** NSFW 友好，平台零审核
- **设计签名:** 「一轮月」—— 无论 TA 是古代书生、现代 CEO 还是星际舰长，无论你翻开哪本小说，你和 TA 之间永远只有**一轮月**斜射入画。不是 SaaS 工具，是一个深夜里有人陪你的私密场景（v2 演进：Wave 1-4 用「一盏灯」暖橘签名，Wave 5「夜青银」大转向为「一轮月」冷月光——从暖紫黑走向 MoMA / 江诗丹顿的冷调贵气，气质从"甜"到"贵"）

---

## Aesthetic Direction

- **Direction:** 深夜银月 × 文学衬线 × 抽象东方（v2 Wave 5 从"深夜灯下"转"深夜银月"，冷调 MoMA / 江诗丹顿方向）
- **Decoration level:** expressive（带克制）—— vignette + scanline + cosmic dust + 右上角冷月光晕
- **Mood:** 深夜，一轮月斜射入画。冷静、克制、贵气、去 AI 味、有文学性
- **核心隐喻:** **月**（不是灯 / 书 / 帐 / 剧场 / 藏品）—— 因为「月」是唯一同时满足：跨时代（古今都有月）、跨题材（任何角色都能被月光笼罩）、含冷静距离感（月光不温暖但陪伴）、含东方气（中式意象比"moon"深）
- **Signature elements（每个页面都该有的视觉签名）:**
  1. 大号衬线中文标题（页头 hero，Noto Serif SC 4xl，收紧字距 `letter-spacing: -0.005em` 让"整块题字"）
  2. 夜青蓝底 `#0b1220` + 冷银 accent + 玻璃感卡片
  3. 极淡 scanline 水平纹理（~10% opacity）
  4. 背景星点 / cosmic dust 雾气
  5. **右上角冷月光晕**（`--moon-cool` 径向渐变，peak 35% opacity，位置在画面内 `88% 8%`）—— **全站唯一 signature，v2 Wave 5 升级自 lamp-warm 暖橘**
  6. **点睛金**（`--accent-gold`）：90/10 江诗丹顿配比里的 10 —— 只用于关键 CTA（角色详情"落座"、商店推荐档订阅、tag 选中态）、会员徽章、朱印、hero 章节标签、作者的话左竖线；**不做大面积**

- **Reference variant:** [variant-b.png](~/.gstack/projects/mufylikeu/designs/design-system-20260518/variant-b.png) —— B 路线原始（v2 Wave 5 后色系已远离 variant-b，仅参考装饰密度和留白）
- **Reference 竞品:** MoMA / 江诗丹顿广告（**新方向标杆**），Mufy（紫色赛博夜店感，**反例**），Janitor AI（紫色赛博朋克但更野，**反例**），Character.AI（白底极简 SaaS，**反例**）
- **AVOID（明确不做）:**
  - 粉色蝴蝶结甜美少女风（受众已经过了这阶段）
  - 白底商务 SaaS 风（Character.AI 路线，性别中性化把"角色扮演"卖成"生产力"）
  - **紫色主导**（v2 Wave 5 明确抛弃，紫罗兰 accent 走向"少女 AI 工具"感）
  - 具象古代器物（油灯 / 焦尾琴 / 罗帐 / 竹帘）—— 会跟现代 / 科幻角色卡违和，只保留**月光**这个抽象质感
  - 大面积金色（金色是 90/10 里的 10 点睛，绝不做主色）
  - 一切 AI slop：紫色渐变默认按钮 / 3 列 icon-in-circle 卡片 / 居中一切 / 通用 hero section

---

## Typography

**关键差异化：** display / hero / 大标题用衬线，body 用 sans。Mufy 全 sans 是它的视觉弱项，我们在这里拉开差距。

### 四栈字体（v2 Wave 10 从三栈升到四栈）

| 角色 | 英文 | 中文 | 加载策略 |
|------|------|------|----------|
| **Display / Hero / 大标题** | **Fraunces**（500-700 weight） | **Noto Serif SC / TC / JP / Thai**（700-900 weight，随 `html[lang]` 切换） | `@fontsource` 自托管 + `font-display: swap` |
| **Body / UI 文本** | **Inter**（400-600 weight） | **PingFang TC / Yu Gothic** 等目标市场系统字；泰语用 **Noto Sans Thai** | TC / JP 优先系统字体以控制 CJK 包体；Thai 由 `@fontsource` 自托管 |
| **Numeric / 极窄衬线数字**（v2 Wave 10 新增）| **Instrument Serif**（400 weight） | fallback 到 Fraunces / Georgia | `@fontsource` 自托管 |
| **Mono / 数字 / 调试** | **JetBrains Mono**（400-600） | 同字体（Mono 中英文都用） | Google Fonts subset |

**Numeric 用法**：大数字场景（HK$128 价格 / 粉丝数 / 章节编号 / 会员到期日）用 `.nums-editorial` utility，切到 Instrument Serif。至少 24px 起才看清 —— 小屏 12-16px 场景仍用 `.nums-oldstyle`（PingFang 自带 oldstyle）。Aesop / Sézane / The RealReal 的印刷品质感。

### 字号阶梯（modular scale，base 16px = 1rem，比例 1.25）

| Level | px | rem | 用途 |
|-------|----|----|------|
| `xs` | 12 | 0.75 | 数字 stats / 调试 mono / 极小 metadata |
| `sm` | 14 | 0.875 | 二级 UI 文本 / chip 标签 |
| `base` | 16 | 1 | body 段落、表单输入 |
| `lg` | 20 | 1.25 | 卡片标题（serif）、按钮文本（sans） |
| `xl` | 28 | 1.75 | 弹窗 / panel 标题（sans） |
| `2xl` | 36 | 2.25 | 页面 H2（sans 也可衬线） |
| `3xl` | 48 | 3 | 页面 hero（**衬线必用**） |
| `4xl` | 60 | 3.75 | 探索页 / 落地页 hero（**衬线必用** + 粗 weight） |

### Hero 标题规则（重要约定）

每个核心页面（探索 / 角色卡详情 / 创作者主页）的页头都该有一个 **3xl 或 4xl 衬线** 的中文大标题，给页面定调：

- 探索页：`<h1 class="hero-title">探索</h1>` → 4xl Noto Serif SC 900
- 聊天页：角色立绘旁的角色名 → 3xl Noto Serif SC 700
- 创作页：`<h1 class="hero-title">铸造</h1>` → 4xl Noto Serif SC 900
- 设置页：`<h1 class="hero-title">设定</h1>` → 3xl Noto Serif SC 700

### Hero Eyebrow（v2 探索页扉页题记）

hero 标题下方可搭配一个 Fraunces italic 英文题记，做「扉页」排版语汇。当前只探索页启用，其他核心页 hero 保持单一大标题不加副题（避免 boldness 分散）。

- 用法：`<p class="hero-eyebrow">where fictions breathe.</p>`
- 视觉：Fraunces italic 400 · `--text-sm` · `--text-muted` · 左侧 `--ink-jade` 细 hairline（宽度 clamp 8-16ch）
- 每 locale 用同一句英文（不本地化），品牌一致

### Body 字体配置

- 中文行高 `1.75`（中文字符紧凑，行间需要更多呼吸）
- 英文行高 `1.5`
- 中英文混排时，中英文之间留 0.125em 间距（jQuery pangu-style 或 CSS `text-spacing`）
- 中文 letter-spacing: 0.02em（轻微）

---

## Color

### 基础色板

| Token | Hex | 用途 |
|-------|-----|------|
| `--bg-base` | `#0b1220` | 页面最底色（v2 Wave 5「夜青银」大转向，从暖紫黑 `#17102a` → 夜青蓝 `#0b1220`，MoMA / 江诗丹顿方向） |
| `--bg-elevated` | `#131b2b` | 二级表面（浮层背景，比 base 稍深显层级） |
| `--surface-glass` | `#1a2438` | 卡片 / 面板背景（玻璃感前的底色，配 60% opacity + backdrop-blur） |
| `--surface-solid` | `#26334a` | 不要玻璃感的实体面板（弹窗内层、tooltip） |
| `--border-subtle` | `rgba(184, 197, 209, 0.12)` | 卡片描边 / 分割线（冷银 hairline） |
| `--border-strong` | `rgba(184, 197, 209, 0.32)` | hover / focus 状态描边 |

### Accent 色

| Token | Hex | 用途 |
|-------|-----|------|
| `--accent-primary` | `#b8c5d1` | 主 CTA / 选中 tab / link / focus ring（**v2 Wave 5：从紫罗兰 `#bd8ce8` 改为冷银 `#b8c5d1`**，token 名字保留避免大范围重命名，只改值） |
| `--accent-primary-hover` | `#d0dae4` | hover 状态（亮银） |
| `--accent-primary-active` | `#94a3b8` | active / pressed 状态（暗银） |
| `--accent-secondary` | `#f0abfc` (fuchsia-300) | NSFW toggle / 「AI 生成」标签 / 「AI 美化」按钮（保留 —— 是 AI 生成场景的专有颜色身份） |
| `--accent-gold` | `#d4af37` | **点睛金**：v2 Wave 5 上位到 CTA 主色，仅用于最关键 CTA（角色详情"落座"、商店推荐档订阅、tag 选中态）、会员徽章、朱印、hero 章节标签、作者的话左竖线。90/10 江诗丹顿配比里的 10 |
| `--accent-gold-soft` | `#e8c97a` | 金色淡化版（次要装饰、副标题金色） |
| `--accent-amber` | `#fbbf24` (amber-400) | NSFW 内容标识 "R18" 角标（保留 —— 语义色不受主色影响） |

### 「一轮月」主题辅色（v2 Wave 5 升级自「一盏灯」）

命名绑定**质感**（月 / 墨），不绑定**器物**（lantern / candle / jade-pendant），
所以跨题材角色（现代 CEO / 古风剑修 / 星际舰长）都不违和。

| Token | Hex | 用途 |
|-------|-----|------|
| `--moon-cool` | `#c4d1e0` | 冷月光。全站右上角光晕主色（v2 Wave 5 从 `--lamp-warm #d4a373` 暖橘换到冷月光，跟夜青底 + 冷银 accent 统一冷色温）。peak 35% opacity，位置 `88% 8%` 画面内。不能用作大面积按钮填充或卡片背景——那样会失去"月光斜射入画"的暗示。 |
| `--ink-jade` | `#7d9b8a` | 墨玉青。保留（v2 Wave 5 冷调下依然协调）——用于安静型 hover 状态、次要 tag hairline、创作者名字下的装饰线、hero-eyebrow 短分隔线、章节标签左侧短线。 |

### 文本色

| Token | Hex | 用途 |
|-------|-----|------|
| `--text-primary` | `#f0f4fa` | 主文本（最高对比，body 内容；v2 Wave 5 从偏紫的浅白 `#f8f1fb` 改为冷象牙白） |
| `--text-secondary` | `#b8c5d1` | 次要文本（metadata、placeholder 强调；v2 Wave 5 从暖紫 `#cfb4ec` 改为冷银） |
| `--text-muted` | `#6b7a8f` | 弱化文本（时间戳、副标题；v2 Wave 5 从紫灰 `#b0a2bd` 改为冷灰蓝，色温统一） |
| `--text-disabled` | `#6b7280` | 禁用状态 |
| `--text-on-accent` | `#0b1220` | accent 背景上的文本（按钮内文本；v2 Wave 5 跟随 base 同步） |

### 语义色

| Token | Hex | 用途 |
|-------|-----|------|
| `--semantic-success` | `#34d399` (emerald-400) | 保存成功 / 校验通过（**成功反馈统一用它**，不要用 accent-primary 代替） |
| `--semantic-warning` | `#fbbf24` (amber-400) | 警示（同 NSFW，复用） |
| `--semantic-error` | `#f87171` (red-400) | 错误 / 校验失败 |
| `--semantic-info` | `#60a5fa` (blue-400) | 提示信息 |

### 货币色（双币制）

| Token | Hex | 用途 |
|-------|-----|------|
| `--currency-gold` | `#c9a961` | 金币余额 / 计费数字与图标着色（v2 Wave 5 从鲜黄 amber-500 `#f59e0b` 改为深金 `#c9a961`，匹配冷银主基调，不再突兀） |
| `--currency-silver` | `#94a3b8` (slate-400) | 银币余额 / 计费数字与图标着色 |

**不是 `--accent-gold`**：那个是徽章 / 特别标记等稀有强调色。货币语义永远走 `--currency-*`。

### Effects（发光 / 阴影）

| Token | 值 | 用途 |
|-------|-----|------|
| `--glow-accent` | `0 0 12px rgba(184, 197, 209, 0.45)` | toggle 开启态 / focus 发光（v2 Wave 5 从紫光换到冷银光） |
| `--shadow-cta` | `0 8px 24px -12px rgba(184, 197, 209, 0.6)` | 主 CTA 按钮投影（同上，冷银） |
| `--shadow-overlay` | `0 20px 60px rgba(0, 0, 0, 0.5)` | popover / dropdown / toast 浮层投影 |

组件里禁止再写死 rgba 发光/阴影值，Tailwind 里用 `shadow-(--glow-accent)` 语法引用。

### Light mode

**v1 不做** —— 产品定位是"暗夜里读小说"，明亮模式破坏沉浸感。**未来不开放 light mode**，creator 想要也劝退。

### 颜色用法约定

- **不要纯黑 `#000`**：背景永远用 `--bg-base #0b1220`，避免"屏幕熄灭"感
- **不要纯白 `#fff`**：文本永远用 `--text-primary #f0f4fa`，冷象牙白
- **金色 90/10 江诗丹顿配比**：`--accent-gold` 是全站关键 CTA / 徽章 / 朱印 / 章节标签的**点睛色**（10%），冷银 `--accent-primary` 是全站主视觉色（90%）。不要反过来——大面积金色会显廉价，冷银承担全部日常交互
- **Fuchsia 节制使用**：`--accent-secondary` 只在「AI 生成 / NSFW toggle 开启时 / 重要提醒」三种场景出现。大面积铺 fuchsia 会显幼稚少女风
- **`--moon-cool` 只作"月光"**：只用于**画面外光源**的场景（body 层右上角光晕、少量 focus 光晕）。不做按钮填色、卡片背景、大面积文字色——会失去"月光斜射入画"的暗示
- **`--ink-jade` 只作"墨"**：只用于**次要装饰细节**（hairline、次级 tag border、创作者名字下的装饰线、hero-eyebrow 短分隔线、章节标签左侧短线）。不做主 CTA、不做大面积——玉青大面积会滑向"军训绿"

---

## Spacing

### Base & 比例

- **Base unit:** `4px`
- **Density:** `comfortable` —— creator 工具页面紧（4-5 字段一屏），探索 / 聊天页面透气

### 间距阶梯

| Token | px | 用途 |
|-------|----|----|
| `space-2xs` | 2 | 极小间距：icon 与文字、徽章内 padding |
| `space-xs` | 4 | tag chip 内 padding、icon button 内 |
| `space-sm` | 8 | 卡片内元素间距、表单字段间隔 |
| `space-md` | 16 | 网格 gap、card padding、section 间距 |
| `space-lg` | 24 | 主要 panel padding、表单 group 间距 |
| `space-xl` | 32 | 页面 section 之间 |
| `space-2xl` | 48 | hero 与 main content 之间 |
| `space-3xl` | 64 | 探索页 hero 上下 margin |

### 容器

- **Max content width:** 1440px（探索页网格、聊天页主区）
- **Page padding:** mobile 16px / tablet 24px / desktop 48px
- **Card grid gap:** 16px

### 响应式断点

Tailwind 默认断点：`sm:` 640 / `md:` 768 / `lg:` 1024 / `xl:` 1280。`md:` 是「手机 / 平板+桌面」分水岭。

- **Page horizontal padding** 走 `var(--page-px)`（16 / 24 / 48 自动切档），所有页面外层容器优先用它，禁止再写死 `--space-xl`
- **Page vertical padding** 走 `var(--page-py)`（16 / 20 / 24 自动切档）—— 配套的纵向呼吸 token。Topbar 已经占 64px，再叠 32+ 的 page py 会把 hero 压得太靠下，所以这条阶梯刻意收紧。页面外层容器统一用它，禁止写死
- **手机端 type scale 自动降档**（`< md`）：`--text-lg → 18` / `--text-xl → 22` / `--text-2xl → 28` / `--text-3xl → 32` / `--text-4xl → 40`。body 用的 `--text-base` 不动。token 桌面值仍是单一真相，组件不要在自身 className 里再写 `text-base md:text-xl` 之类的硬编码降档
- **左侧 rail**（`var(--rail-width)` = 72px）仅 `>= md` 出现，手机端整体 `hidden md:flex`
- **底部 Tab Bar**（`var(--bottombar-height)` = 56px）仅 `< md` 出现：4 个 icon-label 同 rail 同源；走 `pb-[env(safe-area-inset-bottom)]` 适配 notched 机型
- **聊天页 immersive：** 进入 `/chat/*` 后底部 Tab Bar 自动隐藏（让出垂直空间，参考 WhatsApp / Telegram）
- **聊天会话侧栏** 桌面 260px 固定 aside，手机端走从左滑入抽屉，触发器 = chat header 的 📋 按钮

---

## Layout

### 全局结构

- **Approach:** hybrid —— 探索 / 创作流走 grid-disciplined，登录 / onboarding / 角色卡详情走 creative-editorial
- **Left rail width:** 60px（图标导航 + 圆角 violet logo "m"）
- **Top bar height:** 64px
- **Hero 区高度:** 探索页 ~120px（含 4xl 大标题 + 副标题）
- **Card grid:** 探索页 4 列响应式（lg+ 4 列 / md 3 列 / sm 2 列 / xs 1 列）

### Border Radius 阶梯

| Token | px | 用途 |
|-------|----|----|
| `radius-sm` | 6 | 小元素：tag chip、徽章、小按钮 |
| `radius-md` | 12 | 卡片、面板、弹窗 |
| `radius-lg` | 20 | 大型容器：探索网格 wrapper、聊天主面板 |
| `radius-pill` | 9999 | 全圆角：搜索框、Tab pill、CTA 按钮 |

### 玻璃感（Glassmorphism）

- **使用场景:** 卡片、面板、弹窗
- **CSS 配方:**
  ```css
  background: rgba(26, 21, 48, 0.6);   /* --surface-glass at 60% */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-subtle);
  ```
- **不滥用:** 表单输入、按钮、密集列表项 → 用 `--surface-solid` 实体表面，避免性能 + 可读性问题

### 装饰系统（变体 B 的签名）

这是 寄情 视觉签名的一部分。每个核心页面都该有这些装饰元素：

#### 1. Scanline 纹理

- **使用范围:** 整页背景（伪元素覆盖）
- **CSS:**
  ```css
  body::before {
    content: '';
    position: fixed; inset: 0;
    pointer-events: none;
    z-index: 1;
    background-image: repeating-linear-gradient(
      0deg,
      transparent 0px,
      rgba(255, 255, 255, 0.012) 1px,
      transparent 2px,
      transparent 3px
    );
    opacity: 0.8;
  }
  ```
- **强度:** 总视觉感受 ~10% opacity，不能干扰阅读

#### 2. Vignette（角落暗化）

- **使用范围:** 主页面、登录页
- **CSS:**
  ```css
  body::after {
    content: '';
    position: fixed; inset: 0;
    pointer-events: none;
    z-index: 2;
    background: radial-gradient(
      ellipse at center,
      transparent 50%,
      rgba(0, 0, 0, 0.5) 100%
    );
  }
  ```

#### 3. Cosmic Dust（星点 / 粒子）

- **使用范围:** 探索页 hero 区背景、聊天页空状态
- **实现:** SVG `<use>` 引用 + `<feTurbulence>` 噪声纹理，或用 CSS `background-image` data-URI 噪声 PNG
- **密度:** 整页 ~20-40 个微星点，不密集
- **颜色:** `rgba(245, 243, 255, 0.4)` 半透明 lavender

#### 4. 「一轮月」右上角冷月光晕（v2 全站唯一 signature，Wave 5 升级）

**这是 v2 视觉记忆点**。抽象化的"月光斜射入画面"暗示，跨题材角色都不违和。v2 Wave 5 从「一盏灯」暖橘 (peak 18%) 升级到「一轮月」冷月光 (peak 35%)，opacity 提升到真的可见 + 位置从画面外挪到画面内。

- **使用范围:** 全站 body 层，聊天页 (`body:has(#nj_chat_app)`) 自动豁免
- **CSS:**
  ```css
  body {
    background-image: radial-gradient(
      ellipse 60% 55% at 88% 8%,
      color-mix(in oklab, var(--moon-cool) 35%, transparent) 0%,
      color-mix(in oklab, var(--moon-cool) 15%, transparent) 30%,
      transparent 65%
    );
    background-attachment: fixed;
    background-repeat: no-repeat;
  }
  body:has(#nj_chat_app) { background-image: none; }
  ```
- **强度:** 峰值 ~35% opacity（Wave 5 升级，老 18% 在暗底上肉眼几乎失效），位置 `88% 8%` 已进入画面内，只在右上 1/4 viewport 可见；`background-attachment: fixed` 让光晕锚 viewport 而非跟随滚动
- **色源:** `--moon-cool` (`#c4d1e0`)，禁止写死 rgba —— 用 `color-mix(--moon-cool ..., transparent)`
- **聊天页豁免逻辑:** 聊天页是创作者美化的沉浸空间，平台光晕在这里会跟角色化色调 / 立绘 / 灵动岛 / 状态栏抢戏，通过 `:has(#nj_chat_app)` 自动撤掉；creator 若想恢复月光可在 `global_css` 里针对 body 恢复
- **不做 breathing:** 光晕保持静态。之前有过讨论要不要给光晕加动效，但决策不做 —— reduced-motion 无需处理；「呼吸」这个动效语汇留给 AI 生成 loading dot 一处，不外扩

---

## Motion

### Approach

`intentional` —— 不滥用动效，但有几个签名动效让产品"活起来"

### Easing & Duration

| Token | 值 | 用途 |
|-------|-----|------|
| `ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | 元素进入（弹窗、抽屉、toast） |
| `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | 元素退出 |
| `ease-move` | `cubic-bezier(0.4, 0, 0.2, 1)` | 移动 / 位置变化 |
| `dur-micro` | 100ms | 按钮 hover、tab 切换 |
| `dur-short` | 200ms | 弹窗淡入、卡片 hover 凸起 |
| `dur-medium` | 300ms | 大面板切换 |
| `dur-long` | 500ms | 路由切换 |

### 签名动效

#### 1. 卡片 hover 凸起

```css
.card { transition: transform var(--dur-short) var(--ease-move),
                     box-shadow var(--dur-short) var(--ease-move); }
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4),
              0 0 0 1px var(--border-strong);
}
```

#### 2. 流式输出打字效

聊天页 AI 消息流式时，新字符以 60ms 间隔 fadeIn（不是逐字打字效，那种太刻意）

#### 3. AI 生成「呼吸点」

**这是替换通用 spinner 的关键动效。** 替代菊花圈 / 转圈。

```css
@keyframes breathing {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.05); box-shadow: 0 0 12px var(--accent-primary); }
}
.ai-loading-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--accent-primary);
  animation: breathing 1.6s ease-in-out infinite;
}
```

用三个错峰呼吸点组成一行 `• • •`，每个延迟 0.2s 启动 —— 像心跳。

#### 4. NSFW toggle 开关动效

切换时整个 toggle 从 muted → fuchsia 用 200ms ease-out，配一个微妙的发光（box-shadow 渐现）

#### 5. 卡片 R18 角标进入

页面加载时 R18 amber 角标用 `dur-medium` 延迟 `dur-short` 后 fadeIn + 微旋转 5deg → 0deg

#### 6. 减少动效偏好

```css
@media (prefers-reduced-motion: reduce) {
  .glass-card { transition: none; }
  .rise-in,
  .ai-stream-tail,
  #nj_background_image { animation: none; }

  /* 保留 ai-loading-dot 的呼吸 — 那是核心体感 */
  .ai-loading-dot { animation-duration: 1.6s; }
}
```

---

## Iconography

- **Library:** [Lucide React](https://lucide.dev) 主用 + 自绘补充
- **Stroke width:** 1.5
- **Sizing scale:** 16 / 20 / 24（小、中、大）
- **Color:** 默认 `--text-muted`，hover / active 状态用 `--accent-primary`
- **不要 emoji 当 icon:** 探索页 stats `💬 12.4k` 可以用 emoji，**功能按钮不要**（emoji 跨平台渲染差）

---

## 与 `nj_*` Selector 契约的关系

DESIGN.md 定义**视觉的"是什么"**；selector-contract.md（见 v1-foundation.md 模块 5.1）定义**视觉的"挂在哪"**。

- 所有这里定义的 token（`--bg-base` / `--accent-primary` / `--space-md` 等）都作为 CSS custom property 在 `:root` 暴露
- creator 在 `global_css` 写 CSS 时可以读这些 token（但不能改根级 token）
- 标准 `nj_*` 元素的默认样式来源于 DESIGN.md
- creator 用 `global_css` 覆盖这些样式时，CSS walker（v1-foundation.md 模块 5.4）允许覆盖颜色 / 字体 / 边框 / 阴影，禁止覆盖 position / pointer-events / z-index

---

## v1 应用清单

为了让这套系统"立起来"，v1 W8（全局美化系统专项）需要落到具体页面：

| 页面 | hero 标题 | 关键装饰 | 关键页面元素 |
|------|-----------|----------|--------------|
| 探索 | `<h1>探索</h1>` 4xl 衬线 | scanline + vignette + cosmic dust | tab pills / 角色卡网格 / NSFW toggle |
| 聊天 | 顶部条角色名 3xl 衬线 | scanline + vignette（弱）| 双栏布局 / 流式打字效 / 调试模式面板 / 透明消息流（无气泡） |
| 角色卡编辑 | `<h1>铸造</h1>` 4xl 衬线 | 仅 scanline（专注） | 折叠 panel / 多 textarea / AI 生成按钮 |
| 新建正则弹窗 | `<h2>新建正则</h2>` 2xl sans | 弹窗本身的玻璃感 | 左右分栏 / 测试面板 / 8 个核心字段 |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-18 | 创建 DESIGN.md，approved variant B（古风言情路线） | 用户对照 3 个 mockup 变体（中度装饰 / 加重氛围 / 极简克制）选择 B。Reviewer 推荐 A，用户选 B（user sovereignty）。沉浸氛围 > 题材包容 |
| 2026-05-18 | Hero 大标题用衬线（Fraunces + Noto Serif SC） | 关键差异化。Mufy 全 sans 是它的盲点，我们在 typography 上拉开差距，让产品有"会动的小说书架"感而非"另一个 SaaS" |
| 2026-05-18 | 双 accent（violet + fuchsia） | Mufy 单一紫色易疲劳。NSFW toggle / AI 生成各有独立颜色身份 |
| 2026-05-18 | 卡片角落金色细装饰为视觉签名（已于 2026-08-02 撤销） | variant B 的早期亮点，后来根据前端方向调整移除 |
| 2026-05-18 | 不做 light mode | 产品定位"暗夜读小说"，明亮模式破坏沉浸感 |
| 2026-05-18 | 不用纯黑 / 纯白 | 用 `#0e0a1a` 深紫黑替代 `#000`；用 `#f5f3ff` lavender white 替代 `#fff`。给暖紫色调 |
| 2026-05-18 | AI 生成 spinner 改"呼吸点" | 替代转圈通用 spinner，传达"AI 在创作而不是在等待"的体感。与 mumu 小手机案例的呼吸灯统一 |
| 2026-06-21 | **聊天页默认皮肤原则：读小说叙事感优先，角色化修饰留给 creator。**具体改动：移除 narration / emphasis 的渐变文字，AI 气泡改透明无边框，段间距收紧 | 核心逻辑 —— 默认状态下不做过多角色化装饰（彩字 / 气泡 / 特殊字重 / 装饰边框），让玩家看见"一段连续的小说叙事"而不是"一个个被装饰的 IM 气泡"；字体 / 配色 / 气泡这些角色化定制是每个角色 / 每本书的视觉个性，由 creator 用 `global_css` 自己加。这是平台 creator 友好定位的延伸 —— 平台不替 creator 决定每个角色长什么样。例外：`.nj_user_message_bubble` 仍保留 accent-primary 实底，因为用户消息是"自我表达点"，需要最醒目。selector 留着不动（`nj_*` 一旦发布即 API），只剥默认视觉 |
| 2026-06-21 | `<think>` 内心独白也走同一原则：去掉玻璃底 + 紫色 border-left + 上下 margin | 跟上一条决议同一套逻辑收尾。原 think 块的"折叠盒"视觉每次都把消息流切断，违反"连续叙事"目标。改成跟 narration 同层 —— 斜体 muted 浮字，padding-block 2xs，margin 0。展开/折叠交互保留（仍是 LLM 在想什么的玩家信号）。creator 可在 global_css 恢复气泡感 |
| 2026-06-21 | 渲染契约新增 `<user>` / `<usr>` 标签，渲染成玩家气泡（accent 实底 + 玩家头像，右对齐） | 触发 case：「谢寻」开场白把"项链很好看，谢谢老公。"用 `<message>` 包了，被渲染成角色发言，玩家头像和台词错位。根因是旧契约只有 `<message>`，作者要表达"开场预设的玩家反应"无路可走。新增 `<user>` 是契约级补丁 —— 渲染端：MessageRenderer 路由 + 新组件 UserBubbleFromTag + MessageBubble 注入 UserAvatarContext；协议端：RENDER_PROTOCOL 教 LLM 标签存在 + 规则 #5 限制滥用（默认不主动写，优先 `<narration>`）；契约文档同步 §2.3/§2.4/§8/§11.3/§11.7；sanitize allowlist 加 user/usr。共用 `.nj_user_message_bubble` class，跟外层 user 消息默认皮肤一致 |
| 2026-07-05 | 整站色调向 logo 主基调暖化：accent-primary 冷薰衣草 #a78bfa 到暖紫罗兰 #bd8ce8；bg/surface/border/text 系全部微增红减蓝；themeColor / manifest 同步 | 官方主视觉是暖粉紫梦幻调（主色 #e3a0dc），站点原冷薰衣草偏冷，与 logo 和年轻女性受众都有距离。整体往暖紫走做品牌统一，取暖紫罗兰不滑向甜腻粉（守「不做粉色甜美少女风」红线）。根 token 变化会渗透聊天默认皮肤（用户气泡等），但属默认皮肤演进：creator global_css 显式覆盖的颜色不受影响，只有没被定制的默认部分跟着暖 |
| 2026-07-04 | **色温统一 + fuchsia 上岗 + 按钮词汇表**：① --text-muted #a5b4cb → #a8a2c0；② AI 创作场景（AIGenerateButton / studio 助手）的呼吸点换 fuchsia（.ai-loading-dot-creative），聊天流式保持紫；③ ui/button.ts 三档按钮词汇（primary pill+CTA投影 / secondary 描边 / ghost），高可见 CTA 已迁移 | ① 原 muted 是冷蓝灰，在暖紫底上有色温冲突，全站高频弱化文字"隔了一层"；② 双 accent 设计初衷（fuchsia = AI 生成的颜色身份）此前从未兑现，呼吸点分色建立「粉紫 = AI 在为我创作」的联觉；③ 按钮此前各页手写无成文规则，词汇表成文 + 新代码一律走模块，旧按钮增量迁移（shop 渐变订阅钮等特殊件不强套） |
| 2026-07-04 | **氛围动效落地**：① 聊天立绘 26s 呼吸微动效（`nj-stage-breathe`，独立 `scale` 属性）② 跨文档 View Transitions（260ms 交叠） | ① 立绘呼吸让舞台"活着"（会动的小说书架），用独立 scale 是因为 #nj_background_image 靠 transform utility 居中，动画写 transform 会顶掉居中；放 nj-skin 层，creator 覆盖稳赢；reduced-motion 关闭；② 只作用于整页导航（explore 硬导航进详情等），App Router 软导航不受影响，不支持的浏览器行为不变（渐进增强） |
| 2026-08-02 | 移除角色卡角落装饰与按 tag 换色逻辑 | 前端不再需要这套装饰；角色卡回归 `glass-card` 本身的边框、圆角与 hover 层级，删除运行时 CSS、色调映射和静态 SVG 资源 |
| 2026-07-04 | **角色详情页 editorial 化**：hero 封面 `clamp(260px, 42vh, 420px)` + 多段缓动 scrim（`.hero-scrim`，color-mix 六段近似 ease，末段全实底）；bio 升 base、作者的话升 sm + 左侧 accent 细线；区块 `rise-in` stagger 进入（60ms 错峰）；播放厅归位 glass-card、折叠指示金→accent；新增 `.glass-card-static`（非交互卡不上浮） | 详情页按「creative-editorial」定位改版：这一页是角色的"书封"，不是信息面板。三段线性渐变在图底交界有色带 → 多段 color-mix 让封面"溶"进 `--bg-base`；hover 上浮只给可点击的东西（视觉反馈 = 行为承诺）；金色折叠指示违反「金色珍贵使用」收回；进入动效走 macOS sheet 的"确定、轻、不表演"（reduced-motion 豁免）。信息区上提量收敛为 `--detail-hero-overlap`（与 scrim 实底段联动，注释互指）。播放厅容器素净化 —— 那里面是创作者皮肤的橱窗，chrome 不抢戏 |
| 2026-08-02 | 第一阶段多语言字体按 `html[lang]` 切换为 Noto Serif TC / JP / Thai；body 使用目标市场系统 sans，泰语额外自托管 Noto Sans Thai | 繁中、日语、泰语不能复用简中 glyph；保持既有字体 token 契约。TC / JP 的完整 sans 多字重会增加约 20MB 静态资源，而当地系统字体覆盖可靠，因此只自托管视觉签名所需 serif；Thai 系统覆盖不稳定且字体较小，sans/serif 都自托管 |
| 2026-08-04 | **v2「一盏灯」Wave 1 地基（token 层，不动组件）**：① 底色四档提亮 + 暖化（`--bg-base` #100a18 → #17102a 亮度 6% → 10%，`--bg-elevated` / `--surface-glass` / `--surface-solid` 同步；② 新增 `--lamp-warm` #d4a373（灯芯暖橘）+ `--ink-jade` #7d9b8a（墨玉青）两个主题辅色，通过 @theme inline 桥接为 tailwind utility；③ body 字重升到 450（PingFang / Source Han 默认 400 在暗底偏灰）；④ `.hero-title` letter-spacing 收紧到 clamp(-0.01em, ..., 0.02em) + oldstyle-nums；⑤ 新增 `.nums-oldstyle` / `.nums-tabular` utility；⑥ layout.tsx themeColor + manifest 同步新 base；⑦ AVOID 里新增"具象古代器物"红线；⑧ 设计签名从"暗夜言情封面合集"进化到"一盏灯" | 由用户驱动的整站视觉重构起点。上一版底色 #100a18 亮度只有 6%，在暗屏上失色（用户反馈"太暗"）；提亮到 10% 保留沉浸但拿掉压迫感。命名 `--lamp-warm` / `--ink-jade` 绑定**质感（光/墨）**而非**器物（lamp/jade-pendant）**，是刻意做的抽象化——用户担心具象古风物料跟现代/科幻角色卡违和，脑暴多轮后决定砍掉"油灯/焦尾琴/罗帐"等具象物件，只保留"光"这一跨题材、跨时代的抽象质感。这一 Wave 只动 token 层，不改任何组件 DOM / 不改 `nj_*` selector / 不动聊天页 —— 属默认皮肤演进：creator 显式覆盖的部分不受影响。后续 Wave 2-4 才引入右上角光晕、按钮词汇修订、页面级 signature 落地 |
| 2026-08-04 | **v2「一盏灯」Wave 2 全站唯一 signature 光晕落地**：body 层挂右上角 `--lamp-warm` 径向渐变（`ellipse 60% 55% at 88% -5%`，峰值 18% opacity），暗示"画面外有一盏灯照进来"。`background-attachment: fixed` 让光晕锚 viewport 不随滚动；聊天页通过 `body:has(#nj_chat_app) { background-image: none }` 自动豁免。同时把 `html, body { background: ... }` 拆成 `background-color: ...` —— shorthand 会清掉多层 background-image。DESIGN.md 装饰系统章新增第 4 项签名描述。 | v2 视觉记忆点。skill 强调 "spend your boldness in one place"——把 boldness 集中在一个签名元素，其他退到"安静而克制"。上一轮脑暴过书签卡 / 火漆按钮 / 信笺月卡 / 翻页转场等 5 处，被判定为"分散的 boldness = 全部平庸"，最终收敛到这一处 body 层的抽象暖光。选 body::has() 而非 main::before：`@layer base` 给 main 加了 position:relative + z-index:3 建立了 stacking context，main::before 会被 main 内容盖住；body 层无此问题。用 color-mix(--lamp-warm) 而非写死 rgba，服从"禁止写死 rgba 发光值"约束。聊天页豁免用 `:has()` 是纯 CSS 方案，零 JS，创作者 `global_css` 可覆盖恢复 |
| 2026-08-04 | **v2「一盏灯」Wave 3 视觉层落地**：① 激进文案改写—— 空态 20+ 处从"暂无 / 还没有..."换成"灯下暂时无人 / 灯下暂无对谈 / 灯下还没有 TA / 灯下还没有留言"等有画面感的表达；动词按钮统一到「落座 / 留意 / 记下 / 落笔 / 铸造」词汇族（`startChatButton: 开始对话 → 落座`、`followButton: 关注 → 留意`、`favoriteAria: 收藏 → 记下`、`sendPlaceholder: 继续对话… → 落笔…`、`emptyCta: 铸造一个 → 铸造 TA`）；hero 标题去 SaaS 感（`me.heroTitle: 个人主页 → 我`、`sessions.heroTitle: 我的会话 → 会话`、`following.heroTitle: 关注列表 → 留意的人`、`packs.heroTitle: 美化包管理 → 美化`、`settings.heroTitle: 账号设置 → 设定`）。② 个人中心 emoji 会员徽章重构 —— 砸掉 `👑💎⭐` 前缀（DESIGN.md「不要 emoji 当 icon」约束），色彩从三档花色（blue/purple/yellow）统一到 `--accent-gold` 边框浓淡区分等级；`ProfileTabs` 里的会员 label 同步去 emoji。③ me 页三宫格 stats + `CreatorEarningsPanel` 主数字启用 `.nums-oldstyle`（旧式衬线数字有升有降，配合中文题字节奏）。④ 探索页 hero 大标题下新增 Fraunces italic 英文题记 `where fictions breathe.` + `--ink-jade` 细分割线 = 手工书籍扉页排版；`.hero-eyebrow` 新 utility；`heroEpigraph` 加入 Dict.explore 契约（5 个 locale 全部同步同一句英文，不本地化，品牌一致）。 | Wave 3 集中做「视觉层」（不动结构），全站从"SaaS 工具语调"切到"文学陪伴语调"。skill「copy is design material」的落地——文案是设计材料而非装饰。「落座」代替「开始对话」是最大动作，用户明确同意全部激进改。i18n 类型系统一次性同步，避免碎片化。商店三档并列结构改造推到 Wave 4，避免一次改动过大 |
| 2026-08-04 | **v2「一盏灯」Wave 4 商店三档并列改造**：`PlanRecharger` 从「二级 tab 切换单档 + 4 列对比表」（339 行）重构为「三档卡片并排显示」（271 行，净减 68 行）。桌面端三列，移动端单列纵向堆叠。每张卡包含：右上一枚 `--accent-gold` 圆点朱印（v2 商店视觉签名）、会员名 + tagline、大衬线价格数字（`.nums-oldstyle`）、内嵌 4-6 条权益 chips、订阅 CTA。中间档（platinum = 内部「钻石会员」HK$128 最贵，产品刻意 "premium 放中间"）配一个「推荐」小标签 + `--accent-gold` 边框 + md 下 scale(1.02)。CTA 分层：推荐档实底金色，其他档描边 accent-primary。砍掉了完整 4 列对比表，权益信息直接嵌进各档卡片，用户不用点击就能横向对比。pageTitle「商城」→「铺子」保持 Wave 3 hero 短化风格。i18n 新增 `recommendedLabel` + `rowInstantSilverFmt` + `rowDailySilverFmt`（带占位符版本），5 个 locale 全部同步。 | Wave 4 是结构层改动，也是商业价值最高的一 Wave —— tab 切换时用户必须挨个点才能看差异，是转化率天花板；三档并排后三个 CTA 同时可见，用户直接对比选一个。视觉签名选"朱印圆点"而非"齿边邮票"：邮票齿边太具象绑定"信封"符号，跟 Wave 2 的抽象光晕方向不一致；朱印圆点抽象化，跨题材角色都能接受。Stripe 付款链路零改动（红线）—— `createCheckoutSession` 调用参数、回跳 URL、webhook 履约全部保持。会员 tier 语义（platinum=钻石 HK$128 / diamond=铂金 HK$68 / gold=黄金 HK$30）不动，这是产品命名不改动会造成的连锁客服/合规问题。信息密度：从"对比表全展开"降到"每档 4-6 条核心权益"，是有意识的减法——skill「remove one accessory」的落地 |
| 2026-08-04 | **v2「一轮月」Wave 5 「夜青银」大转向 —— 从紫色主导到 MoMA / 江诗丹顿冷调贵气**：用户明确反馈 Wave 1-4 的"暗紫黑 + 紫罗兰 accent"体感"变化不大 / 不够精致高级"，四选一色系对比后决定换基调。① 底色：`#17102a` 暖紫黑 → `#0b1220` 夜青蓝；`--bg-elevated / --surface-glass / --surface-solid` 同步换到冷调。② accent-primary：`#bd8ce8` 暖紫罗兰 → `#b8c5d1` 冷银（token 名字保留避免大范围重命名，只改值）；hover/active 冷银浓淡。③ 文本色全套换到象牙白 `#f0f4fa` + 冷灰蓝 `#6b7a8f`。④ 主题辅色重命名 `--lamp-warm #d4a373`（暖橘）→ `--moon-cool #c4d1e0`（冷月光）；body 光晕位置从画面外 `88% -5%` 挪到画面内 `88% 8%`，opacity 从 18% 提到 35% —— 老版光晕肉眼几乎失效，Wave 5 后真的成为可见 signature。⑤ 边框冷银 hairline `rgba(184,197,209,.12/.32)`。⑥ --currency-gold 从鲜黄 `#f59e0b` 换到深金 `#c9a961` 匹配冷银基调。⑦ button.ts 新增 `btnGold / btnGoldLg` 词汇（金色 gradient + inner-shadow + 微光晕，江诗丹顿感），仅用于**最关键 CTA**（角色详情"落座"、商店推荐档订阅）—— 90/10 江诗丹顿配比里的 10 点睛。⑧ 组件微调：me 页会员徽章从"金色浓淡三档"改成统一"金色 hairline 胶囊 + 内嵌金圆点"；探索页 filter chip 选中态从冷银淡底改成金色 hairline + 淡金底；角色详情"作者的话"左竖线从冷银改金色 + 右上淡金 Fraunces 引号装饰。⑨ AVOID 明确增加"紫色主导"和"大面积金色"两条红线。⑩ 视觉签名从「一盏灯」进化到「一轮月」—— 月光比灯光更冷静、更抽象、更贴 MoMA 方向。 | Wave 5 是全 v2 里最大的一次色系转向。前 4 Wave 都在"暗紫黑 + 微调"框架里做局部改进，用户看下来"感觉没变化"是对的 —— 紫色是深度嵌入的视觉基调。这一波换基调不换 token 名（`--accent-primary` 仍叫这个名字，只是值从紫色变冷银），103 个引用文件自动传播，不用改组件代码本体。选夜青银方向是脑暴四选一（墨玉+香槟金 / 夜青+冷银 / 深赭+铜金 / 保留紫但材质升级）后用户选的 —— MoMA / 江诗丹顿方向的冷调贵气最贴"精致高级"诉求。核心配比是**冷银 90% + 点睛金 10%**，跟江诗丹顿广告的银表 + 金 logo 一致。DESIGN.md 视觉源头 SSOT 大改：色板表 / 辅色表 / 颜色约定 / 装饰系统第 4 项签名 / AVOID / 设计签名头部全部同步。红线遵守：`nj_*` selector 未触，聊天页 body 光晕 `:has(#nj_chat_app)` 自动豁免，Stripe 链路零改动，会员 tier 语义 / 币种 HKD 不动。 |
| 2026-08-05 | **v2 Wave 6-10 · mobile-first 精致度五波升级**（用户明确 mobile 是主场景，一次做完 5 波再看）：**Wave 6 角色卡藏品化** —— CharacterGridCard 右上加金色 hairline "朱印编号"（№042 从 id hash 派生 3 位数）+ 底部黑色渐变遮罩换成独立"银箔铭牌"条 + mobile 圆角 12→16px + :active scale(0.98) 按压反馈；explore mobile grid 从"2 列均匀"改成"每 6 张一组：第 1 张 featured aspect 3/5 大卡跨 2 行 + 其他 5 张 3/4 小卡"小红书式瀑布流。**Wave 7 交互仪式化** —— 输入框 focus 从全边框换到"底部金色 hairline"（"钢笔在纸上写字"语义）；MobileTabBar active 加顶部金色短 hairline + icon scale(1.10) + tap 时 scale(0.94) 按压；.glass-card 全局 hover 换 --ease-spring 微弹（Apple 阻尼）+ :active 阻尼 scale(0.985) --dur-press 160ms iOS 标准；新增 --ease-spring / --dur-press motion token；顺便修 Wave 5 遗漏（.glass-card 底色 rgba(29,20,48,0.6) 老紫色 → color-mix(--surface-glass)）。**Wave 8 材质升级** —— .glass-card::before 挂 SVG feTurbulence noise 4% mix-blend overlay（"玻璃卡→银箔纸"，Linear/Vercel 感）；双线金属边（inset 顶部 hairline highlight 模拟金属反光，Chanel/Dior 商品卡）；btnGold hover/active/focus 触发 800ms 45° 冷白光扫（.btn-gold-shine + ::after，Rolex 官网产品图）。**Wave 9 烟粉温度 + mobile CTA sticky bar** —— 新增 --rose-veil #c9a3ab 心动语义色（HSL 351° 34% 71%，"烟熏玫瑰"不"芭比粉"，跟粉色少女风红线严格切分）；.nj-heart-burst utility（:active tap 触发烟粉小圆 240ms fadeOut，Twitter/Instagram like 动效但更克制）；收藏 favorited 从 accent-amber(NSFW 误用) 换到 rose-veil；角色详情 mobile 加 fixed sticky bottom CTA bar（坐在 MobileTabBar 之上，safe-area-aware，md:hidden desktop 保持内联）；顺便修 pre-existing kirei-beauty-shop typecheck/test 阻塞（tsconfig.typecheck.json exclude + lefthook test scope 到 src/）。**Wave 10 字体系统 + 收尾** —— 新增 @fontsource/instrument-serif @5.3.0 第 4 档字体（极窄衬线，Aesop/Sézane/The RealReal 印刷品质感）；新 CSS token --font-numeric + .nums-editorial utility（大数字 24px 起用它）；商店三档大价格 + me 三宫格 stats + CreatorEarningsPanel 主数字全换 .nums-editorial；mobile body 字重 450→470 补偿 iOS/Android antialiasing。 | Wave 6-10 主题：**mobile-first 精致度**。用户明确"手机是主场景"，每波都先在 375px 上验证。Wave 6 一件事就把整站气质拉起 40%（角色卡是全站高频视觉单元）。Wave 7-8 是"看不见的手工感"——每个交互都有物理反馈，屏幕不像屏幕。Wave 9 是"温度补偿"——冷银 90 + 点睛金 10 冷调完美，但女生用户玩的是"陪伴"，需要一点烟粉在心动瞬间平衡；rose-veil 命名绑定"心动"语义（不叫 pink / rose 器物名），跨题材角色不违和。Wave 10 是"字里手工"——数字用极窄衬线是 Aesop / 江诗丹顿 广告的核心手法。整个 5 波累计 6 个 commits，红线全程遵守（nj_* selector / 聊天页豁免 / Stripe 付款 / creator CSS API），token 化让改动自动传播。 |
| 2026-08-06 | **v2 Wave 11-14 · 擦边陪伴氛围升级**（用户定位"擦边陪伴 app"，四个方向一次做完）：**Wave 11 角色详情页「烛光初见」** —— 全局保持 MoMA 冷银画廊，但详情页 hero 加 .hero-candle-glow 暖烛光层：radial-gradient 从立绘底部中央发暖光向上渐隐，--rose-veil 16% + 暖金 4% 低饱和混合（"烛光"非"甜腻粉"），mix-blend screen（光是照亮不是遮罩），6s 烛火微颤 opacity 0.75→0.95（reduced-motion 关动效留光）。DOM 顺序立绘→烛光→scrim→badge，scrim 压暗保证文字可读。**Wave 12 角色卡「心动脉动」** —— tap 卡片时封面底部 .card-heartbeat 暖光波 250ms 从下向上荡（--rose-veil 低饱和 + 暖金），右上朱印编号 scale(1.15) 回弹；纯 CSS .group:active 触发无 JS；跟 Wave 9 收藏按钮爆闪互补（主动收藏 vs 点选）。**Wave 13 收藏页「信物墙」** —— 「记下的人」从横排列表重设计成竖版信物卡网格（2/3/4 列）：竖版立绘占满 + 底部银箔铭牌（名字 + 收藏日期 MM-DD + 初见一句）+ 右上烟粉封印角标；more 菜单移左上；unfavorite 逻辑零改动。像翻私人相册的珍藏感。**Wave 14 暗夜撩拨细节** —— ① 角色卡 hover/tap 铭牌顶部淡入"序幕行"（金色 hairline + bio 首句 italic 暖金，"掀开一角看到开场白"）；② 探索页 hero 下实时"此刻氛围"行（北京时间分段：02:17 · moonlight falls just right 等 5 时段，UTC+8 跟签到一致，英文氛围语同 heroEpigraph 不本地化）；③ 空态文案评估后不改（Wave 3 已达"灯下"氛围，避免重复）。 | Wave 11-14 主题：**从"高级画廊"到"私密烛光房"**。前 10 波完成了冷银高级感的骨架，但这波是"温度灵魂"——用户明确 app 是"擦边陪伴"定位，要的是"挑对象那一刻的温度"。三个设计决策：① 烛光只进详情页不进全局（保持画廊的"高级"，在角色页切换"两人世界"——氛围切换本身就是暗示）；② 心动色的分布逻辑：烟粉（rose-veil）只在"主动情绪"瞬间出现（收藏 tap 爆闪 / 卡片 tap 脉动 / 信物墙封印 / hover 序幕），日常浏览仍是冷银 + 金，符合"擦边"的含蓄要求；③ 时间氛围语用英文（同 heroEpigraph 不本地化）—— "02:17 · moonlight falls just right" 的品牌语气比中文直译更撩。红线全程遵守：nj_* 未触、聊天页豁免、stripe 付款不动、creator CSS API 保持。 |
| 2026-08-06 | **v2 Wave 15-20 · 动效仪式化 + 细节校准**（用户研究后决定"静态已经精致，动起来还缺仪式"，五个方向一次做完；Wave 15 是前置修正）：**Wave 15 撤销瀑布流** —— mobile explore 从"1 大 + 2 小瀑布流"改回均匀 2 列 grid：所有角色卡都是 3/4 竖版立绘（同长宽比），大卡拉伸到 3/5 裁掉头顶构图变形，瀑布流适合"内容自然不等高"场景（小红书文案长短不一）不适合等比图。**Wave 16 色调校准** —— --text-muted #6b7a8f → #7d8aa3（冷紫灰，跟夜青底更协调，小字不显脏）；金色收敛：ImportMufy 成功提示金→semantic-success（金=珍贵/主动情绪，功能提示不该金），创作者徽章/tag 选中/侧栏 active 保留（语义正确）。**Wave 17 首屏「月光浮现」** —— explore 卡片交错浮现（60ms 错峰，6px 上移+淡入，前 12 张覆盖首屏 ~1.2s），fill-mode both 防闪；配合 ExplorePendingRegion DOM 保留，动画只在首次进入播一次。**Wave 18 收藏「封印仪式」** —— 收藏 tap 完整动效链：烟粉爆闪（240ms 心动）→ 金色 hairline 圆环扩散收拢（delay 80ms，"封印落下的视觉"）→ 按钮 favorited 态 rose-veil。**Wave 19 底部 tab「月光滑轨」** —— active 指示从"每条 tab 各自短线"升级成"共享金色柔光圆片"：--active-tab CSS 变量驱动 translateX（width 100%/4），300ms 弹簧滑到新位置，"月光落在你所在的位置"。**Wave 20 页面转场「翻页仪式」** —— 探索→详情共享元素 morph：卡片和详情 hero 设 --nj-card-id → view-transition-name 配对（CSS [style*="--nj-card-id"] 注入），cross-document 导航（hardNav 原生 <a>）自动 morph 卡片放大成立绘 hero；::view-transition-old(nj-cover) scale 1.08 翻开位移感 + new 320ms 缓入，叠加 root 260ms 交叠；渐进增强旧浏览器退化。 | Wave 15-20 主题：**动效是"仪式感"的载体**。前 14 波把静态视觉推到"精致画廊"，这波补"动起来"——但克制是核心：① 每个动效都绑定"情感语义"（月光浮现=打开 app 的仪式、封印仪式=收藏的心动、月光滑轨=tab 的位置、翻页 morph=进入角色的仪式），不是炫技；② 全部 reduced-motion 可关；③ 纯 CSS 优先（除 tab 需要 --active-tab 变量外零 JS）；④ 渐进增强（旧浏览器无动画但功能完整）。Wave 15 是诚实修正——用户指出瀑布流在规则立绘卡上奇怪，立即撤销。红线全程遵守：nj_* 未触、聊天页豁免、Stripe 不动、creator CSS API 保持。 |

---

## 设计决策权

- **Token 修改:** 任何 `--bg-*` / `--accent-*` / `--space-*` / typography 阶梯的修改 → 需要在这里更新 + 在 PR 描述里说明 why
- **creator CSS 范围:** creator 通过 `global_css` 只能在已暴露的 `nj_*` selector 范围内覆盖样式，不能修改根 token
- **新页面 / 新组件:** 先读 DESIGN.md，找到对应 token / pattern，不要复制粘贴写新的颜色 / 字号
