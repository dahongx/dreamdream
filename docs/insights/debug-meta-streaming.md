# Debug Meta Streaming — Insights

> Companion: [handover/debug-meta-streaming.md](../handover/debug-meta-streaming.md)

## 为什么是「随流回传」，不是「刷新后重取」

bug 的观感是「debug 要刷新才出来」。三种修法摆在面前：

1. **流式结束后客户端再发一个请求拉 debug**（server action `getLatestDebug`）。
   安全门控很干净（独立端点服务端判 `isDeveloperEmail`），但有个硬伤：**id
   对不上**。DB 里的 assistant 消息是服务端 uuid，客户端 `useChat` 流式生成的
   消息是 SDK 自己造的 id。要把 debug 贴回正确的气泡，只能按「assistant 第几条」
   做位置对齐 —— 一旦掺进 regenerate / 编辑 / 删除 / fork 就脆。
2. **`messageMetadata` 回调**（`toUIMessageStream({ messageMetadata })`）。看着
   最顺，但它在 `finish` part 上**拿不到正文文本**，而我的 debug 需要 regex
   匹配结果（要全文）。用闭包变量从 `onFinish` 取又和回调本身竞态。出局。
3. **`createUIMessageStream` 包流 + 尾随 message-metadata chunk**（采用）。
   metadata 随消息走，**id 自动对齐**（SDK 把 metadata merge 进当前流式消息），
   regenerate / fork 都不用管。竞态用「先转发模型流，再 await debug，再写
   metadata」这条确定顺序消掉。

第 3 种赢在 **id 关联是 SDK 帮你做的**，而不是你按位置硬猜。这正是第 1 种再
怎么干净也躲不掉的债。

## 为什么竞态是真问题，不是杞人忧天

读了 `ai` 包源码确认：`messageMetadata` 回调在 fullStream 的 transform 里**同步**
触发，而 `streamText` 的 `onFinish`（做 DB 写、算 cost）是另一个消费者、异步。
`finish` part 流过 transform 时，`onFinish` 很可能还没跑完。所以「onFinish 写
闭包变量、messageMetadata 读」必然偶发读到空。`createUIMessageStream` 让我显式
`await debugReady`，把不确定的顺序变成确定的顺序 —— 这是选它的根本原因。

## 安全：把门设在「数据离开服务器之前」

DebugInfo 带 `systemPrompt`，是 host 级 prompt 工程的原文，creator 拿到就能
反推整套渲染协议。本仓库对 prompt 资产是零容忍外泄。

关键决策：**非开发者的 debug payload 根本不进流**（route 里 `canDebug ? payload
: null`），而不是「传到前端再藏起来」。前端藏（CSS hidden / 条件渲染）永远能被
扒 Network 面板看到 SSE 原文。门设在序列化之前，wire 上就没有这些字节 —— 这是
唯一可信的位置。UI toggle 和 RSC map 的门是冗余防御，不是主防线。

## 顺带暴露的一致性债（未在本次处理）

`truncatedBySafety`（被安全策略截断、提示换模型重生成）面向**所有**用户，但它
今天也走 RSC 注入，同样有「刷新才出现」的毛病。本次只修 debug（用户的原始诉求 +
安全敏感的那块），没顺手把 truncated 也搬上流 —— 那是另一条线（受众不同、门控
不同），合进来会模糊这次改动的边界。留作 follow-up。
