# Creator Studio 适配新渲染契约

**状态：** v1 草案
**最后更新：** 2026/05/21
**前置：** [`docs/contracts/chat-render-spec.md`](./chat-render-spec.md)

> 这份文档是 chat-render-spec 的**配套迁移指南**。chat-render-spec 定义"渲染应该是什么样"，这份文档定义"creator studio 现状跟它对不上的地方怎么改"。

---

## 0. 现状快照

```
src/components/packs/
├── PackRuleSelector.tsx             角色卡选择订阅哪些 pack
├── SubscribeToCharacterButton.tsx   订阅按钮
└── studio/
    ├── StudioLayout.tsx             3 tab: rules / css / assistant
    ├── CssTab.tsx                   globalCss 编辑器（提示「只能用 nj_*」）
    ├── AssistantTab.tsx             AI 助手对话
    └── PreviewCanvas.tsx            右侧 live preview

src/lib/regex/
├── schema.ts                        regexRuleFormSchema（runtime: sanitize|iframe）
├── apply.ts                         主渲染管道：applyRegex()
├── stream.ts                        流式裁剪未闭合标签
├── segments.ts                      iframe-mode 分段
├── derive.ts                        tool-mode 自动推 pattern
├── templates.ts                     模板预设
├── yearn-phone.ts                   官方 phone pack 的 replacement HTML
├── iframe-bridge.ts                 iframe sandbox postMessage
├── prompt.ts                        outputGuidance → system prompt 拼接
└── ...

src/lib/db/schema.ts
├── beautificationPacks              id / name / description / globalCss / isPublic
├── regexRules                       FK packId; mode/toolType/pattern/replacement/runtime/...
├── characterPackSubscriptions       角色 ↔ pack
├── subscriptionRuleOverrides        订阅级禁用
└── userRegexPreferences             用户级禁用
```

**当前渲染管道：**
```
LLM stream output
  ↓
expandSpecialTags()              <message>/<system>/<narration>/<scenario> → <div class="nj_*">
  ↓
applyRegex() / applyRegexToSegments()    pack rules 按 runtime 分轨
  ↓
sanitize HTML (DOMPurify)        sanitize 轨
  ↓
ArtifactIframe (iframe sandbox)  iframe 轨
  ↓
render <MessageBubble>
```

---

## 1. 决议一览

| 项 | 现状 | 决议 |
|---|------|------|
| **globalCss 注入路径** | 数据库字段，host 在 chat 页 `<head>` 注入 `<style data-pack-id="X">` | ✅ 保持，spec §4.1 改写 |
| **`runtime` 字段** | 每条规则二选一 `sanitize`/`iframe` | ❌ **删除字段**，靠 replacement 内容自动分轨 |
| **`expandSpecialTags`** | regex 后处理把标签转 div | ❌ **删除**，走 react-markdown components |
| **Preview pipeline** | 用 expandSpecialTags + apply | 🔄 **改成共用 `<MessageRenderer />`**，跟生产一致 |
| **yearn-phone pack** | 输出整段 HTML（含 `<style>` + `<div class="nj_phone_*">`），runtime=iframe | 🔄 **重做**：replacement 输出 `<artifact>` 包裹的完整 HTML |
| **`outputGuidance` 模板** | 教 LLM 怎么输出标签 | 🔄 必须遵守新标签协议（见 spec §11.9） |
| **AI 生成器 4 个** | global-css / output-guidance / target-text / replacement-html | 🔄 prompt 模板更新（见下） |
| **schema 表结构** | beautificationPacks / regexRules / subscriptions / overrides / prefs | ✅ 保持全部 |
| **Studio 三 tab** | rules / css / assistant | ✅ 保持 |
| **订阅/禁用机制** | character ↔ pack 多对多 + 多层禁用 | ✅ 保持 |

---

## 2. 决议 1：`runtime` 字段 ── 删除，自动分轨

### 2.1 为什么删

