# nj_* Selector 字典

**状态：** v1 · 持续维护
**最后更新：** 2026/06/24
**前置：** [`chat-render-spec.md`](./chat-render-spec.md) §2.6

> 这份文档是 Layer A 公约的可执行清单。`nj_*` 一旦发布即 API ── 破坏性改动（重命名、删除、语义漂移）需走 deprecation 流程。新增 selector 必须更新本字典，否则不允许进 master。

> **2026/06/24 对齐外部公约：** 本次同步覆盖外部对照表 24 项 selector 的全部镜像命名。社交按钮（关注/私信）挂 DOM placeholder（`hidden` + `aria-hidden`），保留节点供 creator CSS 命中，功能 v1 后置。详见 [`docs/handover/selector-align.md`](../handover/selector-align.md)。

---

## 0. 命名规则

```
nj_<area>_<element>[_<subelement>]
```

- 全小写、下划线分隔；不允许驼峰 / kebab。
- `<area>` 是顶级域，约定见 §2 表格。
- 第三段 `<subelement>` 用于消歧（如 `nj_phone_app_screen`），不强制。
- creator 自定义 class **不允许** `nj_` 前缀（避免跟未来 host class 冲突）—— `whitelist.ts` 的 scope 处理器只对 `nj_*` 加角色 scope 前缀，不为 creator class 兜底。

---

## 1. 状态标记

| 标记 | 含义 |
|------|------|
| ✅ 已挂 | 在 master 当前代码中实际存在，可被 creator CSS 直接使用 |
| 🚧 计划挂 | spec 列出但代码尚未挂；creator 写了不会报错但也不会生效，**v1 内会补齐** |
| 📦 模板私有 / placeholder | 模板私有 class（§5）或社交功能 placeholder：DOM 节点存在供 creator CSS 命中，但功能未实现（`hidden` + `aria-hidden`，需 creator CSS 主动 `display: block` 才可见） |

---

## 2. 结构 ID（每页一个）

### 2.1 chat 主页面

| Selector | 状态 | 位置 | 说明 |
|----------|------|------|------|
| `#nj_chat_app` | ✅ | `ChatStage.tsx` | 最外层容器（含立绘 / overlay / 内容） |
| `#nj_background_image` | ✅ | `ChatStage.tsx` | 立绘层 div（即使无立绘也保留空 div） |
| `#nj_background_overlay` | ✅ | `ChatStage.tsx` | 蒙层 div（永远在立绘上方） |
| `#nj_chat_header` | ✅ | `ChatStage.tsx` | 顶部 64px 条 |
| `#nj_chat_messages` | ✅ | `ChatStage.tsx` | 消息流容器（滚动区） |
| `#nj_chat_sidebar` | ✅ | `ChatSidebar.tsx` | 左侧会话列表 sidebar |
| `#nj_back_button` | ✅ | `ChatRoom.tsx` | 返回按钮 |
| `#nj_header_clarity_btn` | ✅ | `ChatRoom.tsx` | 调试模式 toggle（仅 owner 可见） |
| `#nj_header_follow_btn` | 📦 | `ChatRoom.tsx` | 关注按钮 placeholder（`hidden` + `aria-hidden`，社交功能 v1 后置；DOM 节点存在供 creator CSS 命中） |
| `#nj_header_message_btn` | 📦 | `ChatRoom.tsx` | 私信按钮 placeholder（同上） |
| `#nj_header_more_btn` | ✅ | `ChatHeaderMenu.tsx` | 更多菜单触发按钮（原 `#nj_header_menu_btn`，已对齐外部命名） |
| `#nj_header_more_menu` | ✅ | `ChatHeaderMenu.tsx` | 更多菜单内容容器（原 `#nj_header_menu`，已对齐外部命名） |
| `#nj_author_note` | ✅ | `ChatRoom.tsx` | 作者的话条幅（仅当 `character.creatorNote` 非空时渲染） |

### 2.2 chat 输入区

