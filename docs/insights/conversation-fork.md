# Conversation Rewind / Fork — Insights

> Companion: [handover/conversation-fork.md](../handover/conversation-fork.md)
>
> 生成控制与回溯留白修复见
> [chat-generation-controls.md](./chat-generation-controls.md)。

## 为什么是「软归档 fork」，不是「删除」，也不是「分支树」

需求最初被描述成「想回到某节点，一条条删太费劲」。三种实现摆在面前：

1. **硬删截断**：选中点之后 `DELETE`。最省事，但用户的措辞「一条条删费劲」
   本意是「我接受删，只是嫌麻烦」—— 而进一步确认时用户改口了：对用户看着像
   删，但**底层日志不能破坏**。硬删出局。
2. **分支树（parentId + 兄弟切换，ChatGPT 式）**：最强，但要改 schema、加
   active-leaf 指针、加兄弟切换 UI。用户的诉求是「日志别丢」（审计/数据完整），
   不是「浏览旧分叉」。为一个没被要的能力上大工程，违背 v1 砍核心。
3. **软归档（采用）**：加一个 `superseded_at` 标记，读取处全过滤。一列 additive
   迁移 + 几处查询加 `IS NULL` 就够。对用户：截断的观感。对日志：完整保留。

软归档是「忠实满足需求的最小实现」—— 这是本仓库一贯的取舍轴。

## 为什么 fork 只挂在用户消息上

用户明确说「Bot 返回的这些气泡不太好 fork」。这不只是产品口味，背后有结构原因：

- roleplay 的自然回退点是**用户的选择**（「我当时要是这么说会怎样」），而不是
  AI 的某句叙述。fork 用户消息 = 「这句我重说」，语义干净。
- 若允许 fork AI 气泡，截断后对话会停在一条用户消息上（无 AI 回应）——
  悬空状态，得立刻补一次生成，体验拧巴。
- 只 fork 用户消息天然保证**回退后永远停在 assistant（或开场白）上**，
  即「准备好接你下一句」的稳定态。这条不变量让两个 UI 入口都不用处理边界。

服务端用 `rows[keepCount].role === "user"` 兜底，不信任前端。

## 为什么按「序数」对齐，不按 message id

聊天页的消息 id 有个历史裂缝：DB 行 id 在页面加载时映射进 `UIMessage.id`，但
**本会话流式产生、尚未刷新的消息**用的是 AI SDK 生成的临时 id，跟 DB 行对不上
（`debugMetaMap` 也踩这个坑，靠刷新水合）。

如果 fork 用 message id 回查 DB 行，刚聊出来还没刷新的消息就 fork 不了。改用
**序数**（保留前 N 条）：客户端和服务端都按 `created_at asc` 取活跃消息，同一个
下标指同一条。客户端 `setMessages(slice(0, keepCount))` 与服务端 UPDATE 天然
对称，连刷新都省了。

## 确认弹窗 vs 撤销

当前用 `window.confirm`。因为软归档其实可逆（数据还在），理论上更好的是「先执行
+ 给个撤销 toast」。但撤销需要一条 un-supersede 路径和 toast 基建，是独立的一块。
本期先用 confirm 把「会移除 N 条」说清楚；撤销作为廉价的后续升级（数据已具备）。

## 留给未来的钩子

`superseded_at` 让旧分叉在库里完整存活。哪天真要做「分叉历史浏览 / 树状切换」，
补一个非破坏的 `branchId` 迁移就能把这些归档行重新组织成可浏览的分支 —— 当下的
最小实现没有堵死这条路。
