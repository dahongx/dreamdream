# 产品思考：为什么把 system prompt 1:1 对齐上游

**状态：** 已落地
**技术交接：** [`docs/handover/system-prompt-alignment.md`](../handover/system-prompt-alignment.md)
**关联：** [`docs/insights/chat-pipeline.md`](./chat-pipeline.md) · [`docs/insights/player-masks.md`](./player-masks.md)

---

## 决策背景

拿到上游一次真实调用的完整组装上下文（`temp.md`）后，拆出三类内容：A 平台 host frame、B 角色卡槽位、C 运行时注入。结论是我们的骨架和上游高度同构，差距在 host frame 的**厚度**——对方把「创作禁令 / 创作技巧 / 自查清单 / SCAN / 机密保护」写成大段可执行文字，而我们只有抽象原则。

「效果好」的 80% 不在玄学，在两点工程：
1. **把质检从原则升级成枚举 + 逐条自查**：LLM 对「禁用词表 + 信息密度门槛 + 输出前 7 项自查」的反应，远好于「避免言情套话」这种抽象话。
2. **状态栏/记忆机制**：本质是创作者用 `outputSetting` + 美化(regex)层搭的，不是平台功能——这正中我们 creator 友好定位。本次只动平台层，状态栏留给创作者。

用户拍板：连原文一起照搬（含破限咒），缺的模块留空占位。

## 为什么照搬而不是「取其精华」

- 我们对标竞品，差异化在 creator 工具链而非 host frame 文风。host frame 这层「抄到位」比「自研更好」性价比高得多。
- 上游原文有内部矛盾（禁破折号但开场白在用，等），照搬即接受——这些矛盾靠冗余轰炸反而稳。清洗是后续可选项，不是现在的事。

## 关键取舍

- **成本换确定性**：host frame 涨到 ~8.5k token，默认 DeepSeek 无缓存每轮全额付。接受，因为这是上游的真实代价，且体验差距值这个钱。留了 `INJECT_EVERY_TURN` 旋钮和「可裁剪重段」的后路。
- **面具双重注入**：系统层结构化 `<UserInfo>` + 每轮 user 块重复，对齐上游。代价是 token，收益是玩家身份贴着每条台词、recency 强。
- **`$指令` 走纯 prompt**：不写解析器。上游也只是「告诉模型约定」，把 OOC 判读交给模型——保持了零代码耦合，玩家怎么写 `$`/括号都不会被我们误伤。

## 边界（本次明确不做）

- 物品系统 / 世界书 / 向量召回 / 滚动摘要：只留占位标签。
- 状态栏/记忆模板：属创作者 `outputSetting` 内容，平台不写死。
- 清洗上游原文矛盾。

## 后续可回收的钩子

- 占位标签（`<WorldLore>` / `<RecalledFragments>` / `<RecentHistory>` / `<ItemSystem>`）已经在 prompt 里占位，做对应 feature 时直接往里填，不用再动结构。
- 若成本压力大：先验证中转层 DeepSeek caching → 再考虑 `INJECT_EVERY_TURN=false` → 最后才考虑裁剪 §三/自查。
