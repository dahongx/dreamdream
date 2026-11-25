# 技术交接：canonical single-master prompt

**状态：** 已接入
**版本：** `dearm-single-master-v1`
**产品决策：** [`docs/insights/master-prompt.md`](../insights/master-prompt.md)
**历史实现：** [`docs/handover/system-prompt-alignment.md`](./system-prompt-alignment.md)

本文是当前 prompt 基线的技术来源。旧的 system-prompt 对齐文档只保留迁移历史；当两者冲突时，以本文、仓库内版本化资产和测试为准。

本基线管的是角色聊天与续写的 canonical role-play prompt。`src/lib/ai/generators/prompts/` 中的美化、CSS、图片 prompt 等文件是 creator 工具的密封任务说明，不属于 canonical 六槽 master；它们可以演进自己的技术约束，但不得重新定义聊天主模板。

## 1. Canonical source

上游数据包不是 Git 仓库，因此不能用 commit SHA 标识来源。当前基线由模板 ID、内容哈希、部署区间和生成脚本共同固定。

| 角色 | 当前来源 |
|---|---|
| canonical 结构 | 相邻数据仓库 `../prompt-source/prompt-blocks-single-template/master_template.json` |
| 单元、翻译与重建证据 | 同目录 `prompt_blocks.sqlite3` |
| 合并统计 | 同目录 `stats.json` |
| 英文校验统计与 reviewed render | 同目录 `master_template.en.stats.json`、`master_template.en.md` |
| 生成逻辑 | 相邻数据仓库 `../prompt-source/consolidate_prompt_templates.py` |
| Dearm 同步器 | [`scripts/sync-master-prompt.ts`](../../scripts/sync-master-prompt.ts) |
| Dearm 版本化快照 | `src/lib/ai/prompts/single-master-v1/` |

`single-master-v1` 的“最新”不是全部线上请求里时间最晚的一条，而是角色去重语料中“至少出现于 100 个 prompt 的模板里，选择最新版本”。被选中的源模板部署于 738 条 canonical prompt；原始日志尾部还混有非角色请求，不能直接拿“最后一条日志”替代它。

### 固定版本与哈希

| 项目 | 值 |
|---|---|
| canonical policy | `single-master-v1` |
| 英文 instruction policy | `single-master-en-v1` |
| Dearm adapter | `dearm-single-master-v1` |
| consolidated template ID | `t_74f21ea242914b7a8ddbd4b12e808ee9d74a4277e73ebeffb9104b0eddef77f4` |
| source master template ID | `t_b8f1731a638a645e1ceaa13438a8e44e4a4aa5fad2a5b30933639062decb6bb2` |
| `master_template.json` SHA-256 | `a507d70c79646760bf01956c2ecd78d8eea461f46665526d31ddf6311c3652a8` |
| runtime bundle SHA-256 | `fdc0f545b7cc43076a318c39b718e546d9bd7d941f06eadbedce000bb56b5840` |
| rendered source SHA-256 | `88be21b990d4f5e517a32ee580b006db3216be5063b06f68450b0d7bbe843f36` |
| rendered English SHA-256 | `aa138a3d16da344e1fa78b10f6afdea261943f7e4326e8c80b41673185d4de8f` |
| 完整重建验证 | immediate `10,839 / 10,839`；persisted `10,839 / 10,839` |

仓库内 [`provenance.json`](../../src/lib/ai/prompts/single-master-v1/provenance.json) 是运行时可读的来源清单。它还固定 361 个结构 piece（181 literal、174 instruction unit、6 role section）、2 个角色名槽位及六槽顺序。

## 2. 同步与校验

同步器默认从仓库相邻的 `../prompt-source/prompt-blocks-single-template` 读取。若数据包不在默认位置，显式传 `--source`；不要把源数据库复制进本仓库。

```bash
# 只校验：重新从外部数据包构造结果，与仓库快照逐字比较
bun run prompt:check

# 显式指定数据包位置进行校验
bun scripts/sync-master-prompt.ts --check --source /absolute/path/to/prompt-blocks-single-template

# 确认来源版本后才执行同步
bun run prompt:sync
```

`prompt:sync` 只生成四个可提交文件：

- `master-template.json`
- `master-units.zh-Hans.json`
- `master-units.en.json`
- `provenance.json`

同步器会校验 schema/status、模板 ID 与数量、10,839 条双重重建结果、六槽顺序、174 个中英文 instruction unit、英文零残留 CJK，以及 reviewed English render 的逐字一致性。运行时还会对 template + 两套 unit 的 canonical JSON 重新计算 bundle SHA-256，避免只靠 provenance 自证；`prompt:check` 会拒绝任何与仓库快照不一致的生成结果。

provenance 刻意不记录本地文件 mtime，因为同一份数据包经过复制后时间戳会变化；语义身份只看模板 ID、policy、部署统计和三个 SHA-256。

同步或 prompt 适配有改动后，至少运行：

```bash
bun run prompt:check
bun test src/lib/__tests__/master-template.test.ts \
  src/lib/__tests__/conversation-locale.test.ts \
  src/lib/__tests__/build-prompt.test.ts \
  src/lib/__tests__/prompt-lead.test.ts
bun run typecheck
```

## 3. 运行时组装

[`master-template.ts`](../../src/lib/ai/master-template.ts) 只替换两类声明过的动态位置：2 个角色名 token 和以下 6 个 role section。literal 与 instruction unit 不允许运行时改写。

