# 聊天渲染契约（Chat Render Spec）

**状态：** v1 草案 · 待迭代
**最后更新：** 2026/05/21
**关联设计：** [`DESIGN.md`](../../DESIGN.md)
**关联规划：** [`docs/exec-plans/completed/v1-foundation.md`](../exec-plans/completed/v1-foundation.md) 模块 4-5

---

## 0. 为什么需要这份契约

之前 Dearm 的聊天页是「单种气泡 + markdown」的 IM 渲染。但用户行为已经显示：玩家不是来"聊天"，是来"看戏"。同样的对话内容，**有没有把场景、叙述、内心、台词分开渲染**，体验差一个数量级。

竞品的实现思路给了我们答案 —— 把聊天页拆成 **4 层**，每层有不同的可变性。这份契约固定下来。

> 关键洞察：竞品整套体验里，**布局骨架 / 标签路由 / selector 公约是 host 共性**，所有视觉冲击全是 **creator 通过 CSS 注入与 iframe 实现的**。Dearm 要复刻的是这个**分层架构**，不是某张卡的具体视觉。

---

## 1. 四层架构总览

```
                         ▲ 灵活度
                         │
Layer D · 用户偏好        │      跨角色，由 user 控制
─ NSFW toggle / 字号       │      （e.g. "我不看 NSFW"）
─ 调试模式 / 规则开关       │
                         │
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─
                         │
Layer C · Creator UGC     │      每张卡可变，由 creator 控制
─ <style> CSS 注入         │      （e.g. "黑金老钱风"）
─ artifact iframe 内容     │
─ 自定义 class             │
                         │
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─
                         │
Layer B · Host 默认皮肤    │      所有卡共享，host 提供初始值
─ 颜色 / 渐变 / 圆角         │      （Dearm 暗紫黑同源色系）
─ 字体 / 间距 / 装饰         │
                         │
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─
                         │
Layer A · Host 共性骨架    │      不变契约，所有卡完全一致
─ 三栏布局                 │      （e.g. <narration> 必走 Narration 组件）
─ 标签 → 组件路由           │
─ nj_* selector 公约       │
─ z-index 层叠顺序          │
                         ▼
                       固定度
```

**判断哪一层的简单测试：**
- 改了它会让**别的卡也变样** → Layer A 或 B
- 改了它**只这张卡变** → Layer C
- 改了它**只这个用户看到的所有卡变** → Layer D

---

## 2. Layer A — Host 共性骨架（不可改）

### 2.1 三栏布局

```
viewport
├─ 76px  left rail        [v1 可选先做窄轨 nav]
├─ 内容主舞台              flex-1
│   width = min(640px, calc(100% - 32px))
│   居中 (mx-auto)
└─ 280px right sidebar    [v1 砍掉，v2 再加]
```

- 主舞台宽度恒定 **640px**（移动端 fluid）
- chat header **64px** 高度
- 输入区 padding `var(--space-md)`，固定贴底

> **为什么 640px？** 竞品验证过 —— 这是中文 14px 字号下「单行 25-28 字」的舒适阅读宽度，对应小说排版传统。继续抄。

### 2.2 舞台双层（必然存在）

```html
<div class="nj-stage" style="position: relative">
  <!-- 立绘层 -->
  <div
    id="nj_background_image"
    style="
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      height: 100%;
      width: min(640px, 100%);
      background: center top / cover no-repeat url(--character-bg);
      -webkit-mask-image: linear-gradient(to right, transparent, black 100px, black calc(100% - 100px), transparent);
              mask-image: linear-gradient(to right, transparent, black 100px, black calc(100% - 100px), transparent);
    "
  />
  <!-- 蒙层 -->
  <div
    id="nj_background_overlay"
    style="
      position: absolute;
      inset: 0;
      z-index: 10;
      background: rgba(14, 10, 26, 0.6);  /* --bg-base @ 60% */
      pointer-events: none;
    "
  />
  <!-- 内容 -->
  <div class="nj-stage-content" style="position: relative; z-index: 20;">
    <header id="nj_chat_header" />
    <div class="nj-message-scroll" />
    <footer id="nj_chat_input_container" />
  </div>
</div>
```

**host 永远保证：**
- 两个 div 永远存在（即使角色没设立绘，bg-image 为空也保留 div）
- 立绘宽度 = 主舞台宽度 = 输入框宽度（三者完美对齐）
- mask 渐变带固定 100px
- overlay 永远在立绘上方
- 内容永远在 overlay 上方

### 2.3 标签 → 组件路由（输入合约）

LLM 必须输出**半结构化标签**，host 用自定义 react-markdown components 路由。

| 标签 | 渲染组件 | 用途 | 视觉差异化维度 |
|------|---------|------|--------------|
| `<message>` | `<AIBubble />` | AI 角色（{{char}}）台词 | 透明 / 正排 / 左对齐 / 角色头像 |
| `<user>` | `<UserBubbleFromTag />` | **玩家（{{user}}）台词**（嵌在 assistant 消息体内） | accent-primary 实底 / 右对齐 / 玩家头像 |
| `<narration>` | `<Narration />` | 第三人称叙述：动作、表情、环境 | 无气泡 / 斜体 / muted 色 / 左对齐 |
| `<system>` | `<SystemCapsule />` | "画外音"：时间、地点、天气、场景切换 | 居中胶囊 / 玻璃 / 弱化字号 |
| `<think>` | `<ThinkBlock />` | {{char}} 第一人称内心独白 | 无气泡 / 斜体 muted / 点击折叠 |
| `<scenario>` | `<PassThrough />` | 给 creator CSS 钩子的容器 | 无视觉，仅挂 className |
| `<artifact>` | `<ArtifactIframe />` | 富交互 HTML（小手机、卡牌、地图） | iframe sandbox |
| `**xxx**` (inline) | `<Emphasis />` | 强调短语 | 加粗，沿用正排色 |
| (未标记纯文本) | `<AIBubble />` | fallback | 同 `<message>` |

**别名（host 同时识别）：** `<mes>` = `<message>`，`<usr>` = `<user>`，`<nar>` = `<narration>`，`<sys>` = `<system>`，`<sce>` = `<scenario>`

**决议：** v1 只支持英文标签，不开放中文别名（避免 LLM 在两套之间漂移，prompt 模板更简单）。

**`<user>` 标签的设计意图（2026-06-21 引入）：**
- 解决场景：作者写开场白时需要预设玩家的某句话（典型："项链很好看，谢谢老公。"这种已经发生的玩家反应作为情节起点）。旧契约只有 `<message>`，作者只能塞进 `<message>` —— 渲染时被当成角色发言，玩家头像和台词错位。
- 兜底场景：LLM 偶尔会"代入"地说一句玩家视角话；如果它学会用 `<user>` 包，host 路由到 UserBubbleFromTag，不会让玩家头像挂到角色气泡上。
- 区别于 messages 表 role=user 的整条消息：本标签处理 **assistant 消息体内嵌的玩家台词段**；前者由 `MessageBubble`（外层）画，后者由 `UserBubbleFromTag`（react-markdown 路由出来的内嵌组件）画。**两者共用 `.nj_user_message_bubble` class**，默认皮肤一致。
- 滥用风险：见 §11.3 Dearm output protocol —— `<user>` 只能逐字引用玩家已经说过的话，不得替玩家发明新言行。

