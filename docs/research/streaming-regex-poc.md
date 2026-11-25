# 流式正则匹配 POC — W3 研究结论（寄情 W6 实现备忘）

> 范围：本文只做结论与策略选型。代码实现 W6 跟 sanitize 路径打磨一起做。
> 用户故事："AI 在边写边输出 `<EnvironmentData>...</EnvironmentData>` 这种 XML 标签时，UI 应当先显示原始 placeholder（不漏 XML 给玩家），等闭合标签到位后再把整段 swap 成 creator 写的 replacement HTML 渲染。"

---

## 一、问题陈述

W3 已经把流式打通：

```
client useChat
  → POST /api/chat
    → streamText({ model, system, messages, onFinish }) → toUIMessageStreamResponse
  → 客户端按 text-delta 实时拼接，渲染到 .nj_ai_message_bubble
```

但渲染是「把 text 直接塞进 div」。一旦 AI 输出 XML 标签（W4-5 才会，但 W3 已经能用 character.sample_dialogue 诱导模型这么做），UI 就会出现：

- 半截开标签 `<EnvironmentData environment="忘川堂` — 玩家看到一堆裸标签
- 中段 `name="忘川堂" hp="80"` 这种属性表 — 玩家看到游戏内部数据
- 闭合 `</EnvironmentData>` 才到位 — 这时候才有完整的可替换块

**目标行为**：流式过程中，整段未闭合的 XML 标签**不暴露**给玩家。要么显示一个 `…` 占位符 / "（生成中）" 之类的临时态，要么显示"开标签前的纯文本 + 占位 + 暂时藏住后续"。等到闭合到位，立刻 swap 成渲染后的 HTML。

这是「流式 + 局部渲染」最难的部分。竞品自己也在 changelog 里把这个列为难点。

---

## 二、关键约束

来自 `docs/exec-plans/v1-foundation.md`：

1. **流式不打断**：玩家不能等整段输出完才看到东西。AI 写到哪渲染到哪是体感主线。
2. **不漏 XML**：未闭合的 `<X>` 标签到屏幕是 P0 bug —— creator 写的"环境状态面板"瞬间变成 raw XML schema。
3. **支持嵌套 / 多规则共存**：一条消息里可以同时有多条规则的标签（`<EnvironmentData>` 加 `<thinking>` 加 `<inner_monologue>`）。
4. **闭合到位后零延迟 swap**：不能等下一帧或 setTimeout —— 闭合那一刻同步替换。
5. **regex 是 creator 写的，pattern 可能 evil**：catastrophic backtracking 是 DoS 风险，必须有超时 / 步数限制。
6. **W3 只持久化 raw content**：`messages.rendered_html` 字段虽然 schema 有，W3 不写。W6 onFinish 写一次最终渲染结果。

---

## 三、候选方案

### 方案 A：纯客户端 buffer，闭合检测器

在 `useChat` 之上包一层：维护当前流式消息的 `rawText` buffer + 一个轻量 tokenizer 找 XML 边界。

```
state per streaming message:
  rawText: string           // 累积的原始文本
  rendered: ReactNode[]     // 已经"定型"的片段（纯文本 / 已闭合 XML 的替换 HTML）
  pending: { tag, startIdx, ... } | null   // 当前正在等闭合的标签
```

每收到一个 text-delta：

```ts
rawText += delta
while (pending === null) {
  // 找下一个 < 起始
  const open = scanNextTagOpenAfter(rawText, lastFlushIdx)
  if (open == null) { flushAsPlainText(); return }
  // 检查这是不是某条 regex_rule 关心的 tag
  const rule = matchOpeningTag(rawText, open)
  if (!rule) { flushAsPlainText(); return }
  // 把 < 之前的纯文本先 flush
  flushAsPlainText(rawText.slice(lastFlushIdx, open))
  pending = { rule, startIdx: open }
  break
}
if (pending) {
  // 在 rawText 里找闭合
  const close = findClose(rawText, pending.startIdx, pending.rule.closingTag)
  if (close == null) {
    // 还没闭合 —— 渲染占位（不暴露 raw）
    showPlaceholder(pending.rule.placeholderHtml || '…')
    return
  }
  // 闭合到位 —— 跑 regex，渲染
  const segment = rawText.slice(pending.startIdx, close)
  const html = applyRegex(segment, pending.rule)
  rendered.push(html)
  lastFlushIdx = close
  pending = null
  // 回到顶层 loop 继续找下一段
}
```

