# nj_* selector 对齐外部公约 — Insights

> Companion: [handover/selector-align.md](../handover/selector-align.md)

## 为什么要完全对齐外部公约

Dearm 的差异化在「creator 友好 + 内置 AI 辅助 + 调试模式 + 零内容审核」，但**美化体系**不是差异化点 —— 这是竞品已经教育过市场的领域。creator 已经在那边积累了大量美化卡（CSS / 小剧场 / 正则），他们的迁移成本 = Dearm 的获客成本。

selector 命名是这套体系的最低层公约。如果 creator 粘贴一段外部 CSS 进 Dearm，发现 12 项 selector 命中不到，第一反应不是「Dearm 还没做这个功能」，而是「Dearm 不兼容我的卡」。这个认知一旦形成，creator 不会回来。

所以对齐外部公约不是技术债清理，是**降低迁移摩擦**的产品决策。

## 三个关键 trade-off

### 1. 社交按钮：挂 placeholder 而不是不挂

AGENTS.md「不做清单」明确写「粉丝 / 关注、社交链接」v1 后置。但外部公约里有对应的「关注」「私信」两项 selector。三种选择：

| 方案 | 优点 | 缺点 |
|---|---|---|
| 不挂 | 严格遵守「不做清单」 | creator 迁移后这两个 CSS 规则失效，可能误以为 Dearm bug |
| 挂 placeholder（`hidden` + `aria-hidden`） | DOM 存在，creator CSS 主动 `display: block` 后可命中 | 默认不可见，creator 不主动改 CSS 看不到 |
| 挂可见但无功能按钮 | 完全对齐外部视觉 | 死按钮破坏 UX，点击无响应更糟 |

选 placeholder。理由：creator 美化卡是有意识写 CSS 的群体，他们看到 selector 名就知道这是「钩子」，会主动决定要不要显示。普通用户（不写 CSS 的玩家）看不到 placeholder，不被打扰。

`hidden` 而不是 `display: none` 是有意为之 —— `hidden` 是 HTML 标准属性，语义清晰（「这个元素当前不相关」），AT 工具一致忽略，creator CSS `display: block` 可以干净地覆盖。

### 2. 多实例 id 冲突：保留 id + 加 class

外部公约把消息操作触发器定义成 id，但单页有多条 AI 消息，每个消息一个 trigger button，id 在 DOM 里会重复。这是外部公约本身的缺陷。

严格守约 = 只挂 id，creator CSS `#id` 只命中第一个实例。
偏离公约 = 只挂 class，外部卡 import 时 selector 是 id，命中不到。

折中：**id + class 都挂**。id 满足公约（外部卡 import 后对应 id 自动 rename 成 `#nj_message_actions_btn`，命中第一个）；class 给 Dearm 自家 creator 写稳定规则用（多实例都命中）。文档里 flag 这个陷阱，推荐用 class。

这等于把外部公约的内在限制暴露给 creator，但至少给了他们正确的工具。

### 3. 命名 bug 修复：直接改名不保留 alias

`#nj_header_menu_btn` → `#nj_header_more_btn` 是破坏性变更。nj-selectors.md §6 写「删除 / 改名属于破坏性变更：先把旧名标 deprecated，至少保留一个 release 的 alias」。

但 Dearm v1 **还没正式发布**。`#nj_header_menu_btn` 不是公开 API，没有外部 creator 在用（只有我们自己代码里挂了 id，没有 creator CSS 引用）。保留 alias = 多挂一个无意义的 id，徒增维护负担。

直接改名。文档 §6.1 记录这次变更作为 deprecation log，发布后任何破坏性改名都要严格走 alias 流程。

## 为什么 author note 放消息流顶部而不是 header

`character.creatorNote` 是「作者对玩家说的话」，展示性、不进 prompt。两种放置方案：

- **header 旁边**：固定可见，但 header 已经塞了返回 / 头像 / 标题 / 调试 toggle / review / 更多菜单 / 亮度调节，再加 author note 会拥挤；且 author note 通常较长（一段话），header 不是长文本的容器。
- **消息流顶部**：跟消息一起滚动，玩家向下滚一段后看不到，但进入对话第一眼能看到；视觉上像「作者插话」而不是「页面 chrome」，语义更准确。

选消息流顶部。条件渲染（`creatorNote` 为空则不挂 DOM）避免空条幅占位。

## 不做的事

- **不挂 `#nj_message_actions_edit`**：AI 气泡 edit 涉及 LLM 重新生成（要把 AI 输出改了之后从这一点继续生成），是 v1 后置功能。用户气泡 edit 已经实现（`UserMessageActions.tsx`），但走的是另一套 selector 体系（没挂 nj_* id，因为外部公约里 edit 项归属不明确）。等 AI edit 功能落地时再补。
- **不实现社交功能**：关注 / 私信是完整社交体系的一部分（需要粉丝表、关注关系、私信通道、通知系统），不是挂两个按钮就能搞定。placeholder 让 selector 体系对齐，功能留给后续大版本。
- **不改 `whitelist.ts`**：CSS 白名单已经放开了 `nj_*` / class / id / attr / pseudo-class 头，scope 兜底约束范围。本次对齐不需要改白名单实现。

## 反向链接

- 技术交接：[handover/selector-align.md](../handover/selector-align.md)
- 契约本体：[contracts/nj-selectors.md](../contracts/nj-selectors.md)
- 内容立场：AGENTS.md「Prompt 资产保护」段（creatorNote 是展示性字段白名单内）