### 2.4 组件骨架 className（host 永远挂，creator 可重绘但不能移除）

| 组件 | 骨架 className | 必须包含的视觉属性 |
|------|---------------|------------------|
| `AIBubble` | `nj_ai_message_bubble` | `display: inline-block`、`max-width: 80%`、`background: transparent`、`border: none`（v1 默认皮肤；creator 可恢复气泡） |
| `UserBubble`（外层 role=user 消息） | `nj_user_message_bubble` | `display: inline-block`、`max-width: 80%`、`border-radius: var(--radius-lg)` + `<pre>` 标签保留换行 |
| `UserBubbleFromTag`（内嵌 `<user>` 段） | `nj_user_message_bubble` | 与外层 UserBubble 共用 class，默认皮肤一致 |
| `Narration` | `nj_message_narration` | `color: var(--text-muted)`（无斜体，06-21 决议） |
| `SystemCapsule` | `nj_message_system` | `text-align: center`、`max-width: 440px`、`margin: auto` |
| `ThinkBlock` | `nj_message_think` | `display: block`、`width: 100%` |
| `Emphasis` (inline) | `nj_emphasis_text` | `display: inline`、`font-weight: 700` |
| `Scenario` | `nj_scenario_section` | 仅作 className 钩子，无默认视觉 |
| `ArtifactIframe` | `nj_artifact_iframe` | `sandbox="allow-scripts"`、`srcdoc` 注入 |

### 2.5 容器排版（每条消息的 wrapper）

```css
.nj-message-wrapper {
  display: flex;
  align-items: flex-start;
  padding: var(--space-sm) var(--space-md);   /* y:8 x:16 */
}
@media (min-width: 768px) {
  .nj-message-wrapper { padding-inline: var(--space-lg); }  /* md: x:24 */
}
```

**头像规则：**
- AI 头像 36px 圆形，绝对定位在气泡**左外侧**（`left: -52px`）
- User 头像 36px 圆形，绝对定位在气泡**右外侧**

### 2.6 nj_* selector 公约（开放给 creator 注入）

**结构 ID（必有）：**
```
#nj_chat_app                外层最大容器
#nj_chat_header             顶部 64px 条
#nj_back_button             返回按钮
#nj_header_follow_btn       关注
#nj_header_message_btn      私信
#nj_header_more_btn         更多菜单
#nj_header_clarity_btn      调试模式 toggle（仅 owner 可见）

#nj_background_image        立绘 div
#nj_background_overlay      蒙层 div

> 立绘默认皮肤（2026-07-04 起）：`#nj_background_image` 带 26s 的缓慢
> scale 呼吸动效（`nj-stage-breathe`，@layer nj-skin）。creator 想让
> 立绘完全静止或换自己的动效，一行未分层规则即可稳赢：
> `#nj_background_image { animation: none; }`。
> reduced-motion 用户侧自动关闭。

#nj_author_note             作者插话（开场白）
#nj_chat_input_container    输入区 wrapper
#nj_chat_input_box          输入框 textarea wrapper
#nj_chat_input_replay_btn   重说按钮
#nj_chat_input_model_btn    模型选择按钮

