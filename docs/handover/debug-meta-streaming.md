# Debug Meta Streaming — Handover

> Companion: [insights/debug-meta-streaming.md](../insights/debug-meta-streaming.md)
>
> Builds on the streaming pipeline in [chat-pipeline.md](./chat-pipeline.md);
> the security boundary is the developer allowlist in
> `src/lib/auth/dev-allowlist.ts`.

让聊天页的 **DebugPanel 在流式生成结束后立即出现，无需刷新**。此前 debug
信息只在 RSC 渲染时从 DB 注入一次，新消息要刷新页面才看得到。

## 问题根因（修复前）

`debugMetaMap` 在 `src/app/chat/[characterId]/page.tsx` 渲染时构建一次，作为
静态 prop 传给 `ChatRoom`。`/api/chat` 的 `onFinish` 把 `debug_info` 写进 DB，
但 `toUIMessageStreamResponse()` 的流**只回传正文文本**，debug 一个字节都没回。
客户端按 message id 查 map → 新消息查不到 → 只能靠刷新让 RSC 重查 DB。

## 修复架构

debug 元数据随流回传，走 AI SDK v6 的 **message-metadata** 通道。

### 共享类型 — `src/lib/chat/debug-meta.ts`（新增）

`DebugInfo` / `DebugMeta` 从组件层挪到 lib 层，让 server route 不必反向 import
客户端组件。新增 `ChatUIMessage = UIMessage<DebugMeta>` 贯穿全链路。

### 服务端 — `src/app/api/chat/route.ts`

1. 取 user 时加选 `email`，`const canDebug = isDeveloperEmail(user?.email)`。
2. `streamText` 前声明一个 promise：

   ```ts
   let resolveDebug: (meta: DebugMeta | null) => void = () => {};
   const debugReady = new Promise<DebugMeta | null>((r) => { resolveDebug = r; });
   ```

3. `onFinish` 末尾（DB 写入后）`resolveDebug(canDebug ? payload : null)`。
   payload 复用 onFinish 已算好的 debug / tokens / cost / latency，零重复计算。
4. 把返回从 `result.toUIMessageStreamResponse()` 换成 `createUIMessageStream`：

   ```ts
   const stream = createUIMessageStream<ChatUIMessage>({
     execute: async ({ writer }) => {
       writer.merge(result.toUIMessageStream<ChatUIMessage>());
       const meta = await debugReady;
       if (meta) writer.write({ type: "message-metadata", messageMetadata: meta });
     },
   });
   return createUIMessageStreamResponse({ stream });
   ```

   `createUIMessageStream` 保持流开启直到 `execute` resolve —— 先转发全部模型
   输出，再 await debug payload，最后写 metadata。顺序确定，无竞态。

### 客户端 — `src/components/chat/ChatRoom.tsx`

- `useChat<ChatUIMessage>(...)`，`initialMessages: ChatUIMessage[]`。
- 渲染 fallback 链：`m.metadata ?? debugMetaMap[m.id]`。流式消息走自带
  metadata；历史（RSC）消息走 map。两条路并存。

## 安全边界（核心）

DebugInfo 含 `systemPrompt`（拼装后的 host 级 prompt，属不可外泄资产）。三层
门控，任一层失守其余仍挡：

1. **服务端 route**：`resolveDebug(canDebug ? payload : null)` —— 非白名单
   **流里根本不写任何 debug 字节**。这是最硬的一层（在数据离开服务器之前）。
2. **页面 RSC**：`debugMetaMap` 仅对 `canDebug` 填充（既有逻辑，未改）。
3. **UI toggle**：DebugPanel 仅在 `canDebug && debugMode` 时挂载（既有逻辑）。

`canDebug = isDeveloperEmail(email)`，配置走 `NIMIR_DEBUG_EMAILS` 环境变量，
prod 默认空。**严禁把该 env 配进 prod**（白名单 email 能看任意卡的 system
prompt，含 creator 的 persona / opening 等 prompt 资产）。

## 必须settled的退出路径

`debugReady` 不 resolve，`execute` 永远 await，流挂死。三条路径都要 settle：

- 成功路径：onFinish 末尾 `resolveDebug(...)`。
- 安全截断早返回（`safetyBlocked && text.length === 0`）：`resolveDebug(null)`。
- `onError`：`resolveDebug(null)`。

## 影响文件

| 文件 | 改动 |
|------|------|
| `src/lib/chat/debug-meta.ts` | 新增：`DebugInfo` / `DebugMeta` / `ChatUIMessage` |
| `src/app/api/chat/route.ts` | promise + `createUIMessageStream` 包流 + canDebug 门控 |
| `src/components/chat/ChatRoom.tsx` | `useChat<ChatUIMessage>` + metadata fallback |
| `src/components/chat/DebugPanel.tsx` | `DebugInfo` 改 import 自 lib |
| `src/app/chat/[characterId]/page.tsx` | 类型改 import 自 lib，`toUIMessage` 标注 |

无 DB / migration / i18n 改动。

## 验证

- 开发者账号：发消息 → 不刷新即见 debug 面板；regenerate 同样即时。
- 非白名单账号：SSE 流里**无** systemPrompt / debug 字段；面板与 toggle 不出现。
- `bun test`（264 pass）+ typecheck + biome 全绿。
