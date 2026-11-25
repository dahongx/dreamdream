# 技术交接：system prompt 1:1 对齐上游结构

> **已于 2026-08-02 被结构化 single-master 基线取代。** 本文保留作历史记录，现行实现与运维命令见 [master-prompt.md](./master-prompt.md)；不要再按本文的 `render-protocol.ts` 常量或空占位方案开发。

**状态：** 已落地（feat/prompt-alignment）
**最后更新：** 2026/07/01
**产品思考：** [`docs/insights/system-prompt-alignment.md`](../insights/system-prompt-alignment.md)
**关联：** [`docs/handover/chat-pipeline.md`](./chat-pipeline.md) · [`docs/handover/player-masks.md`](./player-masks.md) · [`docs/contracts/chat-render-spec.md`](../contracts/chat-render-spec.md)

---

## 1. 做了什么

把 `/api/chat` 组装给模型的 system prompt，从原来寄情自有的 4 段 host frame，重排+扩写成 **1:1 对齐上游**的段落分块与顺序，host-frame 文字逐字照搬自上游的真实组装上下文（调研样本 `temp.md`）。同时把**玩家面具 + `$指令` 的注入方式**也对齐上游的「每轮 user 消息包装」。

我们还没有的模块（物品系统 / 世界书 / 向量召回 / 滚动摘要）以**空占位标签**形式保留结构位，feature 落地后再填。

## 2. 段落顺序（host frame，照搬上游 temp.md §[0]）

`buildSystemPrompt`（`src/lib/ai/build-prompt.ts`）按此顺序拼接：

| 段 | 来源常量（`render-protocol.ts`） | 类别 |
|---|---|---|
| 创作权限全域解锁 / 艺术豁免权 / 强制设定（破限咒） | `CREATIVE_UNLOCK` | A 平台照搬 |
| 系统设定 / 创作定位 / 原则 / 文学深度 / 叙事立场 | `SYSTEM_FRAME` | A |
| 思维链隐藏 / 输出纯净化 | `COT_HIDING` | A |
| 一、核心原则 | `CORE_PRINCIPLES` | A |
| 二、创作禁令 | `CREATION_BANS` | A |
| 三、创作技巧 | `CRAFT_TECHNIQUES` | A |
| 渲染协议（标签合约） | `RENDER_PROTOCOL` | A |
| 四、角色设定架构概述 + 槽位 | `CHARACTER_ARCH_INTRO` + `SLOT_INTRO` | A 框 + B 槽 |
| 五、用户系统 + `<UserInfo>` | `USER_SYSTEM_FRAME` + 面具结构化字段 | A 框 + B |
| 六、对话历史 + 召回/摘要空占位 | `CONV_HISTORY_FRAME` | A 框 + C 占位 |
| 七、执行与检查 | `EXECUTION_CHECK` | A |
| SCAN 威胁扫描 | `SCAN_TABLE` | A |
| 自查清单 | `SELF_CHECK` | A |
| 机密保护协议（收束 host frame，紧贴 creator 原文之后） | `SECRECY_PROTOCOL` | A |

§四槽位顺序对齐 temp.md 4.2→4.9：`<CharaPrompt>`(persona) → `## 默认认知` → `<Greeting>`(opening 的 scenario/system) → `<OutputSetting>` → 扩展标签协议(regex) → `<StyleSamples>` → `<PlotSetting>` → `<ItemSystem>`(空) → `<AdversityHandling>` → `<WorldLore>`(空)。

## 3. 移植时的三处偏离（必须知道）

1. **名字 → 宏**：temp.md 是渲染后的实例，含具体名字。移植时 `托斯卡·Perez → {{char}}`、`南安 → {{user}}`，由 `interpolate` 在拼接末尾统一替换。**host frame 现在含宏**（破限咒 / SYSTEM_FRAME / CREATION_BANS / SCAN 表里都有），这是与旧版「host frame 不含宏」的唯一区别。
2. **性别中性化**：上游破限咒写死「user 为成年女性」会盖掉每会话面具性别，改成「成年人」，性别交给面具。
3. **markdown 装饰去除**：代码围栏 / 行内反引号去掉以保持合法 TS 模板字符串，文字内容不变。

## 4. 面具 + `$指令` 注入（双重）

玩家身份**双重出现**，对齐上游：

- **系统层**：§五 `<UserInfo>` 结构化字段（UserName/UserGender/UserDescription/UserHobby ← `mask.name/gender/description/preference`）。`buildUserInfoSection`（build-prompt.ts）。UserName 始终解析（面具名→账号名→兜底）。
- **每轮 user 消息**：`src/lib/ai/player-turn.ts` 的 `wrapPlayerTurn` 包装为
  「OOC 约定头 + 自由面具块 + `mask.instruction`（standing `$指令`）+ `📝 玩家剧情/台词输入` + 尾部格式提醒」。

铁律：
- **不落库**：包装只在请求组装时加（`route.ts` 的 `modelMessages` map / `continue/route.ts` 构造 map 的 user 分支），DB 里 user 消息存原始文本。edit/delete/续写前缀都不受影响。
- **`$指令` 纯 prompt**：不写 parser、不 strip。靠约定头 + host §五「用户输入理解」让模型识别 OOC。玩家内联 `$.../(...)` 原样保留。
- **`INJECT_EVERY_TURN`**（player-turn.ts 常量，默认 `true`）：每条 user 消息都包装（1:1 复刻上游）。改 `false` 则只包最新一条，省多轮重复 token。

## 5. 改了哪些文件

- `src/lib/ai/render-protocol.ts` —— 全量重写为上游段落常量 + `SLOT_INTRO` + 保留 `RENDER_PROTOCOL`。
- `src/lib/ai/build-prompt.ts` —— 重排 `parts`；`slot()` 具名标签包装；`buildUserInfoSection`；删 `buildPlayerInstructionSection` / 旧 `buildPlayerPersonaSection`。`parseOpening` / `interpolate` / `resolveUserName` 未变（`sessions/queries.ts` 仍 import 这三个）。
- `src/lib/ai/player-turn.ts`（新）—— `wrapPlayerTurn` / `buildMaskBlock` / `extractModelMessageText` / 常量。
- `src/app/api/chat/route.ts` —— convert 后 map 包装 user 消息。
- `src/app/api/chat/continue/route.ts` —— 构造 `modelMessages` 的 user 分支包装。
- 测试：`build-prompt.test.ts` / `prompt-guidance.test.ts` 重写；新增 `player-turn.test.ts`。

## 6. 成本（重要）

- host frame 从 ~1.5k 涨到 **~8.5k token**（空卡基线，实测 `buildSystemPrompt` 输出 ~14.4k 字符）。
- **默认模型 DeepSeek V4 Pro 无 ephemeral cache**（`route.ts` 只对 `claude-*` 开缓存），每条消息全额付 host frame。这是本次最大成本项。
- 面具块每轮重复（`INJECT_EVERY_TURN`）随轮数线性增长。
- 缓解方向（未做）：确认中转层是否支持 DeepSeek prompt caching；或把最重的 §三技巧/自查做成可裁剪；或 `INJECT_EVERY_TURN=false`。

## 7. 验证

- `bun run typecheck` 干净；`bun test` 全绿（274）。
- 结构顺序 / 宏替换 / 包装形态：已用临时脚本打印核对（见 insights）。
- **待手动冒烟**：dev 起服务，owner 调试面板发一条带面具的消息，核对 system prompt 13 段顺序、每轮 user 包装、DB 内 user 消息仍为原文；DeepSeek/Claude 各跑一轮看 `tokens_in`/`cache_read`。