#nj_message_actions_box     消息悬浮操作容器
#nj_message_actions_btn     单条操作按钮
#nj_message_actions_delete  删除
#nj_message_actions_edit    编辑
#nj_message_actions_copy    复制
#nj_message_actions_continue 继续生成
```

**消息分型 class（按消息渲染）：**
```
.nj_ai_message_bubble
.nj_user_message_bubble
.nj_message_narration
.nj_message_system
.nj_message_think
.nj_scenario_section
.nj_emphasis_text
.nj_code_block
.nj_artifact_iframe
```

**命名规则：** `nj_<area>_<element>[_<subelement>]`，全小写下划线分隔。**一旦发布即 API**，破坏性改动需走 deprecation。

> 完整字典（含"已挂 ✅ / 计划挂 🚧 / 模板私有 📦"状态）见 [`nj-selectors.md`](./nj-selectors.md)。本节列的是契约级最小集，字典是可执行实情。

### 2.7 z-index 层叠顺序（不可改）

```
z-index: 10  → nj_background_overlay
z-index: 20+ → 消息列、header、input
z-index: 40  → header 内交互元素（避免被消息遮挡）
z-index: 100+ → 悬浮操作菜单、模态框
```

---

## 3. Layer B — Host 默认皮肤（可被 UGC 覆盖）

**核心原则（2026-06-21 确立）：默认皮肤追求"读小说"叙事感，角色化修饰留给 creator。**

> ⚠️ 单一真相：默认皮肤的实现在 `src/app/globals.css`（Layer B 区块）。本节 CSS 快照
> 2026-07-04 已与实现校平；两处再冲突时**以 globals.css 为准**并回来更新这里。
>
> **层叠模型（2026-07-04 起）**：Layer B 全部包在 `@layer nj-skin` 里（层序在
> tailwind utilities 之后）。creator 的 `global_css` 是未分层规则 —— **无需
> `!important`、无需比拼 specificity，结构性稳赢默认皮肤**；平台自己的
> Tailwind utility 则输给 nj-skin（与旧的未分层行为一致，无观感变化）。
> 层叠序：creator（未分层）> nj-skin > utilities。

- 默认状态：不做过多角色化装饰 —— 没有 background-clip 彩字、没有 message 气泡、没有装饰边框、没有特殊字重。AI message + narration + emphasis 都走"裸"配置，让消息流读起来像一段连续小说叙事而不是一个个 IM 气泡。
- 角色化定制（字体 / 配色 / 气泡 / 边框 / 渐变 / 手写体等）由 creator 通过 `global_css` 在 `nj_*` selector 上加，**不是默认皮肤该做的事**。
- 唯一例外：`<UserBubble>` 仍保留 accent-primary 实底 —— 用户消息是"自我表达点"，跨角色 / 跨皮肤都要醒目。
- token 来自 `DESIGN.md`，不写死 hex。
- 任何想给默认皮肤补"角色感"的提案先回到这条原则：那是 creator CSS 的工作。



### 3.1 AI 消息（nj_ai_message_bubble）

```css
.nj_ai_message_bubble {
  display: inline-block;
  align-self: flex-start;      /* flex row 里退回按内容收缩 */
  width: fit-content;
  max-width: 100%;             /* md+ 由 @media 收到 80% */
  padding: var(--space-xs) var(--space-md);
  border-radius: 0;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: var(--font-body-zh);
  line-height: 1.5;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
```

设计意图（v1，2026-06-21 修订）：**透明、无气泡**，让 message 在视觉上与 narration 同一阅读层 —— 整段消息流读起来像小说连续叙事，而不是被切成一条条 IM。气泡感保留在 `<UserBubble>`（用户自我表达点）。class 名 `nj_ai_message_bubble` 因 selector 契约不可改，仅去掉视觉装饰；creator 可在 `global_css` 里恢复气泡（重新挂 `background` / `border` / `border-radius`）。

### 3.2 用户气泡（nj_user_message_bubble）

```css
.nj_user_message_bubble {
  /* 实际元素是 div/span（不是 <pre>）；white-space: pre-wrap 负责保留换行 */
  display: inline-block;
  max-width: 100%;             /* md+ 收到 80%，手机收到 88% */
  min-width: fit-content;      /* 防 Chromium 中文单字竖排坍缩，不能删 */
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--accent-primary);  /* 紫色实底 */
  color: var(--text-on-accent);
  font-family: var(--font-body-zh);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
```

设计意图：用户消息**用主色实底**，让自己说的话最醒目。

### 3.3 叙述（nj_message_narration）

```css
.nj_message_narration {
  display: block;
  max-width: 100%;             /* md+ 由 @media 收到 80% */
  font-family: var(--font-body-zh);
  font-weight: 400;            /* 无 italic —— 跟 06-21「裸配置」决议一致 */
  line-height: 1.7;
  color: var(--text-muted);
  padding-block: var(--space-2xs);
}
```

设计意图（v1，2026-06-21 修订）：完全无气泡，muted 色把叙述跟 message 区分开，但不抢戏（无斜体 —— 中文斜体是伪斜切，可读性差）。**原"紫 → 暖白 → 金"三色 background-clip 渐变已废弃** —— 长段落里彩字读起来反而违和，跟"夜读小说"的连续叙事感冲突。creator 可在 `global_css` 恢复渐变（`background-image` + `background-clip: text` + `-webkit-text-fill-color: transparent`）。

### 3.4 系统/场景（nj_message_system）

```css
.nj_message_system {
  display: block;
  margin: var(--space-md) auto;
  padding: var(--space-sm) var(--space-md);
  width: min(440px, 100%);
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--bg-base), transparent 40%);  /* bg-base @ 60% */
  backdrop-filter: blur(8px);
  text-align: center;
  font-family: var(--font-body-zh);
  font-size: var(--text-sm);
  color: var(--text-muted);
  border: 1px solid color-mix(in oklch, var(--accent-gold), transparent 80%);  /* 极淡金边 */
}
```

设计意图：玻璃质感，金色极淡边（呼应签名装饰，但不抢戏）。

### 3.5 内心（nj_message_think）

```css
.nj_message_think {
  display: block;
  margin-block: 0;
  padding: var(--space-sm) var(--space-md);
  border-radius: 0;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-body-zh);
  line-height: 1.7;
  cursor: pointer;
  transition: opacity var(--dur-short) var(--ease-move);
}
.nj_message_think[data-collapsed="true"] { opacity: 0.6; }
```

设计意图（v1，2026-06-28 修订）：无气泡、无装饰边、无外边距，muted 色 + 横向缩进把内心独白跟叙述区分开但不打断。**横向 padding 取 `--space-md`（同 `.nj_ai_message_bubble`）** —— 无框时表现为轻微缩进（贴近同类平台的内心独白排版，不再跟 narration 齐头）；一旦 creator 或外部导入的 `global_css` 给 think 块加 `background` / `border` 做成气泡，加粗文字就有呼吸位、不贴边。**原"玻璃底 + 紫色 border-left + margin"装饰仍废弃** —— 避免每跳一个 `<think>` 都把消息流切成块。展开/折叠仍由用户点击。creator 可在 `global_css` 恢复气泡感（`background` / `border-left` / `margin-block`）。

> 历史（2026-06-21 → 06-28）：曾把 padding 设为 `var(--space-2xs) 0`（横向 0）追求跟 narration 同一阅读层。但外部导入的卡只携带 creator 的 `border`/`background` 覆盖、依赖来源平台默认底座自带的 padding，搬到本平台后 think 底座横向 padding 为 0 → 加框即贴边。改回有横向 padding 后，原生/studio/import 三类卡一次性都不贴边。

### 3.6 强调（nj_emphasis_text，inline）

```css
.nj_emphasis_text {
  display: inline;
  font-weight: 700;
  color: var(--text-primary);
}
```

设计意图（v1，2026-06-21 修订）：仅用字重强调，不变色。**原 "fuchsia → 金 → 紫" 三段 inline 渐变已废弃** —— 跟 narration 的渐变一起去掉，避免一段叙述里同时有两套彩字读起来视觉混乱。creator 可在 `global_css` 里恢复 background-clip 渐变。

### 3.7 代码块（nj_code_block）

```css
.nj_code_block {
  display: block;
  margin: var(--space-md) 0;
  padding: var(--space-md);
  width: min(400px, 100%);
  border-radius: var(--radius-lg);
  background: var(--bg-base);
  border: 1px solid var(--accent-primary);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  overflow-x: auto;
}
```

### 3.8 关于"语言-标记的 code 块自动升级到 artifact"

跟同类平台一致：```html / ```svg / ```mermaid / ```markmap 自动渲染为 `<ArtifactIframe />`。其他语言走 `<nj_code_block>` 普通展示。

---

## 4. Layer C — Creator UGC（v1 拉满）

### 4.1 能做的（5 类）

#### C1 — globalCss 注入（Dearm 工程模型）

> **跟竞品不同：** 竞品让 creator 在 greeting / 角色字段里嵌 `<style>...</style>`，由 LLM 把它带到聊天页 markdown 输出。Dearm 走结构化路径，**不依赖 LLM 配合，不让 creator 注入物 LLM 输出污染。**

**工程模型：**

```
pack 数据保存:
  beautificationPacks.globalCss = ".nj_ai_message_bubble { ... }"

chat 页 SSR 时，host 收集订阅的 pack:
  collectGlobalCss(characterId) → string[]

host 在 <head> 注入:
  <style data-pack-id="${pack.id}">${pack.globalCss}</style>