新架构下，**消息渲染走 react-markdown components map**。`<artifact>` 标签自动路由到 `<ArtifactIframe />`，其他标签和原始 HTML 走标准 markdown 链路（rehype-raw + sanitize plugin）。

让规则手工标 `runtime` 是冗余的：
- 标 `iframe` 但 replacement 没包 `<artifact>` → 配置错误
- 标 `sanitize` 但 replacement 输出了 `<script>` → 配置错误且不安全
- 两者其实是**互斥的内容形态**，让用户重复决定一次没意义

### 2.2 自动分轨规则（host 层判定）

```
applyRegex 输出最终 text:
  ↓
  • text 含 <artifact>...</artifact>           → ArtifactIframe 路由
  • text 含 ```html / ```svg / ```mermaid     → ArtifactIframe 路由（语言白名单）
  • text 含 <message>/<narration>/...         → 对应 React 组件路由
  • text 是纯 markdown / 普通 HTML 片段        → markdown rehype-raw + sanitize
```

判定逻辑统一收敛到 `MessageRenderer`，**creator 不需要标记规则类型**。

### 2.3 数据库迁移

```sql
-- migration: 0XXX_remove_regex_runtime.sql

-- 1. 把现有 iframe-mode 规则的 replacement 自动包 <artifact>
UPDATE regex_rules
SET replacement = '<artifact>' || replacement || '</artifact>'
WHERE runtime = 'iframe'
  AND replacement NOT LIKE '%<artifact>%';

-- 2. 删除字段
ALTER TABLE regex_rules DROP COLUMN runtime;
```

pre-launch 状态，dev 库随时可重建，一个 PR 一步合掉即可。

### 2.4 表单 + 模板的影响

- `regexRuleFormSchema` (`src/lib/regex/schema.ts`)：移除 `runtime` 字段
- `RegexForm.tsx`：移除 runtime 单选 toggle
- `templates.ts`：所有 preset 移除 `runtime` 字段；iframe 类模板的 `replacement` 改成自带 `<artifact>` 包裹
- `derive.ts` / `apply.ts` / `segments.ts`：跟随移除 runtime 分支

### 2.5 模板里的"输出指引"也跟着改

每条 regex template 的 `outputGuidance`（教 LLM 怎么用这个标签）必须更新。例如旧模板：

```
当玩家给你发文字消息时，把回复包成 <phone>...</phone>。
```

新模板：

```
当玩家给你发文字消息时，把整个手机回复包在 <artifact><phone>...</phone></artifact> 内。
phone 块是独立的渲染单元，不要嵌套在 <message> 内。
```

---

## 3. 决议 2：globalCss 注入仍走 host head，spec 修订

### 3.1 实际工程模型

```
pack 数据保存:
  beautificationPacks.globalCss = ".nj_ai_message_bubble { ... }"

chat 页 SSR 时，host 收集订阅的 pack:
  collectGlobalCss(characterId) → string

host 在 <head> 注入:
  <style data-pack-id="${pack.id}">${pack.globalCss}</style>