| Selector | 状态 | 位置 | 说明 |
|----------|------|------|------|
| `#nj_chat_input_container` | ✅ | `ChatRoom.tsx`, `PreviewCanvas.tsx`, `CharacterForm.tsx` | 输入区 wrapper |
| `#nj_chat_input_box` | ⛔ | `ChatRoom.tsx`, `CharacterForm.tsx` | textarea 本体。**creator CSS 命中它的规则会被 CSS walker 硬黑名单拦截**（`whitelist.ts`，防双层框）—— 要改输入区样式请打 `#nj_chat_input_container` |
| `#nj_chat_send_button` | ✅ | `ChatRoom.tsx`, `CharacterForm.tsx` | 发送按钮 |
| `#nj_chat_input_replay_btn` | ✅ | `ChatRoom.tsx` | 重说按钮（重新生成上一条 AI 回复） |
| `#nj_chat_input_model_btn` | ✅ | `ChatRoom.tsx` | 模型选择按钮（包裹 `ModelPicker` 组件） |

### 2.3 单条消息的操作菜单

> AI 气泡的操作菜单（删除 / 续写 / 复制）。trigger button 挂在 `MessageBubble.tsx:221`，dropdown 内容由 Radix Portal 渲染。

| Selector | 状态 | 说明 |
|----------|------|------|
| `#nj_message_actions_box` | ✅ | 操作菜单容器（Radix `DropdownMenu.Content`，打开时挂载） |
| `#nj_message_actions_btn` | ✅ | 单条操作按钮（trigger，原 `.nj_msg_actions_btn` class 已修为契约 id） |
| `#nj_message_actions_delete` | ✅ | 删除项（含 disabled 变体，由 `deleteDisabledReason` 控制是否渲染 disabled 版本） |
| `#nj_message_actions_edit` | 🚧 | 编辑项（AI 气泡无 edit 功能，仅用户气泡有；v1 后置） |
| `#nj_message_actions_copy` | ✅ | 复制项 |
| `#nj_message_actions_continue` | ✅ | 续写项（仅最后一条 AI 气泡可用） |

> ⚠️ **多实例 id 冲突：** 单页同时存在多条 AI 消息时，`#nj_message_actions_btn` / `#nj_message_actions_delete` / `#nj_message_actions_copy` / `#nj_message_actions_continue` 会在 DOM 中重复（每个消息一个实例）。creator CSS 用 `#id` 选择器只会命中第一个实例，**建议用同名 class**（`.nj_message_actions_btn` 等，已同步挂载）写全局规则。dropdown 内的 id 仅在打开时存在（Radix Portal 默认关闭即卸载）。

### 2.4 pack studio（创作者面板）

| Selector | 状态 | 位置 | 说明 |
|----------|------|------|------|
| `#nj_pack_studio` | ✅ | `StudioLayout.tsx` | studio 顶层容器 |
| `#nj_pack_studio_preview` | ✅ | `StudioLayout.tsx` | 右侧 preview 列 |
| `#nj_pack_studio_preview_canvas` | ✅ | `PreviewCanvas.tsx` | preview 画布本体 |
| `#nj_pack_studio_assistant` | ✅ | `StudioLayout.tsx` | assistant tab 容器 |
| `#nj_pack_studio_preview_footer` | ✅ | `PreviewCanvas.tsx` | preview 底部操作条（丢弃/确认应用；两分支互斥挂载） |
| `#nj_pack_studio_sessions` | ✅ | `StudioSessionSidebar.tsx` | 会话侧栏容器 |
| `#nj_pack_studio_session_new` | ✅ | `StudioSessionSidebar.tsx` | 新建会话按钮 |
| `.nj_pack_studio_session_item` | ✅ | `StudioSessionSidebar.tsx` | 会话行 |
| `#nj_pack_studio_session_footer` | ✅ | `SessionFooter.tsx` | 会话操作 footer |
| `#nj_pack_studio_session_discard` | ✅ | `SessionFooter.tsx` | 丢弃按钮 |
| `#nj_pack_studio_session_confirm` | ✅ | `SessionFooter.tsx` | 确认应用按钮 |
| `#nj_pack_studio_session_chooser` | ✅ | `NewSessionChooser.tsx` | 新建会话类型弹窗（含 `#nj_pack_studio_session_chooser_title`） |
| `.nj_pack_studio_session_card` | ✅ | `NewSessionChooser.tsx` | 会话类型卡片 |
| `#nj_pack_studio_assistant_attachments` | ✅ | `AssistantTab.tsx` | 附件区容器 |
| `#nj_pack_studio_attachment_dropzone` | ✅ | `AssistantTab.tsx` | 附件拖放区 |
| `.nj_pack_studio_attachment_thumb` | ✅ | `AssistantTab.tsx` | 附件缩略图 |