每条 pack 独立，可去重、可禁用、可监管
```

- creator 在 pack studio 的 CSS tab 编辑 `pack.globalCss` 字段（不通过 markdown / LLM 路径）
- chat 页 SSR 时，host 按角色订阅顺序收集所有订阅 pack 的 globalCss，按 pack.id 去重，作为多个独立 `<style data-pack-id>` 注入 `<head>`
- 每条 globalCss 的 selector 由 `sanitizeAndScopeCss` 自动加上 `[data-character-css="<charId>"]` 前缀，跨角色样式不互染（实现见 `src/lib/styling/whitelist.ts`，测试断言见 `src/lib/__tests__/styling.test.ts`）
- DOMPurify 不参与 —— globalCss 是 trusted creator input，不是 LLM 输出

**作用域：** 限定到当前角色的 `[data-character-css="<charId>"]` scope，不会泄漏到其他角色。
**沙箱：** 选择器 / 属性白名单 + scope 前缀（详见 `src/lib/styling/whitelist.ts`），不允许 `body / html / :root / *` 等通用 selector、不允许 `position: fixed/sticky / pointer-events / cursor: none / z-index > 100 / @import`。
**优先级：** 通过 `!important` 可压过 host 默认皮肤（Layer B）。

允许做的事：
- 覆盖任何 `nj_*` 元素的视觉
- 覆盖 `#nj_background_image` 的图片 URL
- 替换图标（`background-image: url(...)` + 隐藏 svg）
- 隐藏特定按钮 / 元素（`display: none`）
- 创造自定义短 class 给 regex `replacement-html` 用（如 `.a` `.b`，仍然会被 scope 前缀套住）

#### C2 — `<artifact>` iframe 注入

```html
<artifact>
```html
<!DOCTYPE html>
<html>
<head><style>/* full document CSS */</style></head>
<body>
  <!-- arbitrary HTML + JS -->
</body>
</html>
```
</artifact>
```

**沙箱：** `<iframe sandbox="allow-scripts" srcdoc="...">`，禁用 `allow-same-origin` 防止逃出。
**通信：** 子 iframe 通过 `postMessage` 跟 host 通信，host 暴露受限 API（见 v1-foundation 模块 4）。
**自动调整：** iframe 高度通过 ResizeObserver 自动撑开。

#### C3 — 自定义 class

creator 在 `<style>` 里定义任意 class，然后在角色的输出/regex 里使用。host 不限制 className 命名（除了禁用 nj_ 前缀创建新 class 防止冲突）。

#### C4 — regex 替换（独立机制）

详见 v1-foundation 模块 4：`regex_rules` 表 + auto-routing（替换内容整体被 `<artifact>...</artifact>` 包裹 → sandbox iframe 路径；否则 → MessageRenderer markdown 路径）。runtime 字段已删除（PR-S-2），路由由 host 按内容自动判定。和 C1/C2 配合。

#### C5 — 隐藏 host 元素

```css
#nj_header_follow_btn { display: none; }
#nj_chat_input_replay_btn { display: none; }
```

### 4.2 不能做的（host 保护）

```
❌ 改 DOM 结构 / 嵌套 / 顺序 / 节点数量
❌ 修改 nj_* 元素的 ID（只能改样式）
❌ 改三栏宽度 / 内容列宽度 / 立绘 mask 100px
❌ 改标签 → 组件路由（<narration> 永远走 Narration）
❌ 改 z-index 层叠（overlay 必在立绘上方）
❌ 在 chat host 中执行 JS（仅 iframe 内）
❌ 修改 user 端隐私（NSFW toggle 状态、debug toggle）
```

### 4.3 conflict 解决（多 creator 注入互相打架）

竞品当前没解决，靠 `!important` 越叠越深。Dearm 决策：

- v1：**单一来源**。每张卡的 creator 注入合并成一段 `<style>`，按"角色设定 → greeting → regex 序列"顺序拼接。
- v2 再考虑：每段注入加 scope（`@scope (#message-id-xxx)`），互不影响。

---

## 5. Layer D — User 偏好

跨角色生效，user 自己控制：

```
- NSFW 显示 toggle               (探索页顶部)
- 调试模式 toggle                 (仅卡 owner 可见, 在 chat header)
- 单条 visible regex 规则开关     (chat 设置面板, user_regex_preferences 表)
- 字号偏好                       (v2)
- 行距偏好                       (v2)
- prefers-reduced-motion         (操作系统级，host 尊重)
```

详见 v1-foundation 模块 8（调试模式）和模块 4.4（user 端 regex 开关）。

---

## 6. LLM 输出协议（让模型按标签输出）

### 6.1 system prompt 模板片段

```
你扮演的是一个故事中的角色。你的每次回复必须由以下标签组成，让玩家清楚地区分"谁在说话 / 这是真发生还是叙述者描述 / 现在是哪个场景"：

<message>角色的台词，带引号或叙述性的"说"。</message>
<narration>第三人称叙述：动作、表情、环境、肢体细节。</narration>
<system>场景信息：时间、地点、天气、场景切换标记。</system>
<think>角色的内心独白（仅在角色"想"什么时使用，不是叙述）。</think>

在以上标签内你可以使用 **粗体** 表示强调。

格式要求：
- 标签必须正确闭合
- 不要在标签之外写散文（散文会被默认归到 <message>）
- 一次回复可以包含多个标签，顺序自由
- 不要解释你在用标签，玩家看到的只是渲染结果

示例：
<system>22:14 · 雨夜 · 出租屋阳台</system>
<narration>他点着第三根烟，看着楼下的车流。</narration>
<message>"还醒着？"</message>
<think>她不会真的等到这个时间还没睡吧。</think>
```

### 6.2 fallback / 容错

- 未闭合标签：host 自动闭合到段落末
- 未知标签（`<scenario>`/`<sce>` 之外）：当作 `<message>` 渲染
- 完全无标签：整段当 `<message>` 渲染
- 标签嵌套：仅允许 `<message>` / `<narration>` 内嵌 `**emphasis**`，其他嵌套被扁平化

### 6.3 调试模式下显示

owner 在调试模式打开时，每条消息下方折叠面板里可以看：
- LLM 原始输出（含标签）
- 渲染后的 HTML
- 标签解析的中间结构

详见 v1-foundation 模块 8。

---

## 7. 两个范例卡的对比（host 不变，UGC 千变）

### 7.1 范例 A — Dearm 纯 host 默认（vanilla）

```
LLM 输出:
─────────────────────────────────────────
<system>15:00 · 客厅</system>
<narration>她推开门，光线斜斜地落进来。</narration>
<message>"你回来了。"</message>
<message>"嗯。"</message>
<narration>他把外套挂上玄关。</narration>
<think>她今天好像有什么话要说。</think>
─────────────────────────────────────────

渲染结果（Layer A+B，无 UGC）:

[ ━━━━━ 立绘 + bg-black/60 蒙层 ━━━━━ ]
                                          
       ┌─────────────────────┐
       │ 15:00 · 客厅          │  ← 玻璃胶囊，金色细边
       └─────────────────────┘
                                          
       她推开门，光线斜斜地落进来。      ← 斜体 muted 浮字，无气泡

         "你回来了。"                    ← 无气泡，正排白字

         "嗯。"

       他把外套挂上玄关。              ← 斜体 muted 浮字，无气泡
                                          
       ╎ 她今天好像有什么话要说。      ← 左紫线 think 块, 半透明
```

