# 产品思考：为什么选择 `single-master-v1`

**状态：** 第一阶段基线已确定
**技术交接：** [`docs/handover/master-prompt.md`](../handover/master-prompt.md)
**首发语言：** 繁体中文、日语、泰语

## 决策

Dearm 后续以上游数据包里的 `single-master-v1` 作为固定 AI instruction 的 canonical 语义基线。平台只同步经过结构化和重建验证的 master、instruction units 与 provenance，不导入线上日志或角色卡语料。

这个决定解决的是“平台固定 prompt 到底以哪一套为准”，不是把历史角色内容搬进 Dearm。角色的 persona、opening、样例、剧情和输出格式仍由 creator 提供，并通过六个稳定槽位进入 master。

## 为什么不是“拿最新一条日志”

日志时间最新不等于角色聊天模板最新：采集尾部包含非角色请求，单条请求也可能是实验版本或低频变体。`single-master-v1` 采用“至少被 100 个 prompt 使用，再取其中最新模板”的门槛，选中的源 master 覆盖 738 条 canonical prompt，既保留新版本，也过滤一次性噪声。

更重要的是，它把 3,783 套历史 shell 拆成固定 instruction 与角色内容，再用一个 master 重组。验证结果不是“文本看起来差不多”，而是可复现的逐条重建：

| 证据 | 结果 |
|---|---:|
| canonical 角色 | 10,839 |
| immediate reconstruction | 10,839 / 10,839 |
| persisted reconstruction | 10,839 / 10,839 |
| 被收敛的历史 shell | 3,783 |
| master instruction units | 174 |
| 顶层角色槽位 | 6 |
| 含 supplemental context 的角色 | 3,892 |
| 迁移的辅助块 | 3,550 |
| 迁移的自定义行 | 26,298 |

这说明角色差异能够留在卡片侧，平台 instruction 可以独立版本化。对 creator 友好的价值也在这里：自定义 HTML、CSS、JavaScript、标签、变量和 replacement token 不需要为了换 master 被重新清洗或改写。

## 为什么首发三语先共用英文 instruction units

静态 master 已有一套完整、reviewed 的英文翻译：174 / 174 units 通过校验，且没有残留 CJK。角色内容翻译则远未达到可发布覆盖率；当前权威库按 `role-content-codex-v1` 统计如下：

| 目标 locale | 已验证 role-content units | 总 role-content units | 覆盖率 |
|---|---:|---:|---:|
| `zh-Hant` / `zh-TW` | 0 | 844,733 | 0% |
| `ja-JP` | 808 | 844,733 | 0.0957% |
| `th-TH` | 726 | 844,733 | 0.0859% |

因此，现阶段把少量日语或泰语样本当作“已本地化角色库”会制造混合语言、风格漂移和结构损坏。旧的 `role-local-v1` 还是另一套实验 policy，不能与上述数字混用来虚增覆盖。

第一阶段采用两层策略：

- 简中会话使用 canonical 简中 instruction units。
- 繁中、日语、泰语和英语会话使用完整的 reviewed 英文 instruction units，再单独要求模型以目标语言自然输出，同时原样保护代码与结构标识。

这不是“用英文替代产品本地化”。它只是让模型可靠理解平台规则；角色卡内容仍保留 creator 原文，不做未经验证的批量机翻。界面文案、探索页元数据和未来的角色内容本地化是另外三条产品链路，应分别验收。

## 接受的风险

- **语言质感：** 英文 instruction 配合目标语言输出约束，可能在繁中、日语、泰语里产生语气或文化习惯偏差。
- **卡片可发现性：** creator 原文不自动翻译，非原语言用户仍可能看不懂角色介绍、开场和设定；这不是 runtime prompt 能单独解决的问题。
- **样本偏差：** “至少 100 次使用”的选择规则代表已采集语料中的广泛部署版本，不代表所有模型、题材和未来卡片的全局最优。
- **来源可追溯性：** 上游数据包没有 Git 历史，必须依赖 ID、哈希、部署区间和生成器共同证明来源。
- **消息角色差异：** 采集数据没有保留 provider 传输角色。Dearm 目前把 master 放在首条 user frame；这是工程适配，仍需跨 provider 回归。
- **成本与上下文：** single master 较长，会占用输入 token，并让不同 provider 的缓存策略直接影响成本与延迟。
- **资产与隐私：** 原始日志、角色卡和分析数据库含用户内容及 creator prompt IP；任何为了“方便调试”的复制都会破坏数据边界。
- **版本覆盖：** 当前同步器写死 v1 目标目录。若未来直接覆盖原目录，会让回滚和线上归因失真。

## 后续路线

1. 建立繁中、日语、泰语 golden set，覆盖普通对话、长卡、宏替换、HTML/CSS/JS、regex guidance、续写和多 provider；评价输出语言、角色一致性与格式保真。
2. 指标只记录 adapter version、template ID/hash、instruction locale、response locale、token、延迟和聚合质量信号，不采集完整 prompt 或私聊正文。
3. native instruction 翻译必须在 174 / 174 units 完成翻译、review 和结构校验后，以新的 locale policy 和版本发布；未达标前继续走英文 instruction，不混用半套翻译。
4. 角色内容本地化另立项目：先确定 creator 授权、目标市场优先级、代码/标记保护和人工抽检，再扩大覆盖。现有日语、泰语记录只作为 pilot/golden samples。
5. 对首条 user frame 与真正 provider system instruction 做同输入 A/B，至少比较 DeepSeek、Claude、Gemini 的指令遵循、缓存命中、输入成本和续写一致性。
6. 下一次 canonical 语义或选择规则变化时发布 `single-master-v2`，保留 v1 资产与可回退路径，不在原目录原地更新。