> ⚠️ 本表 2026-07-04 依代码 grep 盘点补录（此前字典只登记了 4 个，代码里实挂 15+）——
> 「新增 selector 必须更新本字典」的规约请回归执行。

### 2.5 shop（商城页）

> 出处：`docs/handover/shop-page.md`，2026-07-04 并入本字典（字典是唯一权威清单）。

| Selector | 状态 | 位置 | 说明 |
|----------|------|------|------|
| `#nj_shop_top_tabs` | ✅ | `ShopPageClient.tsx` | 月卡/直购一级 tab |
| `#nj_shop_membership_status` | ✅ | `MembershipStatusCard.tsx` | 「我的会员」状态卡 |
| `#nj_shop_daily_claim` | ✅ | `DailyClaimCard.tsx` | 每日可领卡 |
| `#nj_shop_recharge_banner` | ✅ | `ShopPageClient.tsx` | 充值区分隔条幅 |
| `#nj_shop_plan_recharger` | ✅ | `PlanRecharger.tsx` | 月卡充值区容器 |
| `#nj_shop_plan_tabs` | ✅ | `PlanRecharger.tsx` | 三档二级 tab |
| `#nj_shop_plan_card` | ✅ | `PlanRecharger.tsx` | 价格卡 |
| `#nj_shop_comparison_table` | ✅ | `PlanRecharger.tsx` | 权益对比表 |

---

## 3. 消息分型 class（Layer A 路由 + Layer B 默认皮肤）

这是创作者 CSS 注入最常用的一组 ── 都是 react-markdown components 路由后由组件挂在最外层 wrapper 上。