### 7.2 范例 B — UGC「黑金老钱风」（基于上面同一个 LLM 输出）

```
creator 注入:
─────────────────────────────────────────
<style>
@import url('https://fonts.googleapis.com/css2?family=Pinyon+Script');

#nj_background_image {
  background-image: url('https://creator.cdn/black-gold-bg.jpg') !important;
  filter: brightness(0.7);
}

#nj_background_overlay {
  background: linear-gradient(180deg, rgba(0,0,0,0.7), rgba(20,15,0,0.4)) !important;
}

.nj_ai_message_bubble {
  background: linear-gradient(145deg, #1f1f1f, #0a0a0a) !important;
  border: 1px solid #d4a84d !important;  /* 烫金边 */
  box-shadow: 0 4px 20px rgba(212, 168, 77, 0.15) !important;
  color: #e8c97a !important;
  font-family: 'Pinyon Script', serif !important;
}

.nj_message_narration {
  background-image: none !important;
  -webkit-text-fill-color: #c5a059 !important;
  color: #c5a059 !important;
  font-family: 'Noto Serif SC', serif !important;
}

.nj_message_system {
  background: transparent !important;
  border: none !important;
  border-top: 1px solid rgba(197, 160, 89, 0.3) !important;
  border-bottom: 1px solid rgba(197, 160, 89, 0.3) !important;
  border-radius: 0 !important;
  color: #c5a059 !important;
}

#nj_chat_input_box {
  background: linear-gradient(145deg, #1f1f1f, #0a0a0a) !important;
  border: 1px solid #d4a84d !important;
}
</style>
─────────────────────────────────────────

渲染结果（Layer A+B+C）:

[ ━━━━━ 黑金主题立绘 + 暖色渐变蒙层 ━━━━━ ]
                                          
       ╴╴╴╴ 15:00 · 客厅 ╴╴╴╴            ← 信纸分割线风
                                          
       她推开门，光线斜斜地落进来。      ← 老钱金色 Noto Serif SC
                                          
       ┏━━━━━━━━━━━━━━━━━━━━━┓
       ┃ "你回来了。"             ┃     ← 黑金渐变 + 烫金边 + 手写体
       ┗━━━━━━━━━━━━━━━━━━━━━┛
                                          
       (其余同上)
```

**关键对比：**

| 维度 | 范例 A (vanilla) | 范例 B (UGC 黑金) |
|------|----------------|------------------|
| DOM 结构 | ✅ 完全一样 | ✅ 完全一样 |
| 标签路由 | ✅ 完全一样 | ✅ 完全一样 |
| nj_* selector | ✅ 完全一样 | ✅ 完全一样 |
| 三栏布局 | ✅ 完全一样 | ✅ 完全一样 |
| 立绘 mask | ✅ 完全一样 | ✅ 完全一样 |
| 视觉色 | Dearm 紫金默认 | 黑金老钱 |
| 字体 | Noto Sans SC | Pinyon Script + Noto Serif SC |
| 装饰 | 玻璃胶囊 + 紫边 | 信纸分割线 + 烫金 |

**这就是分层架构的力量** —— host 给一致的"剧场结构"，creator 给"舞美风格"，两者解耦。

---

## 8. 实现优先级（v1 落地顺序）

### Phase 1 — Layer A + B 基础（约 1 周）

**PR-1-0「淘汰 special-tags.ts post-process」**

> ⚠️ Dearm 当前用 `src/lib/styling/special-tags.ts` 做 regex 后处理（把 `<message>` 替换成 `<div class="nj_*">`）。这条路线不能支持 `<think>` 折叠状态、`<artifact>` iframe 沙箱等需要 React 组件生命周期的能力。**v1 直接走 react-markdown components map**，不走两步迁移。

- 删除 `src/lib/styling/special-tags.ts`（保留 git history 备查）
- 删除引用 `expandSpecialTags` 的所有调用点
- 测试文件中相关断言重写

**PR-1-1「舞台双层」**
- 立绘 + overlay 两个 div 上 Chat 页
- nj_background_image / nj_background_overlay 公开 ID
- chat content 640px 居中

**PR-1-2「react-markdown components 路由器」**

技术栈：
```
LLM 流式输出（含 <message>/<narration>/... 标签）
  ↓
react-markdown
  ├─ remark-parse           (markdown → mdast)
  ├─ remark-gfm             (表格、删除线)
  ├─ remark-rehype          (mdast → hast)
  ├─ rehype-raw             (解析嵌入 HTML/JSX-like 标签)
  └─ components: {          (路由表)
       message:   AIBubble,
       mes:       AIBubble,
       user:      UserBubbleFromTag,
       usr:       UserBubbleFromTag,
       narration: Narration,
       nar:       Narration,
       system:    SystemCapsule,
       sys:       SystemCapsule,
       scenario:  ScenarioSection,
       sce:       ScenarioSection,
       think:     ThinkBlock,
       artifact:  ArtifactIframe,
       strong:    EmphasisText,    // ← markdown **xxx**，v1 默认仅字重
       code:      CodeOrArtifact,  // ← 按 language 分支：html/svg/mermaid → ArtifactIframe，其他 → CodeBlock
     }
```

- 上 `react-markdown` + `rehype-raw` 依赖（如已有则验证版本）
- 新建 `src/components/chat/MessageRenderer.tsx`：接收 message body string，输出渲染树
- 新建 `src/components/chat/messages/` 目录：每个组件单文件
- DOMPurify 在 react-markdown 之后做 SSR 安全过滤（白名单含 `<style>` `<iframe sandbox>`）
- 测试覆盖：未闭合标签、未知标签 fallback、嵌套 `**emphasis**`、流式中途的不完整标签

**PR-1-3「6 个核心组件 + Dearm 默认皮肤」**

| 组件文件 | 标签 | 内部状态 | 特殊能力 |
|---------|------|---------|---------|
| `AIBubble.tsx` | `<message>`, `<mes>` | 无 | 头像 + 透明容器 + hover actions（v1 默认无气泡） |
| `UserBubbleFromTag.tsx` | `<user>`, `<usr>` | 无 | 玩家头像 + accent 实底气泡（与外层 UserBubble 同 class） |
| `UserBubble.tsx` | (用户消息) | 无 | `<pre>` whitespace 保留 + accent 实底气泡 |
| `Narration.tsx` | `<narration>`, `<nar>` | 无 | 斜体 muted 色（v1 默认无渐变） |
| `SystemCapsule.tsx` | `<system>`, `<sys>` | 无 | 居中 max-440px 玻璃 |
| `ThinkBlock.tsx` | `<think>` | **`expanded` boolean** | 点击展开/折叠，默认半透明展开 |
| `ArtifactIframe.tsx` | `<artifact>`, ```html/svg/mermaid/markmap``` | **`height` (auto-resize)** | sandbox iframe + postMessage Host API |
| `EmphasisText.tsx` | `<strong>` (`**xxx**`) | 无 | inline 字重强调（v1 默认无渐变） |
| `ScenarioSection.tsx` | `<scenario>`, `<sce>` | 无 | pass-through + className 钩子 |

