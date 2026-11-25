# 输入框美化同步渲染 实施计划

> 目标：聊天页底部输入框，有自定义美化的创作者用他们自己的样式（毛玻璃/主题色），
> 没有的才用平台默认紫色。现在全是默认紫色，因为创作者的输入框美化被过滤/结构错配掉了。

## 根因（已用数据坐实）

1. **88 个美化包里 78 个自定义了输入框样式**，76 个用 Mufy 结构写法：
   `#nj_chat_input_box { background; border }`（外框）+ `#nj_chat_input_box textarea { color; bg:transparent }`（内层输入区）。

2. **契约本就规定 `#nj_chat_input_box` 是「输入框 textarea wrapper」**（外框），
   见 `docs/contracts/chat-render-spec.md:205`、生成器 prompt `global-css.txt:37`。
   **但生产 DOM 把 `id="nj_chat_input_box"` 放在了 `<textarea>` 本身上**（ChatRoom.tsx:1412），
   真正显示紫色的外层 wrapper div（ChatRoom.tsx:1410）**没有任何 id/class，创作者够不着**。
   → 代码违反了自己的契约，创作者按契约写的 CSS 匹配不到东西。

3. **`#nj_chat_input_box` 还被 CSS 白名单硬拉黑**（whitelist.ts:270，当年为修「双层框」bug 加），
   → 即便创作者写对了也被 strip 掉。

综合：创作者的输入框美化 = 结构错配 + 白名单拦截，双重失效 → 全默认紫色。

## 修复方案（对齐既有契约，不是改契约）

### 改动 1：ChatRoom.tsx —— id 归位（核心）
把 `id="nj_chat_input_box"` 从 `<textarea>` 移到外层 wrapper `<div>`（1410 行那个带
border+bg 的框），textarea 换新 id `nj_chat_input_textarea`。改完：
- `#nj_chat_input_box` = 可见外框（创作者在这加背景/边框/圆角 —— 匹配 Mufy 与契约）
- `#nj_chat_input_box textarea` = 内层输入区（创作者现有 CSS 正好命中）
- wrapper 默认仍保留 `border-border-subtle bg-surface-glass`（**没美化的卡照样是紫框**），
  创作者的 `!important` 自然覆盖它（**有美化的卡显示创作者样式**）。
- textarea 保持 `border-0 bg-transparent`（内层透明，不产生双层框）。
- `inputBoxRef` 走 JS ref 不依赖 id，autosize 不受影响。

### 改动 2：whitelist.ts —— 放开 `#nj_chat_input_box` 黑名单
移除 270-272 行对 `#nj_chat_input_box` 的硬拦截。**双层框 bug 不会复发**，因为：
- id 现在指向 wrapper（外框），创作者 `#nj_chat_input_box { border }` 加的是**外框自己的边框**，
  不是给内层 textarea 再套一层 → 无双层框。
- 内层 textarea（新 id）默认 `border-0`，创作者一般只写 `#nj_chat_input_box textarea { bg:transparent }`，
  不会加边框。
- property 级过滤（position:fixed/sticky、pointer-events、z-index>100）全部保留不动。

### 改动 3：globals.css:880 —— 防缩放规则跟进
`#nj_chat_input_box { font-size:16px }`（防 iOS 聚焦缩放）当年靠 id 命中 textarea。
id 移走后改成新 textarea id（或直接依赖同段已有的裸 `textarea` 选择器，它已覆盖）。
保证移动端聚焦不缩放行为不变。

### 改动 4：CharacterForm.tsx 预览结构对齐（次要）
studio sandbox 预览（1938-1962）目前是「textarea + 独立按钮」，与生产的「外框包 textarea+发送」
结构不同。为让创作者在预览里看到和生产一致的输入框美化，把它对齐成生产结构
（wrapper div 挂 `nj_chat_input_box`，内含 textarea `nj_chat_input_textarea` + send button）。
—— 此项让「所见即所得」，但不影响生产；若想缩小改动面可后置，先保证生产正确。

### 改动 5：契约/文档同步
- `ChatRoom.tsx:126` docblock：`#nj_chat_input_box` 释义从「the textarea itself」改成「输入框外框（wrapper）」。
- `chat-render-spec.md` / `global-css.txt` 已经写的是 wrapper 语义，核对无需大改（代码本来就该对齐它们）。

## 不改 / 保留
- 平台默认紫色**保留**（没美化的卡不受影响）。
- 白名单 property 级安全过滤全部保留（fixed/sticky、pointer-events、z-index>100、@import、js url）。
- 发送按钮防「大框包小框」复位（whitelist.ts:186）保留。
- `nj_chat_input_container` / `nj_chat_send_button` 等其它 selector 不动。

## 验证
1. 单测：styling.test.ts 加用例——`#nj_chat_input_box { background: red }` 现在应**通过**（不再 blocked）；
   `#nj_chat_input_box textarea { color }` 通过；property 级危险声明仍被拦。
2. 生产验证（走 test 分支 → 服务器 build → 真机/网页测）：
   - 有美化的卡（陆昭/祁叙等 mmdw 系）：输入框显示创作者毛玻璃/主题色，**不是紫色**。
   - 没美化的卡：输入框仍是平台默认紫框。
   - 无双层框、发送按钮无套框、移动端聚焦不缩放。
3. typecheck + biome + 全量 test 过；lefthook 过。

## 影响文件
| 文件 | 改动 |
|------|------|
| `src/components/chat/ChatRoom.tsx` | id 从 textarea 移到 wrapper；textarea 新 id；docblock |
| `src/lib/styling/whitelist.ts` | 移除 `#nj_chat_input_box` 黑名单；注释更新 |
| `src/app/globals.css` | 防缩放规则跟进新 textarea id |
| `src/components/characters/CharacterForm.tsx` | 预览结构对齐生产（次要，可后置） |
| `src/lib/__tests__/styling.test.ts` | 加输入框放行 + 危险声明仍拦的用例 |
| `docs/contracts/chat-render-spec.md` 等 | 核对语义（多为确认，不大改） |

## 发布姿势
本地不好测 → 推 `test/*` 分支 → 服务器 checkout+build → 你测生产 OK → 合 main 规范 commit
（跑 lefthook）→ 服务器切回 main（代码同镜像不重 build）→ 删测试分支。