| Selector | 状态 | 标签 / 来源 | 组件 |
|----------|------|------------|------|
| `.nj_ai_message_row` | ✅ | 每条 AI 消息的最外层 wrapper（**无条件存在** —— LLM 输出不含 `<message>` 标签时 `.nj_ai_message_bubble` 不会出现，这层才是稳定挂点） | `MessageBubble.tsx` |
| `.nj_ai_message_bubble` | ✅ | `<message>` / `<mes>` / fallback | `AIBubble.tsx` |
| `.nj_user_message_bubble` | ✅ | 用户消息（div/span 元素，`white-space: pre-wrap` 保留换行；**不是** `<pre>`） | `MessageBubble.tsx` |
| `.nj_message_narration` | ✅ | `<narration>` / `<nar>` | `Narration.tsx`（默认 muted 无斜体无渐变，06-21 决议） |
| `.nj_message_system` | ✅ | `<system>` / `<sys>` | `SystemCapsule.tsx`（默认居中玻璃胶囊） |
| `.nj_message_think` | ✅ | `<think>` | `ThinkBlock.tsx`（默认半透明展开） |
| `.nj_scenario_section` | ✅ | `<scenario>` / `<sce>` | `ScenarioSection.tsx`（pass-through className 钩子） |
| `.nj_emphasis_text` | ✅ | `**xxx**` (markdown strong) | `EmphasisText.tsx`（默认纯白加粗；仅 `<details>` 状态栏内恢复渐变） |
| `.nj_code_block` | ✅ | ``` 普通代码块（语言非白名单） | `MessageRenderer.tsx` 内 `code` 组件 |
| `.nj_artifact_iframe` | ✅ | `<artifact>` 单独包裹 | `ArtifactIframe.tsx` sandbox iframe |
| `.nj_regex_iframe` | ✅ | regex 替换后整体 `<artifact>` envelope | `RegexIframe.tsx`（segments.ts 分轨产物） |

### 3.1 渐变填充 selector 的注意事项

`.nj_message_narration` 和 `.nj_emphasis_text` 都用了：

```css
background-image: linear-gradient(...);
background-clip: text;
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
color: transparent;
```

creator 在 globalCss 里覆盖 `color` 时**必须同时重置** `-webkit-text-fill-color`，否则纯色仍然透明：

```css
.nj_message_narration {
  background-image: none;
  -webkit-text-fill-color: #c5a059;  /* 必须 */
  color: #c5a059;                     /* fallback */
}
```

---

## 4. 通用 class

| Selector | 状态 | 位置 | 说明 |
|----------|------|------|------|
| `.nj_chat_sidebar_item` | ✅ | `ChatSidebar.tsx` | sidebar 单条会话条目 |
| `.nj_symbol` | ✅ | symbol_match regex 工具产出 | tool-mode `<symbol>` 包裹元素 |

---

## 5. 📦 模板 / 官方 pack 私有 class

> 下列 class 仅出现在 **官方模板（`templates.ts`）** 或 **官方 pack（`yearn-phone.ts`）** 的 replacement HTML 中。它们不是 host 渲染契约的一部分，**creator 可以借鉴写法，但不要假设这些 class 在所有卡上一定存在 / 一定保留命名**。

### 5.1 来自 `templates.ts`

| Selector | 来源模板 |
|----------|---------|
| `.nj_env_panel` | `env_state_panel` |
| `.nj_memory` | `dynamic_memory` |

### 5.2 来自 `yearn-phone.ts`（官方手机 pack 一整套）

`.nj_phone_*`：`shell`, `frame`, `notch`, `statusbar`, `statusbar_icons`, `statusbar--dark`, `home_indicator`, `home_indicator--dark`, `desktop`, `grid`, `app`, `icon`, `label`, `app_screen`, `app_screen--open`, `app_header`, `app_title`, `app_more`, `app_body`, `avatar`, `bubble`, `bubble--user`, `bubble--ai`, `placeholder`, `placeholder_text`, `wechat_messages`, `wechat_row`, `wechat_row--user`, `wechat_row--ai`, `wechat_footer`, `wechat_input`, `wechat_send`, `notes_screen`, `notes_search`, `note`, `note_list`, `note_title`, `note_meta`, `note_date`, `note_content`, `wallet_screen`, `wallet_list`, `wallet_card`, `wallet_card--{red|blue|gray|gold|purple|green}`, `wallet_bank`, `wallet_number`, `wallet_type`, `weibo_screen`, `weibo_list`, `weibo_post`, `weibo_head`, `weibo_avatar`, `weibo_author`, `weibo_time`, `weibo_body`, `weibo_actions`。

> 这些 class 都跑在 `<artifact>` iframe 里，不会泄漏到 host 文档。creator 不需要在 globalCss 中处理它们。

---

## 6. 维护规约

新增 / 改名 / 删除 `nj_*` selector 时：

1. 改代码同步改本文档（PR 必须包含本文件的 diff）
2. **删除 / 改名属于破坏性变更**：先把旧名标 deprecated，至少保留一个 release 的 alias
3. selector 状态从 🚧 升级为 ✅ 时，把"位置"列填上代码位置
4. 新增模板私有 class 时进 §5，不进 §3，避免误以为是稳定公约

### 6.1 变更记录

| 日期 | 变更 | 说明 |
|------|------|------|
| 2026/06/24 | `#nj_header_menu_btn` → `#nj_header_more_btn` | 对齐外部公约命名。Dearm v1 未正式发布，未保留 alias |
| 2026/06/24 | `#nj_header_menu` → `#nj_header_more_menu` | 同上 |
| 2026/06/24 | `.nj_msg_actions_btn`（class）→ `#nj_message_actions_btn`（id） | 命名 bug 修复，对齐外部公约。同时保留同名 class 作稳定钩子（多实例场景推荐用 class） |
| 2026/06/24 | 新增 `#nj_message_actions_box` / `_delete` / `_copy` / `_continue` | MessageActionsMenu 子项补齐 |
| 2026/06/24 | `#nj_chat_input_replay_btn` / `#nj_chat_input_model_btn` 🚧→✅ | 接入已有功能（RegenerateIcon / ModelPicker） |
| 2026/06/24 | `#nj_header_follow_btn` / `#nj_header_message_btn` 🚧→📦 | 挂 DOM placeholder（社交功能 v1 后置） |
| 2026/06/24 | `#nj_author_note` 🚧→✅ | 新功能：聊天页消息流顶部加作者的话条幅 |

---

## 7. 关联文件

- 渲染契约：[`chat-render-spec.md`](./chat-render-spec.md) §2.6
- creator studio 适配：[`creator-studio-update.md`](./creator-studio-update.md)
- CSS scope 实现：`src/lib/styling/whitelist.ts`
- creator 可参考样式 stub：[`/public/nj-custom.css`](../../public/nj-custom.css)