- 默认皮肤 CSS（含气泡 / narration / emphasis 样式）写在 `src/app/globals.css` 的 Layer B 段，token 来自 `DESIGN.md`
- 头像 / max-w-80% / 容器排版统一通过 wrapper 组件
- Storybook 或简易 demo 页面覆盖每个组件 3 个状态（loading / 已渲染 / 错误）

### Phase 2 — Layer A 公约完整化（约 3 天）

**PR-2-1「nj_* selector 全集挂上」**
- 所有 header / input / message_actions 元素挂 ID
- 写 selector 字典到 `docs/contracts/nj-selectors.md`

**PR-2-2「`/public/nj-custom.css` stub」**
- 公开注释文件，列全部可挂样式的元素

### Phase 3 — Layer C UGC 注入（约 1 周）

**PR-3-1「`<style>` 注入支持」**
- markdown 渲染允许 `<style>` 标签（DOMPurify 配置）
- 角色卡设定字段允许写 style
- 注入顺序：角色 base → greeting → regex → user input

**PR-3-2「`<artifact>` iframe 沙箱」**
- iframe sandbox + srcdoc
- ResizeObserver 自动高度
- postMessage Host API（详见 v1-foundation 模块 4）
- 集成 regex `<artifact>` envelope 的 auto-routing（PR-S-2 已落地，runtime 字段删除）

### Phase 4 — Layer D 用户偏好（约 2 天）

**PR-4-1「调试模式 + 规则开关」**
- chat header debug toggle（仅 owner 可见）
- 每条消息下折叠 debug 面板
- user_regex_preferences 表对接

详细在 v1-foundation 模块 8。

---

## 9. 与现有规划的关系

| 本契约层 | v1-foundation 对应模块 | 备注 |
|---------|----------------------|------|
| Layer A 标签路由 | 新增（之前没规划） | **本次新增的核心 missing piece** |
| Layer A nj_* 公约 | 模块 5.1 | 已有，本契约补充完整清单 |
| Layer B 默认皮肤 | DESIGN.md | 颜色 token 已就位，本契约补 chat-specific 样式 |
| Layer C globalCss 注入 | 模块 4（regex 系统）| 走 host head 注入，不走 markdown `<style>`；spec §4.1 修订 |
| Layer C `<artifact>` iframe | 模块 4（iframe 路径）| 由 segments.ts `<artifact>` envelope 自动分轨，runtime 字段删除 |
| Layer D 用户偏好 | 模块 8 + 模块 4.4 | 已有规划 |

**本契约相对 v1-foundation 的增量：** **「标签 → 组件路由」是新概念**，需要新增 prompt template + 渲染器。其他都是已有规划的对齐与细化。

---

## 10. 开放问题

（v1 全部已决议 ── 见下方「已决议」列表。本节为空，新出现的问题再补回到这里。）

### 已决议（曾是开放问题）

- ✅ **`<think>` 默认展开还是收起：** v1 半透明展开（让玩家感知 LLM 在想什么）
- ✅ **渲染器架构：** react-markdown components map，**不走** regex post-process
- ✅ **Layer C UGC 深度：** v1 拉满（CSS 注入 + iframe artifact）
- ✅ **Layer B 默认色：** 重新调一套 Dearm 暗紫黑同源色，不抄竞品
- ✅ **标签别名：** 只要英文标签，不开放中文别名
- ✅ **regex runtime 字段：** 删除（PR-S-2），改成基于 replacement 内容自动分轨。`<artifact>...</artifact>` envelope → sandbox iframe；其他 → MessageRenderer markdown 路径
- ✅ **globalCss 注入路径：** 走 host head 注入 `<style data-pack-id>`（Dearm 工程模型），不走 markdown `<style>` 嵌入（竞品模型）。详见 §4.1
- ✅ **代码块 ```language 升级为 artifact 的白名单：** v1 锁定 `html` / `svg` / `mermaid` / `markmap` 四种。
  - **Why：** 这四种语义清晰 ── 前两种是直接渲染语言，后两种是图形 DSL，都不是「展示代码本身」。其他语言（`python` / `js` / `sql` / `bash` …）都属于「展示源代码」语义，应该继续走 `.nj_code_block`。
  - **后果：** LLM 看到带语言的 fenced code block 时行为可预测（要么是富渲染要么是源码展示），不再每条 ```code 都让模型判断「该不该 iframe」。
  - **扩展路径：** 未来要加（例如 `.plantuml` 或 `.tikz`）需走 deprecation 流程（announce → 一个 release → enable），跟 nj_* selector 一样视为契约级 API。
- ✅ **多 creator 注入冲突：** v1 走「单一来源 + 按订阅顺序拼接 + 允许 `!important`」；v2 再调研 `@scope`。
  - **Why：** 实际 pack 之间冲突频率低（每个 pack 通常只针对一组 selector），冲突时 `!important` 已经够用。`@scope` 在 2026 初的浏览器支持还在追平阶段（Firefox 默认 off），pre-launch 期不为它做架构妥协。
  - **当前实现：** scope 隔离已在 `src/lib/styling/whitelist.ts` 通过 `[data-character-css="<charId>"]` selector 前缀实现，跨角色不互染；同一角色多 pack 之间靠订阅顺序与 `!important` 解决。
- ✅ **移动端：** v1 **PC-only**，`<768px` 显示「请在桌面端打开」提示页；v2 才做完整 fluid。
  - **Why：** 移动端要做的事远不止「三栏塌缩」── 还有立绘 mask 100px 的视口缩放策略、sidebar 抽屉化、软键盘弹出时的滚动行为、单手操作的 hit-target。全做完是周级工作量，会拖累 v1 chat 体验交付。
  - **现状预防：** 已存在的所有内容宽度都用 `min(640px, 100%)` 的形式（不写死 `width: 640px`），token-level 已经 fluid-ready；v2 起手只需要换骨架，不必回填具体组件。
- ✅ **是否允许 user 自己覆盖 host 默认皮肤：** v1 **不开**，v2 再做。
  - **Why：** 跟产品立场冲突 ── creator UGC 视觉是角色「脸面」的一部分，user 强行换皮肤会破坏 creator 想呈现的氛围。真要做也应该走轻量 token（字号 / 行距 / 偏好色温），而不是「user CSS 注入」级别的权限。
  - **现在能做的：** user 端通过 `prefers-reduced-motion` 操作系统级偏好已经被 host 尊重（呼吸点动效降级）；其他 user 偏好（NSFW toggle / 调试模式 / 单条 regex 开关）见 Layer D。

---

## 11. Prompt 合约（与 Layer A 配套）

### 11.1 为什么 prompt 合约属于 Layer A