每条规则独立，可去重、可禁用、可监管
```

这跟竞品的「creator 在 greeting 里嵌 `<style>`」工程上不同 —— Dearm 更结构化、不依赖 LLM 配合、防注入污染。**这是 Dearm 的优势，spec §4.1 之前描述错了，应改为：**

> Layer C C1 ── globalCss 注入（Dearm 工程模型）
>
> creator 在 studio CSS tab 编辑 pack.globalCss 字段。chat 页 SSR 时，host 按角色订阅顺序收集所有订阅 pack 的 globalCss，按 pack.id 去重，作为多个独立 `<style data-pack-id>` 注入 chat 页 `<head>`。
>
> - 不通过 markdown 嵌入 `<style>` 触达，避免 LLM 误输出污染
> - 单条 globalCss scope 限定为 `[data-character-css="<charId>"]` 容器，避免跨角色样式互染
> - DOMPurify 不参与（globalCss 是 trusted creator input，不是 LLM 输出）

**已完成：** chat-render-spec.md §4.1 已修订，明确 Dearm 走 host head 注入而非 markdown `<style>` 嵌入。

### 3.2 CSS scope 隔离

参考 `src/lib/__tests__/styling.test.ts:11` 的断言：
```js
expect(css).toContain('[data-character-css="abc"] .nj_ai_message_bubble');
```

说明 Dearm 已经做了 selector 自动加前缀。这个 scope 机制保留，新组件的 `nj_*` selector 也自动套上 `[data-character-css="${charId}"]`。

---

## 4. 决议 3：Preview pipeline 跟生产共用 `<MessageRenderer />`

### 4.1 问题

`PreviewCanvas.tsx`、`RegexForm.tsx` 当前调用 `expandSpecialTags` 做 preview。删掉 `expandSpecialTags` 后，preview 必须切到 `MessageRenderer`，否则 creator 在 studio 调出来的效果跟实际 chat 不一致 ── 这是 UGC 工具的死罪。

### 4.2 改造

```tsx
// PreviewCanvas.tsx —— 改后
import { MessageRenderer } from "@/components/chat/MessageRenderer";

function PreviewCanvas({ packId, rules, globalCss }: Props) {
  // 1. 取测试输入（creator 在 studio 顶部填的 mock LLM 输出）
  const testInput = useTestInput();

  // 2. 经过 applyRegex
  const processed = applyRegex(testInput, rules, {});

  // 3. 注入 globalCss 到 preview 容器 scope
  return (
    <div data-character-css={`preview-${packId}`}>
      <style>{scopeCss(globalCss, `preview-${packId}`)}</style>
      <MessageRenderer content={processed.text} />
    </div>
  );
}
```

**关键：** preview 容器自己挂 `data-character-css` 属性，scope 应用到 globalCss。跟生产同源同一套 selector 路径。

### 4.3 RegexForm 同样改造

`RegexForm.tsx:262` 把测试输入 → expandSpecialTags → applyRegex 改成测试输入 → applyRegex（单规则）→ MessageRenderer 渲染。

---

## 5. 决议 4：官方 yearn-phone pack 重做

### 5.1 现状

`src/lib/regex/yearn-phone.ts:YEARN_PHONE_SAMPLE_TEXT` 让 LLM 输出 `<phone>...</phone>`，规则 pattern 匹配它，replacement 输出一大段 `<div class="nj_phone_*">` + `<style>`，挂在 iframe sandbox 里跑。

### 5.2 新架构下

```
LLM 输出:
  <phone>
  [wechat]
  user: 干嘛
  ai: 罐头！
  ...
  </phone>

regex 规则 pattern 匹配 <phone>...</phone>，replacement 输出:

  <artifact>
  <!DOCTYPE html>
  <html>
  <head>
    <style>/* nj_phone_* 完整 CSS */</style>
  </head>
  <body>
    <div class="nj_phone_shell">
      <!-- phone 内容（解析 user:|||ai:|||这种短语法生成 chat / notes / wallet / weibo） -->
    </div>
    <script>
      /* 跟 iframe-bridge postMessage 协议交互 */
    </script>
  </body>
  </html>
  </artifact>

MessageRenderer 看到 <artifact>，路由到 <ArtifactIframe />:
  <iframe sandbox="allow-scripts" srcdoc={extractedHtml} />