**优点**：
- 不动 server，纯前端，迭代快
- 完全控制占位策略（每条 rule 可以有自己的 placeholder）
- 闭合检测便宜（线性扫描）

**缺点**：
- regex_rules 要打到客户端（v1 是 OK 的，rules 是非敏感数据；creator 自己写的）
- 复杂规则（如 Dearm 手机的 iframe 路径）这里只能做 sanitize 路径，iframe 走另一条
- catastrophic backtracking 防御只能在客户端做 —— `setTimeout + AbortController` 限制 regex 执行

### 方案 B：服务端做匹配，stream 包装 token

`/api/chat` 不直接转发 raw 文本流，而是包一层：

```
raw token from model → server applyRegex(buffer) → 输出语义化 chunk:
  { type: 'text', delta: '...' }                       // 安全文本
  { type: 'placeholder', ruleId, partial: '...' }      // 还没闭合的 XML
  { type: 'render', ruleId, html: '...', raw: '...' }  // 闭合到位，替换块
```

客户端 useChat custom dataChunkParser → 用 data parts 渲染。AI SDK v6 通过 `createUIMessageStream` + `writer.writeData()` 支持这种自定义协议。

**优点**：
- 客户端简单（只渲染 server 给的 chunk）
- regex 在 server 跑，可控（worker / VM2 隔离 / timeout）
- 持久化 rendered_html 自然 —— server 边算边累积

**缺点**：
- server 要重复 buffer 逻辑 —— 比纯前端复杂
- 改了 useChat 的协议，需要 custom transport on client（v6 支持，但不是 stock 模式）
- 一个 message 来回多次 round-trip —— 与流式语义有摩擦

### 方案 C：纯文本到底，闭合再后处理

流式过程**不做任何渲染层的特殊处理** —— XML 标签和正文一起显示给玩家。等 onFinish 触发，server 跑一次完整的 applyRegex，把渲染后的 HTML 写到 messages.rendered_html，前端 swap 一次。

**优点**：
- 实现最简单 —— W3 的 chat 路径加一个 onFinish 钩子就完事
- 100% 与 messages.debug_info.raw_output 对齐

**缺点**：
- **直接踩 P0 红线**：流式中暴露 raw XML 给玩家。1 秒的 lag 都不能接受 —— 整段「环境状态面板」原始数据就那么大喇喇贴脸。
- 不能用。

---

## 四、推荐方案 — A + W7 iframe 走 B 分支

**核心选择：方案 A 作为 W6 sanitize 路径的实现**。理由：

- 实现复杂度可控（~ 200 行客户端 buffer 逻辑）
- 占位策略灵活，可以让 creator 给每条 rule 配 placeholder HTML（"（环境数据生成中…）" 之类）
- regex 安全可以靠 `RegExp` 引擎 + 客户端 worker + per-rule timeout 保护
- 与 W4-5 的工作流（pattern 编辑 / 测试面板）天然对齐 —— 测试面板本就是同样的 buffer 逻辑离线版

**iframe 路径走方案 B 的变种**（W7）：
- iframe 内容必须等闭合 —— 半截 srcdoc 无意义。所以 iframe 标签触发的规则强制走"等闭合 + 一次性渲染" 路径。
- 流式时显示占位 iframe（loading 状态），闭合后整段 srcdoc swap。
- 这部分 server 也不需要做特殊事 —— 客户端 buffer 区分一下 `runtime: 'sanitize'` vs `'iframe'` 分支。

---

## 五、几个关键决策点（W6 实现时要确认）

### 5.1 placeholder 是什么？

三个选项：

| 选项 | 体感 | 实现 |
|------|------|------|
| **「…」单个省略号** | 极简，跟生成中视觉一致 | 1 行 CSS |
| **「（{rule.name} 生成中）」** | 让玩家知道在等什么，但有"机械感" | rule 名要中文化 |
| **「creator 自定 placeholder」** | 最灵活，但 creator 要多填一个字段 | rule schema 加 `streaming_placeholder` |