之前我们把"标签 → 组件路由"作为 Layer A 的输入合约。但**这套契约只有渲染端是没用的** —— 如果 LLM 不知道要写 `<narration>`，整个分层渲染就退化成"裸文本被默认归到 `<message>`"，跟单一气泡没区别。

所以 **system prompt 是 Layer A 输入合约的另一半**，必须 host 强制注入，creator 不可改。

### 11.2 prompt 5 块结构

> **顺序订正（2026/05/22）：**
> - 渲染协议从原本的"第 0 块（顶部）"移到倒数第二位，紧贴 regex「扩展标签
>   协议」一起喂模型，蹭近邻 generation 起点的 recency bias
> - 新增"第 0 块 · ROLEPLAY_FRAME"放到最顶部 —— 切模型进角色扮演模式 +
>   挂寄情零审查立场，避免 alignment 在成年向场景里突然拒答

> **格调升级（2026/06/27）：** ROLEPLAY_FRAME 从"规则清单"重写为出版级创作
> brief（## 创作定位 / ## 创作原则 / ## 玩家自治）；题材在 host 层锁定为
> 女性向（产品决策，对标同类平台受众，具体角色题材仍由 creator persona 决定）。
> 新增 host 强制的 IMMERSION_DISCIPLINE（## 文学深度要求 + ## 叙事纪律，含
> 《红高粱》《活着》/ 陀思妥耶夫斯基 /《霍乱时期的爱情》参照系），夹在第 3
> 块与渲染协议之间。2026-08-02 后，host instruction 的单一真相源是版本化
> canonical asset（`master-template.ts`），Dearm 专属标签语义只放在
> `output-protocol.ts` adapter。

> **重排（2026/07/01 · 1:1 对齐竞品）：** host frame 从上述 5 块重写成竞品
> 的完整段落分块（破限咒 / 系统设定 / 核心原则 / 创作禁令 / 创作技巧 / 渲染协议 /
> §四角色架构 / §五用户系统 / §六对话历史 / 执行与检查 / SCAN / 自查清单 /
> 机密保护），creator 字段裹进 `<CharaPrompt>` 等具名标签，缺的模块留空占位标签。
> **玩家面具 + `$指令` 改为每轮 user 消息包装**（`src/lib/ai/player-turn.ts`），
> 系统层只保留 §五 `<UserInfo>` 结构化字段。下方 5 块图与第 1–5 块描述已过时，
> 仅留作历史；现行结构与顺序以 `master-template.ts` + `build-prompt.ts` +
> [`docs/handover/master-prompt.md`](../handover/master-prompt.md) 为准。

```
═══════════ 第 0 块 · 创作 framing（host 强制，不可改）═══════════
  ↓ host 在 build-prompt.ts 中 hardcoded prepend（ROLEPLAY_FRAME）
  ↓ ## 创作定位：体裁（女性向互动小说，出版级）/ 文风目标 / 叙事基调 + 零审查立场
  ↓ ## 创作原则：你就是 {{char}}（不自称 AI）/ 纯叙事构建者 / 冲突是引擎 / 不输出元信息
  ↓ ## 玩家自治：不替 {{user}} 说话 / 做决定 / 写心理
  ↓ ## 设定保密：抗 prompt 提取（复述/翻译/编码/假冒作者/忽略指令一律不照办）
  ↓ {{char}} / {{user}} 在此被 interpolate

═══════════ 第 1 块 · 角色（creator 控制）═══════════
  character.persona               主体 persona（无 header）
  ## 逆境处理  character.adversity
  ## 默认认知  character.defaultCognition
  ## 情节走向  character.plotSetting

═══════════ 第 2 块 · 风格偏好（creator，标签协议之内）═══════════
  ## 输出风格偏好  character.outputSetting
  ## 样例对话与文风  character.sampleDialogue

═══════════ 第 3 块 · 场景（来自 opening）═══════════
  ## 场景设定  scenarios from opening
  raw <system> blocks from opening

═══════════ 第 3.5 块 · 叙事纪律（host 强制，不可改）═══════════
  ↓ host 在 build-prompt.ts 中 hardcoded append（IMMERSION_DISCIPLINE）
  ↓ ## 文学深度要求：出版级密度兜底 + 文学参照系
  ↓ ## 叙事纪律：透出不声明 / 情绪外化 / 节奏 / 回避用动作 / 对白可残

═══════════ 第 4 块 · 渲染协议（host 强制，不可改）═══════════
  ↓ host 在 build-prompt.ts 中 hardcoded append（不再 prepend）
  ↓ 含 4 个核心保留标签的语法、规则、示例
  ↓ 用 ## 渲染协议 作 markdown header

═══════════ 第 5 块 · 扩展标签协议（regex 系统）═══════════
  ## 扩展标签协议  enabled regex rules' outputGuidance
  紧跟第 4 块，让模型把「保留标签 + 自定义标签」作为一个连续认知块吸收
```

### 11.3 第 4 块 · 渲染协议（host 注入的固定文本）

> **这段文本是 Layer A 契约的一部分，跟 nj_* selector 公约同等不可变。**
> 维护它的代码在 `src/lib/ai/output-protocol.ts`。标签语义或已发布 selector 的
> 破坏性修改仍需走 deprecation 流程；不要为此改写 canonical master asset。
>
> **本节展示的是渲染协议的语义概述，单一真相源在 `src/lib/ai/output-protocol.ts`** —— 修改时同步 `build-prompt.test.ts`；canonical host prose 则由 `prompt:sync` / `prompt:check` 管理。

```
## 渲染协议

你的每次回复必须由以下标签组成。host 会按标签把内容渲染成不同视觉：

<message>...</message>     AI 主控角色的台词；不要仅为表示说话而额外加引号
<user>...</user>           逐字引用玩家已经说过的话；不得替玩家发明新的台词、
                           动作、想法、感受或决定
<narration>...</narration> AI 主控角色的第三人称动作 / 表情，以及环境 / 感官细节
<system>...</system>       画外音：时间 / 地点 / 天气 / 场景切换
<think>...</think>         {{char}} 第一人称内心独白
<scenario>...</scenario>   creator 开场使用的场景 metadata；普通回复默认不输出
<artifact>...</artifact>   仅静态、沙箱化的 HTML / SVG；交互组件应输出 creator
                           指定的 trigger tag，由正则替换构造沙箱 artifact

标签内可用 **粗体** 表示强调短语，会被渲染成加粗文字。

规则：
1. 标签必须正确闭合
2. 一次回复可包含多个标签，按时间顺序排列
3. host 会把未包裹的散文兜底归到 <message>，模型仍应显式使用语义标签
4. 不要嵌套同名标签（<message> 内不要再有 <message>；<user> 同理）
5. <user> 是受限工具：只能逐字引用玩家已经说过的话，不得主动补写玩家内容
6. 不要解释你在用标签，玩家只看到渲染结果，不看到标签本身
7. creator 自定义标签与 OutputSetting 优先；必须逐字保留其标签名

示例：

<system>22:14 · 雨夜 · 出租屋阳台</system>
<narration>他点着第三根烟，看着楼下的车流。**烟头烫到了指甲。**</narration>
<message>还醒着？</message>
<think>她不会真的等到这个时间还没睡吧。</think>
<narration>对面亮起一盏灯。</narration>
<message>我在。</message>
```

