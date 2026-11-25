# 聊天页性能优化：渲染隔离 + 上下文滑窗（技术交接）

> 产品思考见 [docs/insights/perf-chat-rendering.md](../insights/perf-chat-rendering.md)。

对应用户反馈「网页打开卡 / 输入文字卡 / 聊的越多越卡」。一次批量修复，
五个互相独立的改动点。

## 1. 渲染隔离（治「输入卡」+「越聊越卡」的前端半边）

问题链：ChatRoom 同时持有输入框 state 和全量消息列，`messagesNode` 无
memo、`MessageBubble` 无 memo、per-row 回调全是 render 里现造的闭包 ——
每敲一个字 / 每个 SSE chunk，N 条历史消息全树重渲染（含 react-markdown
重 parse）。

改法（三层 memo 链，**破坏任何一层都会静默回退到全列表重渲染**）：

- `ChatMessagesList.tsx`（新）：消息列 + 行组件，双层 `memo`。ChatRoom
  把行为传进来的所有 props 必须保持引用稳定 —— handler 一律 `useCallback`
  且内部通过 `messagesRef` / `submittingRef` 读实时值（依赖里放 `messages`
  会让 handler 每 chunk 换引用，链就断了）。
- `MessageBubble` / `MessageRenderer` / `RegexIframe` / `OpeningSlot` 加
  `memo`。MessageRenderer 是 markdown parse 的最后闸门。
- **history 走 `ChatHistoryContext`（ref 拉模式），不走 props**：
  `chat-history-context.ts`。history 数组每 chunk 变引用，作为 props 会击穿
  上面所有 memo。iframe Host API 的 `getHistory()` RPC 在调用瞬间读
  `ref.current`。预览场景（CharacterForm 沙盒 / PackPreview / PreviewCanvas /
  ReelSection）无 Provider，落回组件自己的 `history` prop（已改 optional）。

顺手修掉一个真 bug：`RegexIframe` 的 bridge effect 原来依赖
history/character，每来一条新消息 effect 重跑并 `port.close()` —— 已挂载
小剧场的 Host API 从第二轮对话起全部失联。现在 RPC 读值全走 ref，effect
零依赖，桥不死。

## 2. 流式节流

- `useChat` 加 `experimental_throttle: 80`（主发送路径，SSE 每 chunk →
  每 80ms 一次 React 更新）。
- 续写路径（`/api/chat/continue` 的手动 reader loop）用 rAF 合帧后再
  `setMessages`。

## 3. LLM 上下文滑窗（治「越聊越卡」的后端半边）

本分支原实现了 `windowModelContext`（按条数截断），合并时发现 main 已因
内存打爆事故并行落地了更完善的 `src/lib/ai/history-truncate.ts`
（`truncateHistory`：字符预算 + env 可调 + 钉住开场白 + user/assistant
交替规整 + 测试），冲突解决时**统一采用 main 的实现**，本分支的
context-window.ts 已删除。`/api/chat` 与 `/api/chat/continue` 都套用。
DB 永远存全量，窗口只影响模型 payload —— first-token 延迟和 token 成本
不再随会话长度线性涨。

调参走 env：`CHAT_HISTORY_CHAR_LIMIT`（默认 300K 字符）/
`CHAT_HISTORY_MIN_KEEP`（默认最少保留 20 条）。改大之前先想想 Anthropic
cache 写入成本（system prompt 有 cacheControl，历史轮没有）和 8G 机器的
内存预算（该模块引入的直接原因）。

## 4. debug_info 瘦身下发

`loadMessages(sessionId, withDebugInfo=false)`：非开发者视角把 jsonb 裁成
`{truncatedBySafety}`（所有用户都要的重试提示），完整体（rawOutput /
systemPrompt / 规则命中）只在 `isCurrentUserDeveloper()` 时取。长会话每行
几 KB 的 system prompt 不再随页面初始化整包搬运。链路：chat page 提前判
canDebug → 传 `{ withDebugInfo }` 进 `loadSessionById` /
`getOrCreateCharacterConversation`。

## 5. Auth 往返去重 + chat page 查询并行

- `src/lib/auth/auth-user.ts`（新）：`getAuthUser = cache(supabase.auth.getUser)`。
  Shell（全局 layout）、getCurrentUserId、getOptionalUserId、
  isCurrentUserDeveloper 全部收敛到同一趟回源 —— 之前每页请求 2-3 趟串行
  Auth 往返。**新增「当前用户是谁」的查询请一律经由这几个入口，不要再直接
  `createClient().auth.getUser()`。**
- chat page 里 rules / opening / mask / css / me 五路无依赖查询从串行 await
  改 `Promise.all`。

## 已知未做（后续候选）

- 消息分页 + 列表虚拟化（react-window / virtuoso）：几百条消息的 DOM 体量
  治本方案，改动大、与贴底滚动 / ResizeObserver 逻辑纠缠，单独立项。
- 探索页 likes/favorites 的 correlated 子查询反规范化（涉及迁移）。
- iframe 小剧场的 IntersectionObserver 懒挂载。

## 验证

`bun run typecheck` / `biome check` / `bun test`（278 pass）全绿。
