# Studio CSS 直接编辑 — Insights

> Companion: [handover/studio-direct-css-edit.md](../handover/studio-direct-css-edit.md)

## 为什么要加直接编辑

原先 creator 改 CSS 只有一条路：开一个「皮肤会话」，用自然语言描述需求，等 AI 生成 proposal，再「确认应用」。这条路适合**从零开始**设计皮肤，但对两种常见场景摩擦极大：

1. **外部迁移**：creator 手上有现成的外部 CSS 卡，粘进来改几个前缀就能用，但得先开会话、告诉 AI「帮我应用这段 CSS」、等 AI 包一层 proposal 再确认 —— 多了三步无意义的中间层。
2. **精细调参**：creator 已知道要改哪一行（比如把某个 `rgba` 的透明度从 0.3 调到 0.5），但必须用自然语言描述给 AI，AI 可能改错位置或改了不该改的。

直接编辑是「给懂 CSS 的 creator 的逃生舱」。不是替代 AI 会话，是补全工具箱。

## 两条路的定位

| | AI 皮肤会话 | 直接编辑 |
|---|---|---|
| **适用场景** | 从零构建风格 / 不想写 CSS / 迭代大改 | 粘贴迁移卡 / 精细微调 / 调试单行 |
| **上手门槛** | 低（自然语言） | 高（需要知道 `nj_*` selector） |
| **速度** | 慢（多轮对话） | 快（即改即存） |
| **安全兜底** | 渲染层 sanitize | 同上，一致 |

两者不互斥。Studio 里 creator 可以先用 AI 会话搭框架，再直接编辑微调。`directCssDraft` 和 `persistedCss` 共用同一个 `pack.globalCss` 来源，两条路写的是同一份 CSS。

## 为什么不在保存时校验

纠结点：要不要在 `handleDirectCssSave` 里跑一次 `sanitizeAndScopeCss`，提前报告哪些规则被剥离？

最终不做，理由：

- 现有架构已有渲染层兜底（chat page + PreviewCanvas），两条路行为一致；如果在保存时加校验，等于引入第二套行为，两套可能产生偏差。
- "被剥离"不是错误，是正常工作（scope 前缀、`body` 剥离等）。在保存时展示 diff 可能把 creator 吓到，但实际效果是对的。
- 复杂度不值得：这是 pre-launch 产品，creator 都是懂 CSS 的，出问题会自己看 preview。

如果未来要做「保存时校验 + 提示」，可以在 `handleDirectCssSave` 里调 `sanitizeAndScopeCss`，把原始 draft 和 sanitized 结果做 diff 展示。现在先不做。

## 反向链接

- 技术交接：[handover/studio-direct-css-edit.md](../handover/studio-direct-css-edit.md)
- CSS 白名单设计：[global-styling.md](./global-styling.md)
- pack 整体设计：[beautification-packs.md](./beautification-packs.md)
