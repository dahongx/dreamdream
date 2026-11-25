# Conversation Rewind / Fork — Handover

> Companion: [insights/conversation-fork.md](../insights/conversation-fork.md)
>
> Builds on the session lifecycle in [sessions.md](./sessions.md) and the
> render path in [chat-pipeline.md](./chat-pipeline.md).

「回到某节点重说演绎」。用户挑一条**自己说过的话**，从那里重新分叉；
该节点及其之后的消息从对话里消失，但底层日志**不删**。

## 数据模型

唯一新增字段（migration `drizzle/0013_message_superseded_at.sql`，additive）：

```
messages {
  ... 既有字段 ...
  superseded_at  timestamptz nullable   -- NULL = 活跃；非空 = 被 fork 归档
}

index messages_session_active_idx ON (session_id, created_at) WHERE superseded_at IS NULL
```

`superseded_at` 是**软归档标记**，不是删除。所有读取活跃路径的查询都加
`superseded_at IS NULL` 过滤；partial index 让热路径不被旧分叉拖慢。

无 `parentId` / 分支树 / 兄弟切换 —— 任意时刻只有一条线性活跃路径
（活跃前缀 + 最新续写），归档行是被遗弃的尾巴。

## 后端

| 位置 | 改动 |
|------|------|
| `src/lib/sessions/queries.ts` `loadMessages` | 加 `isNull(supersededAt)` 过滤 |
| `src/lib/sessions/queries.ts` `forkSessionAtMessage` (新) | 核心 fork 逻辑，见下 |
| `src/lib/sessions/queries.ts` `listSavedSessions` | `count(messages.id)` 的 join 加 `isNull(supersededAt)`，归档行不计入历史会话条数 |
| `src/app/api/chat/route.ts` regenerate | `latestAssistant` 查询加 `isNull(supersededAt)`，防止 regenerate 复活归档的 AI 回复 |
| `src/lib/sessions/actions.ts` `forkAtMessageAction` (新) | server action 薄封装：鉴权 → 调 query → `revalidatePath` |

### `forkSessionAtMessage(sessionId, userId, keepCount)`

`keepCount` = fork 目标（用户消息）在**活跃消息序列**里的下标。

1. 校验 session 属于 userId。
2. 取活跃消息（`superseded_at IS NULL`）按 `created_at asc` 的 `{id, role}`。
3. 守卫：`keepCount ∈ [1, len)`；越界 → no-op `{ ok:false, archived:0 }`。
4. **只 fork 用户输入**：`rows[keepCount].role` 必须是 `"user"`，否则拒绝。
5. `UPDATE messages SET superseded_at = now() WHERE id IN rows[keepCount..]`。
6. 更新 `chatSessions.lastMessageAt`，返回归档条数。

**不变量**：fork 只发生在用户消息上 → 保留 `[0, keepCount)`、归档
`[keepCount, …]` → 对话总是停在一条 assistant（或开场白）上，随时可接下一句。

## 前端

- **序数对齐**：客户端传 `keepCount`（消息数组下标），服务端按 `created_at asc`
  取活跃消息用同一下标。绕开「本会话流式消息的 SDK id 与 DB 行 id 不一致」
  的坑（同 `debugMetaMap` 的已知限制）。成功后客户端
  `setMessages(prev => prev.slice(0, keepCount))`，无需整页刷新。

- `src/components/chat/ChatRoom.tsx`
  - `useChat` 解构 `setMessages`；新增 `reviewOpen` state。
  - `onForkToMessage(keepCount)`：守卫 `submitting` → `window.confirm`（显示将
    移除 N 条）→ `forkAtMessageAction` → `setMessages` slice。
  - `messages.map` 里仅给 `role==="user" && !submitting` 的气泡绑 `onFork`。
  - header 加 `#nj_review_btn`（History icon）开回顾抽屉；底部挂
    `<ChatReviewDrawer>`，`reviewNodes` 由实时 `messages` 派生。
  - fork 成功后先调用 `prepareForHistoryTrim()`，同步释放流式结束时用于防跳
    的消息列 `min-height`，再裁剪本地 messages；否则会出现“消息没了但原高度
    仍是空白”的幽灵留白。详见 [chat-generation-controls.md](./chat-generation-controls.md)。

- `src/components/chat/MessageBubble.tsx`：新增 `onFork?: (() => void) | null`
  prop。**仅用户气泡**渲染 hover 浮出的 `.nj_user_message_fork_btn`「回到这里」。

- `src/components/chat/ChatReviewDrawer.tsx`（新）：从右滑入的「对话回顾」抽屉，
  镜像 `ChatSessionsDrawer`（portal / backdrop / ESC / 锁滚动）。列出每条用户
  发言为 fork 节点（`.nj_review_node` + `.nj_review_node_fork_btn`），含其后
  AI 回应的纯文本预览（剥语义标签）。

## selector 契约（新增 nj_）

`#nj_review_btn` · `#nj_review_drawer` · `.nj_review_node` ·
`.nj_review_node_fork_btn` · `.nj_user_message_fork_btn`

## i18n

`src/i18n/types.ts` 的 `Dict.chat` 加 key（zh + en 同步）：`forkInline`
`forkConfirmFmt` `forkToastDone` `forkFailed` `reviewTriggerAria` `reviewTitle`
`reviewSubtitle` `reviewClose` `reviewEmpty` `reviewForkBtn` `reviewReplyPrefix`
`reviewNoReply`。

## 验证

- typecheck + biome + `bun test`（128 pass）全绿。
- 对真实 dev DB 的集成验证（9 项断言全过）：软归档语义、停在 assistant、
  非破坏保留、三道守卫（fork@assistant 拒绝 / 越界拒绝 / 非 owner 拒绝）。

## 已知限制 / 后置

- 归档分叉**当前不可浏览**。诉求是「底层日志非破坏」，不是分叉切换。未来若要
  浏览/撤销旧分叉，加一个非破坏的 `branchId` 迁移即可，本方案不挡路。
- 本地 dev DB 缺 Supabase `auth` schema，导致 `bun run db:migrate` 跑到 0011
  会停（历史遗留，与本功能无关）；0013 已直接对 dev DB 应用并记入
  `__nimir_migrations`。线上 Supabase 栈有 auth schema，`db:migrate` 正常。