**推荐 W6 起步：** 默认 "…"（三呼吸点动效），rule schema 加 optional `streaming_placeholder` 字段供 creator 后续填。MVP 不强制 creator 填。

### 5.2 闭合标签检测要不要支持嵌套？

实例：`<thinking><inner>...</inner></thinking>`。

简单做法：用栈 + 标签名匹配。复杂度可接受。

但 creator 写的 pattern 可能不需要嵌套（基本都是单层 `<X>...</X>`）。**v1 仅支持单层非嵌套**，遇到嵌套同名标签按"找第一个匹配的闭合"处理，文档里明确说明这是限制。W7 之后如果有 case 再升级。

### 5.3 regex 在客户端跑 vs 在 Web Worker 跑？

`String.replace(pattern, replacement)` 在主线程跑的话，evil pattern 会冻整个 UI。

W6 起步：**主线程跑 + 200ms 超时拦截**：

```ts
const start = performance.now()
const watchdog = setTimeout(() => {
  console.warn('regex rule X exceeded budget, aborting')
  // 这里没法真的 abort（JS regex 不可中断），但能 log
}, 200)
try {
  result = pattern.exec(buffer)
} finally { clearTimeout(watchdog) }
```

**真正防御**：W8 配合 CSS walker 一起，把每条 rule 的执行迁到 Web Worker。Worker 死了主线程不挂。

### 5.4 流式 cursor 闪烁怎么处理？

当 placeholder swap 成最终渲染时，焦点 / 滚动位置可能跳。React `useLayoutEffect` 在 swap 前后保留 scrollHeight 偏移。

非关键，W6 调试时再细化。

---

## 六、与 W3 现状的对齐

W3 已经做了：

- ✅ `/api/chat` 流式跑通（streamText + toUIMessageStreamResponse）
- ✅ 客户端 useChat 拿到 text-delta，实时拼接到气泡
- ✅ `.nj_ai_message_bubble` selector 挂上，applyRegex 着陆点准备好
- ✅ `messages.debug_info` jsonb 字段在 schema 里，留给 W6 写 rawOutput / matchedRules

W3 没做（W6 接手）：

- ❌ 流式正则 buffer / 闭合检测
- ❌ `applyRegex()` 真实实现（W4 写 rules 数据模型，W5 写 UI，W6 写运行时）
- ❌ DOMPurify + react-markdown + rehype-raw 链路
- ❌ `messages.rendered_html` 写入

---

## 七、W6 起步任务清单（写到这里供 W6 直接接）

1. `src/lib/regex/stream-buffer.ts` — 实现方案 A 的状态机
2. `src/lib/regex/apply.ts` — 单条 rule 的 regex.exec + replacement.interpolate + DOMPurify
3. `src/components/chat/ChatRoom.tsx` 接入：替换 MessageBubble 的 `text` 渲染为 `stream-buffer` 输出的 `rendered` 段
4. 单元测试覆盖：
   - 半截开标签、半截属性、跨多个 delta 的闭合
   - 多 rule 共存、同 rule 多次出现
   - evil pattern timeout 防御
5. `messages.debug_info` 写入：`{ rawOutput, matchedRules, unmatchedRules, systemPrompt }`，调试模式面板读它

---

## 八、风险登记

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| evil pattern 冻 UI | 中 | P1（玩家觉得卡） | Worker 隔离（W8）+ 主线程 timeout 警告 |
| 嵌套同名标签错配 | 低 | P2（个别 case 渲染错） | 文档说明 v1 限制；提供测试面板让 creator 自测 |
| placeholder 体验差 | 中 | P1（"生成中"满屏不好看） | 给 creator 自定 placeholder + 三呼吸点默认动效 |
| 流式中 scrollTop 跳 | 中 | P2（小烦人） | useLayoutEffect 保留偏移 |

---

## 九、结论

**POC 结论**：方案 A 可行，复杂度 ~ 200 行，对应 W6 1-2 天工作量。W7 的 iframe 路径在同一框架里加一个 runtime 分支即可。

**W3 这周不需要再加东西** —— 上述结论 + 任务清单已经能让 W6 直接接手。