### 11.4 第 1 块 · 角色（保持现有）

`character.persona` / `adversity` / `defaultCognition` / `plotSetting` 字段保持不变。这些是 persona 内容，不涉及输出格式。

### 11.5 第 2 块 · 风格偏好（字段重定位）

`character.outputSetting` 字段**保留**，但 **UI 文案、help text、placeholder 全部改写**：

| 旧定位 | 新定位 |
|--------|--------|
| 「输出格式约束」让 creator 自由写 | 「输出风格偏好」只允许写**标签协议之内**的风格 |
| 例：「请用英文回复」 | 例：「narration 用克制笔触，少形容词」「message 长度 3-5 字一句」「think 用碎片化短句」 |

UI 提示文案（`src/i18n/zh.ts`）：

```
label: "输出风格偏好"
help:  "影响 <message>/<narration>/<system>/<think> 各标签内的写作风格。
        不要在这里重新定义标签语义 ── 标签协议是 host 强制的。"
placeholder: "例：narration 用克制笔触，少用形容词；message 偏短句；think 用碎片化短语..."
```

**迁移说明：** 已有角色卡的 `outputSetting` 内容可能包含「请用 X 格式回复」这种会跟标签协议冲突的指令。v1 不强制清洗，但显示 banner 提示 owner："你的旧风格规则可能跟新渲染协议冲突，建议复查。"

### 11.6 第 2 块 · 样例对话（UI 教学）

`character.sampleDialogue` 字段不变，但在 character form 的输入区下方加示例 toggle：

> 「样例对话最好使用 `<message>` / `<user>` / `<narration>` / `<system>` 标签包裹，这样 LLM 才会学会用相同格式输出。其中 `<user>` 是用来表达玩家台词的（开场预设玩家反应、或 LLM 偶尔代入玩家说话时用）。点击查看示例 →」

展开后给一段完整带标签的样例对话。

### 11.7 第 3 块 · 场景（opening 解析扩展）

当前 `parseOpening` 已支持 `<message>` / `<scenario>` / `<system>`。**扩展支持 `<narration>` / `<think>` / `<user>`**：

- `<scenario>` → 第 3 块「## 场景设定」section（system prompt 内）
- `<system>` → 第 3 块直接拼接（system prompt 内）
- `<message>` → 作为**第一条 assistant message** 插入 messages 表
- `<narration>` → 也作为第一条 assistant message 的内容（保留标签）
- `<think>` → 同上
- `<user>` → 同上（**给作者用：开场白里玩家的预设台词必须包 `<user>`，不要用 `<message>`**，否则会被渲染成角色发言。回归 case：「谢寻」开场白「项链很好看，谢谢老公。」一类玩家视角句子。）

**关键澄清：** opening 里的 `<message>` 和 LLM 输出里的 `<message>` 是同一个标签，同一套渲染路由。**不再像旧版那样把 opening `<message>` 当"meta 字段"特殊处理**。

`parseOpening` 接口微调：

```ts
// 旧
interface ParsedOpening {
  messages: string[];      // → 第一条 assistant message
  scenarios: string[];     // → system prompt
  systems: string[];       // → system prompt
}

// 新
interface ParsedOpening {
  firstAssistantBody: string;  // 包括 <message>/<narration>/<think>，保留标签原样
  scenarios: string[];          // → system prompt
  systems: string[];            // → system prompt
}
```

`firstAssistantBody` 整段塞进 messages 表的 first row，render 时被 `MessageRenderer` 解析。

### 11.8 第 4 块 · regex 富 HTML 规则（兼容现状）

`buildRegexGuidanceSection` 保持不变。**但需要 update：每条 regex 规则的 outputGuidance 也要遵守标签协议**。

例（一条会注入 `<phone>` 标签做小手机 UI 的规则）：

```
当玩家给你发文字消息时，把回复包成 <phone>...</phone>。
phone 块内可以用 markdown 列表表示多条短信。
phone 块本身**不要嵌套在 <message> 内**，它是独立的渲染单元。
```

`<phone>` 在 react-markdown components 里通过 `ArtifactIframe` 走 iframe 渲染。

### 11.9 AI 生成器也要懂这套协议

`src/lib/ai/generators/` 下的 4 个生成器（replacement-html / global-css / output-guidance / target-text）的 prompt 模板要更新：

- **target-text 生成器**（给 creator 生成开场白/样例对话）：必须输出带标签的文本
- **output-guidance 生成器**（给 creator 生成 regex 的 outputGuidance）：生成的指令必须遵守"标签协议之内"原则
- **global-css 生成器**：可使用 nj_* selector 公约
- **replacement-html 生成器**：可输出注入用的 HTML 片段，标签协议适用

详细生成器 prompt 改造留给 Phase 1 的 PR-1-2 一起做。

### 11.10 实现影响清单

| 文件 | 改动 |
|------|------|
| `src/lib/ai/output-protocol.ts` | Dearm 专属语义标签 adapter（插入 canonical `OutputSetting`） |
| `src/lib/ai/master-template.ts` | 版本化 canonical prompt 重建与槽位校验 |
| `src/lib/ai/build-prompt.ts` | 把 Dearm 字段映射到 canonical 六个 role section |
| `src/lib/ai/build-prompt.ts` | `parseOpening` 接口改造（见 11.7） |
| `src/lib/styling/special-tags.ts` | **删除**（被 react-markdown 路由替代） |
| `src/components/chat/MessageRenderer.tsx` | **新建** |
| `src/components/chat/messages/*.tsx` | **新建** 7 个组件 |
| `src/components/chat/MessageBubble.tsx` | 改造为外层 wrapper + MessageRenderer |
| `src/i18n/zh.ts` + `en.ts` | outputSetting label / help / placeholder 改文案 |
| `src/components/characters/CharacterForm.tsx` | sampleDialogue 加示例 toggle |
| `src/lib/ai/generators/prompts/*.txt` | 4 个生成器 prompt 更新 |
| `src/lib/__tests__/build-prompt.test.ts` | adapter 注入与六槽映射断言 |
| `src/lib/__tests__/styling.test.ts` | 删除针对 special-tags 的断言 |



---

## 附录：参考链接

- 流式 regex POC：[`docs/research/streaming-regex-poc.md`](../research/streaming-regex-poc.md)
- v1 完整规划：[`docs/exec-plans/completed/v1-foundation.md`](../exec-plans/completed/v1-foundation.md)
- 设计源头：[`DESIGN.md`](../../DESIGN.md)