| canonical slot | Dearm 数据与运行时注入 |
|---|---|
| `CharaPrompt` | `character.persona`，随后是带结构标签的 `character.defaultCognition` |
| `Greeting` | 完整 `character.opening`；保留创作者定义的标签和展示示例 |
| `OutputSetting` | Dearm 默认输出协议 + `character.outputSetting` + 已启用 regex 的 `output_guidance` |
| `StyleSamples` | `character.sampleDialogue` |
| `PlotSetting` | `character.plotSetting` |
| `SupplementalContext` | 响应语言约束 + 带结构标签的 `character.adversity` + 当前玩家/面具的结构化 `UserInfo` |

映射入口是 [`build-prompt.ts`](../../src/lib/ai/build-prompt.ts)。renderer 插入 creator section 时不 trim、不翻译、不规范化 HTML/CSS/JS/XML、URL、变量或 replacement token；完整组装后才统一展开 `{{char}}` / `{{user}}` 及已知的粘贴损坏变体。

以下展示字段绝不能进入 prompt：`bio`、`creatorNote`。未来增加世界设定、记忆、摘要、物品或其他角色上下文时，应进入 `SupplementalContext`，不得新增第七个顶层槽位，也不得通过公开详情/API 暴露现有 prompt 原料。

### 语言路由

[`conversation-locale.ts`](../../src/lib/ai/conversation-locale.ts) 把 UI/会话 locale 与静态 instruction locale 分开：

| response locale | 静态 instruction units | 自然语言输出要求 |
|---|---|---|
| `zh-Hans` | canonical 简中 | 简体中文 |
| `zh-Hant` | reviewed 英文 | 台湾用语的自然繁体中文 |
| `ja-JP` | reviewed 英文 | 自然日语 |
| `th-TH` | reviewed 英文 | 自然泰语 |
| `en` | reviewed 英文 | 英语 |

这条路由只切换平台固定 instruction units，并在 `SupplementalContext` 注入目标输出语言约束。角色卡六槽内容仍按创作者原文插入，运行时不做批量机翻。

主回复与续写的每轮玩家包装也使用同一个 response locale：OOC 说明、面具字段、玩家输入标记和尾部格式提醒会切换为繁中、日语、泰语、简中或英语，但 creator 内容与结构 token 保持原样。

### 消息角色与调试来源

历史数据没有可靠保留 master prompt 当时走 provider system instruction，还是首条 user frame。Dearm 在 [`prompt-lead.ts`](../../src/lib/ai/prompt-lead.ts) 中统一采用首条 user frame；必要时插入固定 assistant acknowledgement，主回复与续写共用同一规则。这是 Dearm adapter 的传输契约，不是 canonical 资产本身的一部分。

主聊天 debug metadata 记录 adapter 版本、template ID、template SHA-256、instruction locale、response locale 和 prompt 长度。排障和指标应优先记录这些来源字段，不要把角色 prompt 或完整组装文本写入普通日志。owner 调试视图若展示原文，必须继续遵守现有 owner-only 权限边界。

## 4. 数据边界

允许进入 Dearm 仓库的只有固定平台 instruction、结构契约、provenance 和相应测试。以下上游数据仅可在受控本地环境读取，禁止复制、提交、粘贴进文档、issue、日志或普通 debug metadata：

- `cpa-*.jsonl.zst`、`gemini-*.jsonl.zst`：完整线上请求/响应，可能包含用户对话与个人信息。
- `prompts.jsonl.zst`、`prompts.by_character.jsonl.zst`、`prompt_manifests.jsonl.zst`。
- `character_cards.jsonl.zst`：创作者角色设定与 prompt 资产。
- `prompt_blocks.sqlite3`：约 1 GB 的分析数据库；同步时只读，不入仓库。
- `subagent-work/**`、运行日志、翻译批次与中间产物。

旧 `role-local-v1` 翻译与当前 `role-content-codex-v1` 属于不同 policy namespace，不能混合。`translation_blocklist.json` 是翻译工作流策略，不是 Dearm runtime 的依赖，也不能借同步流程变成平台内容审核规则。

源数据仓库的历史下载辅助脚本曾包含明文对象存储凭证。不得复制任何值；相关凭证应在源系统轮换，并在以后导入前先做 secret scan。

## 5. 更新与回滚

当前运行时 import 固定指向 `single-master-v1`，没有在线 feature flag；同步脚本的目标目录也固定为 v1。因此：

1. 同一 policy 的可重复生成可用 `prompt:sync`，但不得手改生成 JSON。
2. 模板语义、选择规则或翻译 policy 变化时，必须新建版本目录、adapter version 和独立 provenance；不要覆盖 v1。
3. 上线前用 version/hash debug metadata 做灰度对比，保留前一版本资产和 import 路径。
4. 出现输出质量、格式保真或 provider 兼容回归时，回退消费该版本的代码提交，或把 import 切回上一版本后重新部署；不要修改外部 canonical 数据来“修”线上。
5. 回退后运行对应版本的单测、typecheck 和多 provider 冒烟。只有匹配的外部源包才能用于 `prompt:check`，不能拿新版源包去校验旧快照。

回滚完成后继续保留 adapter version、template ID 和 SHA-256 的观测字段，以便确认流量已经回到预期版本。