```

### 5.3 改造点

1. `buildYearnPhoneReplacementHtml()` 改名为 `buildYearnPhoneArtifact()`，返回字符串以 `<artifact>` 开头、`</artifact>` 结尾
2. 内部生成的是完整 `<!DOCTYPE html>` 文档，包含独立的 style + body + script
3. iframe sandbox 仍走 `iframe-bridge.ts` 的 postMessage 协议
4. 模板示例文本 `YEARN_PHONE_SAMPLE_TEXT` 保留 `<phone>` 语法（LLM 友好），creator 看到的"如何让 LLM 输出"指引不变
5. `outputGuidance` 提示更新：「LLM 输出 `<phone>...</phone>`，host 会自动包装成 artifact iframe」

### 5.4 用户体验保持

creator 视角下：
- 旧：装 yearn-phone pack → LLM 学会写 `<phone>` → 渲染成手机 UI
- 新：装 yearn-phone pack → LLM 学会写 `<phone>` → 渲染成手机 UI（路径不变，引擎换了）

---

## 6. 决议 5：AI 生成器 4 个 prompt 模板更新

文件：`src/lib/ai/generators/prompts/*.txt`

### 6.1 `global-css` 生成器

**当前：** 告诉 LLM 「只能用 `nj_*` selector」。

**新增上下文：**

```
这是一份 Dearm 聊天页的全局 CSS 生成任务。

可用的 nj_* 选择器分两类：

A) 结构 ID（全局一个）：
   #nj_chat_header, #nj_chat_input_box, #nj_chat_input_container,
   #nj_back_button, #nj_header_follow_btn, #nj_header_message_btn,
   #nj_header_more_btn, #nj_header_clarity_btn, #nj_background_image,
   #nj_background_overlay, #nj_author_note, #nj_chat_input_replay_btn,
   #nj_chat_input_model_btn, #nj_message_actions_box, ...

B) 消息分型类（按消息渲染）：
   .nj_ai_message_bubble        AI 角色台词气泡
   .nj_user_message_bubble      用户气泡（<pre> 元素，保留换行）
   .nj_message_narration        第三人称叙述（默认渐变填充斜体，无气泡）
   .nj_message_system           场景/时间/天气（默认居中玻璃胶囊）
   .nj_message_think            内心独白（默认半透明展开折叠盒）
   .nj_emphasis_text            inline 强调（默认渐变填充粗体）
   .nj_code_block               代码块
   .nj_artifact_iframe          richHTML iframe

注意：
- .nj_message_narration 用 background-clip:text + -webkit-text-fill-color:transparent
  做渐变填充。覆盖时要重置 -webkit-text-fill-color
- 默认色系是 Dearm 暗紫黑同源（var(--accent-primary) #a78bfa 等）
- 不要写死 hex 颜色，优先用 CSS custom property
```

### 6.2 `output-guidance` 生成器

**新增上下文（强制）：**

```
你生成的 output_guidance 文本会拼到 system prompt 末尾。它必须遵守 Dearm
的标签协议（不可破坏）：

- LLM 必须用 <message>/<narration>/<system>/<think> 包裹回复
- 你的指令是教 LLM 在标签协议**之内**，对当前规则匹配的标签如何输出
- 不要重新定义 <message> 等核心标签的语义
- 如果规则定义了新的标签（如 <phone>），明确告知 LLM:
  「<phone> 应包在 <artifact><phone>...</artifact> 内」或
  「<phone> 是独立渲染单元，不要嵌套在 <message> 内」
```

### 6.3 `target-text` 生成器

**当前：** 帮 creator 生成开场白 / 样例对话。

**新增上下文：**

```
你生成的是 Dearm 角色的开场白或样例对话。Dearm 用半结构化标签划分内容：

<message>...</message>     角色台词
<narration>...</narration> 第三人称叙述（动作/表情/环境）
<system>...</system>       画外音（时间/地点/天气）
<think>...</think>         内心独白

请用这些标签组织你的输出，让 chat 渲染呈现层次感。示例：

<system>22:14 · 雨夜 · 出租屋阳台</system>
<narration>他点着第三根烟。</narration>
<message>"还醒着？"</message>
```

### 6.4 `replacement-html` 生成器

**新增上下文：**

```
你生成的 replacement HTML 会作为 regex 规则的 replacement 字段，
最终输出会进入 react-markdown 链路。

- 如果输出**含 JS / 复杂 DOM 操作**：必须包在 <artifact>...</artifact> 内，
  里面写完整的 <!DOCTYPE html> 文档（含 style + body + script）
- 如果输出是**纯 HTML 片段（无 JS）**：直接输出 HTML，会经过 sanitize 后
  作为 markdown 一部分渲染
- 永远使用 nj_* 前缀给你创造的 class 命名（避免跟 host class 冲突）
```

---

## 7. mini_theatre 字段 ── 已删除（2026/05/21）

**结论：删字段。**

跟竞品实地核对（裴焰初角色卡 `roleId=2ac529b1-2808-4f61-96e8-c0048ea483fd`）发现对方 **没有「小剧场」概念**。creator 想做的「角色介绍大卡片 / 富 HTML 装饰 / BGM 自动播放 / 横滑兄弟团」整套，对方是通过 **sandbox iframe + opening 第一条 assistant message 钉死置顶** 来实现的 ── 对应 Dearm spec Layer C C2 `<artifact>` iframe + §11.7 firstAssistantBody。

Dearm 这条路径已通：
- `<ArtifactIframe />` 组件已就位
- `iframe-bridge.ts` 已注入 CSP + ResizeObserver + `window.host` bridge
- `segments.ts` 自动检测 `<artifact>...</artifact>` envelope 分轨
- `build-prompt.ts:parseOpening` 把 opening 的 `<artifact>` 整段塞进 `firstAssistantBody`

所以 `mini_theatre` 字段在产品上**没有竞品对标**、功能上**跟 artifact + opening 路径重叠**，留着是死字段。直接删：

- DB column DROP（迁移 `drizzle/0004_drop_mini_theatre.sql`）
- `src/lib/db/schema.ts` / `src/lib/characters/schema.ts` 移除字段
- `src/lib/characters/actions.ts` 3 处写入移除
- `src/lib/import-export/schema.ts` / `queries.ts` / `actions.ts` 移除导入导出字段
- `docs/handover/characters.md` / `docs/insights/characters.md` 同步

creator 真要做这种「角色介绍卡」直接在 `character.opening` 字段里写 `<artifact>` 完整文档即可。

---

## 8. 改动清单（按 PR 切分）

### PR-S-1 ── 渲染管道统一（最高优先级，紧跟 PR-1-0/1-2）

- [ ] 删除 `src/lib/styling/special-tags.ts` 及所有引用
- [ ] `PreviewCanvas.tsx`、`RegexForm.tsx` 改用 `<MessageRenderer />`
- [ ] preview 容器挂 `data-character-css` + 注入 scoped globalCss
- [ ] 测试覆盖：preview 跟生产渲染像素级一致（snapshot 测试）

### PR-S-2 ── 移除 runtime 字段

- [ ] 写迁移 SQL：iframe rules 的 replacement 自动包 `<artifact>`
- [ ] `regexRuleFormSchema` 移除 `runtime`
- [ ] `RegexForm.tsx` 移除 runtime UI
- [ ] `templates.ts` 所有 preset 更新
- [ ] `apply.ts`、`segments.ts`、`stream.ts` 移除 runtime 分支
- [ ] schema.ts 删字段（pre-launch，跟以上同 PR 一步合）
- [ ] 测试覆盖：iframe-类规则的 replacement 自动被路由到 `<ArtifactIframe />`

### PR-S-3 ── yearn-phone pack 重做

- [ ] `yearn-phone.ts:buildYearnPhoneReplacementHtml()` → `buildYearnPhoneArtifact()`
- [ ] 输出从「HTML 片段」变成「`<artifact>` 包裹的完整 srcdoc 文档」
- [ ] iframe-bridge postMessage 协议对接 `<ArtifactIframe />`
- [ ] 更新 outputGuidance 模板里的指引
- [ ] e2e 测试：创建角色 → 装 yearn-phone pack → LLM mock 输出 `<phone>` → 渲染成 phone iframe

### PR-S-4 ── AI 生成器 4 个 prompt 更新

- [ ] `prompts/global-css.txt`：加 7 个组件 + 渐变填充语义
- [ ] `prompts/output-guidance.txt`：强制遵守标签协议
- [ ] `prompts/target-text.txt`：输出带标签
- [ ] `prompts/replacement-html.txt`：知道下游进 react-markdown
- [ ] 单元测试：每个生成器输出 sample 包含正确标签

### PR-S-5 ── chat-render-spec §4.1 修订

- [ ] §4.1 C1 描述从「在 markdown 嵌入 `<style>`」改为「数据库字段 + host head 注入」
- [ ] 标注 Dearm 工程模型跟竞品不同
- [ ] 引用 `styling.ts` 的 scope 实现

### PR-S-6 ── mini_theatre 删除（已完成）

- [x] 竞品实地核对：没有「小剧场」对标功能，creator 用 `<artifact>` + opening 实现
- [x] DROP column 迁移 `drizzle/0004_drop_mini_theatre.sql`
- [x] schema / zod / actions / import-export 全链路移除
- [x] handover / insights 文档同步

---

## 9. 风险与回归测试要点

### 9.1 渲染一致性

最大风险：preview 跟生产渲染不一致 → creator 调出来的样式上线后变样。

**保险措施：**
- preview 和 chat 用同一个 `MessageRenderer` 组件实例（不是两份代码）
- 写 snapshot 测试：给定 input → preview 输出 HTML 跟 chat 输出 HTML 必须一致

### 9.2 dev 数据 sanity check

注意：pre-launch 项目，没有真实用户数据要保护。`runtime='iframe'` 的测试规则要在迁移时确认 replacement 都包了 `<artifact>`，本地跑一遍 SQL 后人工抽查几条即可。

### 9.3 旧角色卡测试样本的清理

pre-launch 状态，dev 库里的角色卡都是测试样本。改完 prompt 协议后，把测试角色卡的 outputSetting / opening / sampleDialogue 一次性清洗或重写成新标签格式即可，不需要兼容退化路径。

### 9.4 官方 pack 兼容

最大风险：用户已经装了 yearn-phone pack，重做后渲染断裂。

**保险措施：**
- 项目尚未上线，没有真实用户的订阅历史 → 直接原子替换 pack 内容即可
- 上线之前，dev / staging 环境跑一遍：装 pack → 创角色 → 触发 phone 输出 → 验证渲染正常
- v1 GA 之前任何时候改 yearn-phone 的输出格式都不需要兼容，自由迭代

---

## 10. 跟主 spec 的链接

| 本文档章节 | 主 spec 对应 | 关系 |
|---|---|---|
| §2 删除 runtime | §4.1 C1 / §8 Phase 1 | 简化 Layer C 实现 |
| §3 globalCss 修订 | §4.1 C1 描述 | **要回过去改主 spec** |
| §4 Preview pipeline | §8 Phase 1 PR-1-2 | 实现细节 |
| §5 yearn-phone | §8 Phase 3 PR-3-2 | 官方 pack 适配 |
| §6 AI 生成器 | §8 Phase 1 PR-1-2、§11.9 | prompt 模板更新 |
| §7 mini_theatre | §11.4 / 开放问题 | v1 已删，竞品用 artifact+opening 替代 |

---

## 11. 附录：完整 selector 字典待办

主 spec §2.6 列了 nj_* 公约的初步清单，但**不完整**。下一步 PR-2-1 时需要：

1. 跑 `grep -roE "id=\"nj_[a-z_]+\"" src` 把代码里已有的全捞出来
2. 对照 spec §2.6 的清单确认全覆盖
3. 写到独立的 `docs/contracts/nj-selectors.md`
4. 同步 `public/nj-custom.css` stub 文件

这是 Phase 2 的工作，本文档先列出，不做。
