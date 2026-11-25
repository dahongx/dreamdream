# nj_* selector 对齐外部公约

> Companion: [insights/selector-align.md](../insights/selector-align.md)
> Related: [selector-contract.md](./selector-contract.md) · [nj-selectors.md](../contracts/nj-selectors.md)（契约本体）

把 Dearm 自家 `nj_*` 选择器体系从「命名相似但有 12 项未挂 / 命名不一致」状态对齐到外部平台公开的 selector 公约。对齐后外部美化卡导入 Dearm 时，24 项 selector 全部有 DOM 节点可命中。

## 改动概览

| 改动类型 | 数量 | 详情 |
|---|---|---|
| 命名 bug 修复 | 1 | `MessageActionsMenu.tsx` `.nj_msg_actions_btn`（class）→ `#nj_message_actions_btn`（id），同时保留同名 class 作多实例稳定钩子 |
| 改名（对齐外部公约） | 2 | `#nj_header_menu_btn` → `#nj_header_more_btn`；`#nj_header_menu` → `#nj_header_more_menu` |
| 新挂 selector（接已有功能） | 4 | `#nj_chat_input_replay_btn`（RegenerateIcon）、`#nj_chat_input_model_btn`（ModelPicker wrapper）、`#nj_message_actions_box`（DropdownMenu.Content）、`#nj_message_actions_{delete,continue,copy}`（三个 Item） |
| 挂 DOM placeholder | 2 | `#nj_header_follow_btn` / `#nj_header_message_btn` —— `hidden` + `aria-hidden` + `tabIndex=-1`，社交功能 v1 后置 |
| 新功能 | 1 | `#nj_author_note` —— 聊天页消息流顶部渲染 `character.creatorNote` 条幅（条件渲染，字段为空则不挂 DOM） |

合计 10 处 selector 状态升级 + 1 个新功能。

## 代码改动

### 1. `src/components/chat/MessageActionsMenu.tsx`

trigger button 同时挂 id + class：
```tsx
<button
  id="nj_message_actions_btn"
  className="nj_message_actions_btn ..."
>
```

`DropdownMenu.Content` 挂 `id="nj_message_actions_box"` + class。三个 `DropdownMenu.Item` 分别挂 `#nj_message_actions_{delete,continue,copy}` + 同名 class。disabled 删除项也挂 `#nj_message_actions_delete`（替换原 disabled 变体的 RenderPath）。

> ⚠️ 多实例 id 冲突：单页同时存在多条 AI 消息时这些 id 会重复。creator CSS 用 `#id` 只命中第一个实例，**推荐用同名 class**。dropdown 内的 id 仅在打开时存在（Radix Portal 默认关闭即卸载）。详见 nj-selectors.md §2.3 注释。

### 2. `src/components/chat/ChatHeaderMenu.tsx`

```tsx
<button id="nj_header_more_btn" className="nj_header_more_btn ...">  // 原 #nj_header_menu_btn
<DropdownMenu.Content id="nj_header_more_menu" className="nj_header_more_menu ...">  // 原 #nj_header_menu
```

未保留 alias —— Dearm v1 未正式发布，按 nj-selectors.md §6 走 deprecation 但不必保留一个 release 的 alias。

### 3. `src/components/chat/ChatRoom.tsx`

**Props 加 `creatorNote` 字段：**
```tsx
character: Pick<Character, "id" | "name" | "avatarUrl" | "coverImageUrl" | "tags" | "bio" | "creatorNote">;
```

**header 加社交按钮 placeholder：**
```tsx
<button id="nj_header_follow_btn" aria-hidden="true" tabIndex={-1} className="nj_header_follow_btn hidden" />
<button id="nj_header_message_btn" aria-hidden="true" tabIndex={-1} className="nj_header_message_btn hidden" />
```

placeholder 设计：
- `hidden` 让默认视觉不出现（不破坏现有 header 布局）
- `aria-hidden="true"` + `tabIndex={-1}` 让 AT 工具和键盘导航忽略
- DOM 节点存在，creator CSS 写 `#nj_header_follow_btn { display: block; }` 可以让它出现

**input 区挂 id：**
- `RegenerateIcon` button 加 `id="nj_chat_input_replay_btn"` + class
- `ModelPicker` wrapper div 加 `id="nj_chat_input_model_btn"` + class

**messagesNode 加 author note 条幅：**
```tsx
{character.creatorNote ? (
  <aside id="nj_author_note" className="nj_author_note ...">
    <p>{dict.chat.authorNoteLabel}</p>
    <p className="whitespace-pre-wrap">{character.creatorNote}</p>
  </aside>
) : null}
```

位置在 `OpeningSlot` 之前，跟随消息流滚动。视觉：圆角玻璃面板 + 顶栏小字标签 + 正文（保留换行）。

### 4. `src/app/chat/[characterId]/page.tsx`

RSC 把 `active.character.creatorNote` 透传给 ChatRoom character prop。

### 5. `src/i18n/{zh,en,types}.ts`

新增三个 key：
- `chat.headerFollowAria` —— 关注按钮 aria-label
- `chat.headerMessageAria` —— 私信按钮 aria-label
- `chat.authorNoteLabel` —— 作者的话条幅标题

## 验证

- `bun run typecheck` —— 通过
- `bun test`（235 tests）—— 全部通过
- `bunx biome check`（改动文件）—— 通过（仓库 pre-existing 的 5 个 lint error 与本次改动无关）

## 边界情况

### author note 的展示性约束
`character.creatorNote` 在 CLAUDE.md 白名单内（「作者的话，展示性、不进 prompt」），可以放心展示给所有访客。条件渲染（字段为空则不挂 DOM）避免空条幅占位。

### 社交按钮 placeholder 的可见性
默认 `hidden` 意味着外部美化卡 import 后这两个 selector 默认不生效（CSS 改 background 看不到）。creator 必须**主动**写 `display: block` 才能让 placeholder 出现。这是有意为之：避免 placeholder 出现在不该出现的位置（header 中段，跟其他按钮抢空间）。文档 §2.1 已说明。

### `#nj_message_actions_edit` 仍未挂
外部对照表里有 edit 项，但 Dearm 的 AI 气泡没有 edit 功能（只有 user 气泡有，走 `UserMessageActions.tsx`）。AI 气泡 edit 涉及 LLM 重新生成，是 v1 后置功能。文档已标 🚧。

## 关联文件

- 契约本体：[`docs/contracts/nj-selectors.md`](../contracts/nj-selectors.md)（§2.1 §2.2 §2.3 §6.1 已同步更新）
- CSS 白名单实现：`src/lib/styling/whitelist.ts`（无改动，已支持 `nj_*` 前缀放行）
- 外部 CSS 转换：`src/lib/import/external-card.ts`（无改动，render-time 选择器前缀 rename 仍兜底）
