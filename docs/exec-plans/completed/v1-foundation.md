# 寄情 (Dearm) v1 实施规划

> 对标同类角色扮演聊天平台的探索页，做一个 Web 多用户 AI 角色聊天平台。
> 调研基础：[飞书文档 H9lNdwiKCodSsExNMPacTIlhnjf](https://my.feishu.cn/docx/H9lNdwiKCodSsExNMPacTIlhnjf)。
>
> **核心差异化 vs 竞品：**
> 1. **正则替换系统**（与竞品同源，但用更现代的双轨渲染：sanitize + iframe sandbox）
> 2. **内置 AI 辅助生成**：竞品给 creator 一段 prompt 让他们贴到外部 AI 工具，我们把 AI 生成 HTML 组件 / CSS 美化 / output_guidance 直接做进创作流程，流式回填到 textarea，不出页
> 3. **调试友好**：聊天页内置调试模式，AI 气泡下展示原始输出 + 匹配的规则 + 未匹配的规则 + token/latency，让 creator 快速定位"为什么我的组件没渲染"
> 4. **零内容审核**：creator 写什么都允许，nsfw 仅作元数据
>
> 这三条是我们和竞品的真正护城河（创作者侧），不是看 token 抽成的玩法。

---

## 一、v1 边界（硬卡死）

**做：**
1. **探索页** — 角色卡网格、Tab 切换（推荐/最新/全部）、标签筛选、搜索
2. **聊天页** — 流式对话、消息历史、人设面具（最小版：仅用户昵称 + 头像）、单卡多轮上下文
3. **角色卡** — 创建/编辑/列表，模板对齐竞品在线表单的中等深度字段集（约 16 字段）
4. **正则系统** — 双轨渲染：sanitize（DOMPurify）+ iframe（sandbox + Host API）
5. **全局美化** — 稳定 selector 契约（`nj_*` 前缀）+ creator 写 CSS 注入 + 特殊渲染标签（`<message>` / `<system>` / `<narration>` 等）+ DOMPurify CSS 白名单
6. **导入导出** — 角色卡 / 正则规则 JSON 包，creator 跨账号迁移与私下分享
7. **AI 辅助生成**（核心差异化 #2）— 4 个生成器内置：替换字符串 HTML 组件 / global_css 美化代码 / output_guidance 输出指令 / target_text 模板骨架；流式回填到 textarea
8. **调试模式**（核心差异化 #3）— 聊天页 toggle，AI 气泡下展示原始输出 + 规则匹配明细 + 性能数据，仅卡 owner 可见

**不做（v1 全部后置）：**
- 付费体系、双币制、装饰品（头像框/气泡/灯牌）
- 创作者等级、粉丝/关注、合集、好友、社交链接
- 世界观图鉴 NPC、剧情系统 7 模块、时间轴、条件触发器、物品栏、资料库 RAG
- 50+ 字段完整角色卡模板（只做最小骨架）
- 内容审核机制（**平台立场：完全不做检测**——无违禁词扫描、无 AI 审核、无强制下架。`nsfw` 字段由创作者自报，仅用于用户侧筛选展示，平台不验证、不挑战内容本身）
- **引继码买卖商店 / CSS 主题分发市场**（注意：这是平台运营的"主题电商"机制，creator 自己写 CSS 美化能力**是做的**，见模块 5；只是不做"上架商品、定价、抽成、交易"那一套）
- 多模型切换 UI、模型市场、缓存计费、tool-call typed component（双轨第二条）
- 移动端原生 App、桌面壳、IM Bridge

---

## 二、技术栈选型

| 层 | 选择 | 理由 |
|----|------|------|
| 语言 | **TypeScript 5+** strict 模式 | 全栈一致、类型从 schema 反推 |
| 运行时 / 包管理 | **Bun** | 安装快、内建 test runner、原生 TS / JSX、Next.js 15+ 已官方支持 |
| 框架 | **Next.js 16 App Router + React 19** | 全栈一体、RSC + Server Actions、SSE 流式天然支持 |
| 样式 | **Tailwind CSS 4 + Radix UI** | Tailwind 速度 + Radix 无障碍基础组件 |
| 数据库 | **Postgres (Neon)** | 多用户必须云 DB；Neon serverless 无空闲费用、与 Vercel 部署整合好 |
| ORM | **Drizzle ORM** | 轻量、TypeScript 优先、迁移可读、Bun 兼容 |
| Auth | **Auth.js v5 (NextAuth)** + email magic link | 自部署省钱、Drizzle adapter 现成 |
| 部署 | **Vercel** | Next.js 原生集成、SSE 流式成熟、PR preview |
| 文件存储 | **Cloudflare R2** | 用途：用户头像 + 角色立绘上传；出口流量免费，比 S3/Supabase Storage 划算 |
| LLM 调用 | **Vercel AI SDK (`ai` 包)** + `@ai-sdk/anthropic` / `@ai-sdk/google` / `@ai-sdk/openai` | 统一 API 抽象，**多 provider 多协议天然兼容**，换模型不改业务逻辑；流式 SSE / tool call / structured output 全覆盖 |
| 默认模型 | **Claude Sonnet 4.6** + 可切换 Gemini / GPT | 对短 XML 标签遵循稳定性好（正则系统的关键依赖）；AI SDK 让"切 provider"是一行配置 |
| Markdown 渲染 | **streamdown + react-markdown + rehype-raw** | rehype-raw 是正则替换后嵌入 HTML 渲染的关键 |
| 富 UI 净化 | **DOMPurify (isomorphic)** | 正则替换产出的 HTML 必须白名单净化（XSS 红线） |
| 输入校验 | **Zod** | 所有 API route + Server Action 输入校验 |
| Lint / Format | **Biome** 或 **ESLint + Prettier** | Biome 速度快、单工具，推荐起步 |
| 测试 | **Bun 内置 test runner** + **Playwright** (E2E) | Bun test 跑单测够快，E2E 用 Playwright |
| Git hook | **lefthook** 或 **husky + lint-staged** | lefthook 与 Bun 配合更轻 |

---

## 三、数据模型（v1 实体）

```ts
// 用户
users {
  id, email, username, display_name, avatar_url,
  created_at, updated_at
}

// 角色卡（对齐竞品在线创建表单的字段集）
characters {
  id, owner_id (-> users),

  // —— A. 角色信息（meta / 探索页用，不进 LLM prompt） ——
  name,                 // 角色名
  gender,               // enum: 'male' | 'female' | 'other' | 'unset'
  age,                  // int，允许 null
  nsfw,                 // boolean，创作者自报「是否 NSFW」。仅作筛选元数据，平台不检测、不审核、不挑战内容；用户侧可通过偏好开关过滤掉 nsfw=true 的卡
  is_ai,                // boolean，「是否为AI」(角色本身是不是 AI 设定)
  content_type,         // enum: 'original' | 'self_designed' | 'fanwork' (原创/自设/同人)
  cover_image_url,      // 主图（建议 9:16 或 3:4）
  avatar_url,           // 头像（1:1，可从主图截取）
  tags,                 // jsonb 数组：[古风, 治愈, 校园, ...]
  bio,                  // 「角色介绍」，给读者看，明确"不纳入推理"（不进 prompt）
  visibility,           // 'public' | 'private' | 'unlisted'

  // —— B. 角色设定（进入 LLM prompt 的部分） ——
  persona,              // 「人设」主 textarea（核心 prompt，含 token 计数）
                        //   placeholder 模板："样例：[{{char}}设定] 身份/外貌/音色/穿衣习惯/
                        //   饮食偏好/兴趣爱好/性格/对{{user}}的情感/简介"
  adversity,            // 「逆境处理」—— 角色面对冲击时的独特反应，拼到 system prompt 末尾
  default_cognition,    // 「默认认知」—— 对用户的默认认知设定（v2 加 mask 覆盖机制）
  opening,              // 「开场设计」—— 含 <message>/<scenario>/<system> 标签的首消息
                        //   v1 由聊天页解析这些标签分别渲染为 AI 气泡/旁白/系统设定

  // —— C. 高级设置（折叠 panel，对应竞品表单的「高级设置 - 更多设定、背景等」） ——
  plot_setting,         // 「情节设定」—— 预设剧情走向，含「达成条件 / 结局」格式建议
                        //   拼到 system prompt 的「情节走向」段，让 AI 知道可能的故事线
  output_setting,       // 「输出设定」—— 角色输出格式约束（剧情快慢、对话/描述、群像/单主角等）
                        //   拼到 system prompt 的「输出格式约束」段
  sample_dialogue,      // 「样例对话&文风」—— few-shot 文风示例
                        //   拼到 system prompt 的「样例对话与文风」段（不进 messages 前缀，避免被模型当成真实历史污染剧情）
                        //   语法约定：用 ## User: / ## Assistant: 分段（v1 内置 placeholder 提示这格式）
  global_css,           // 「全局美化」—— creator 写的 <style>...</style>，注入聊天页全局作用域
                        //   只能针对 nj_* 前缀的稳定 selector；必经 CSS 白名单（防 position:fixed 等劫持）
                        //   v1 完整启用，详见模块 5
  mini_theatre,         // 「小剧场」—— HTML/SVG 片段，v1 schema 占位，标"实验性"暂不渲染

  // —— D. 元数据 ——
  conversation_count,   // 冗余字段，定期刷新
  created_at, updated_at
}

// 注：模板变量 {{char}}、{{user}} 在拼接 system prompt 时做简单字符串替换

// 会话（一个用户和一张卡的对话线程）
sessions {
  id, user_id (-> users), character_id (-> characters),
  title,                // 自动从首消息提取或用户改名
  created_at, updated_at, last_message_at
}

// 消息
messages {
  id, session_id (-> sessions),
  role,                 // 'user' | 'assistant'
  content,              // 原始文本（含 AI 输出的短 XML）
  rendered_html,        // 经正则替换 + DOMPurify 后的 HTML（缓存，可重新生成）
  model,                // 'claude-sonnet-4-6' 等
  tokens_in, tokens_out, latency_ms,
  created_at
}

// 正则规则（绑定到角色卡）
regex_rules {
  id, character_id (-> characters),
  name,                 // 「环境状态面板」
  mode,                 // 'tool' (自动挡四类) | 'general' (手动挡)
  tool_type,            // 'code_component' | 'symbol_match' | 'text_style' | 'content_filter'

  // 创作者工作流的"原始素材"（步骤 1 + 步骤 3 输入）
  target_text,          // 创作者贴的 AI 输出结构样例（如 <环境数据>...</环境数据>）
                        //   工具模式：系统从这里推导 pattern + 提取捕获组
                        //   通用模式：可空，仅用作测试面板的种子文本

  // 编译产物（运行时实际用的两个字段）
  pattern,              // 正则表达式（工具模式自动生成 / 通用模式用户手写）
  replacement,          // 替换字符串，支持 $1 $2 捕获组，可含 HTML/CSS/JS

  // 渲染路径（v1 双轨：静态 sanitize / 交互 iframe）
  runtime,              // enum: 'sanitize' | 'iframe'
                        //   'sanitize'（默认）: 静态 HTML/CSS，走 DOMPurify + react-markdown 内联渲染
                        //   'iframe': 含 <script> 或需 host API 的交互组件，走 sandbox iframe srcdoc + MessagePort
                        //   创建规则时按 replacement 是否含 <script> 自动检测，creator 可手动覆盖

  // 变量映射元数据（工具模式专属，UI 渲染映射点击器用）
  variable_mapping,     // jsonb: [{ index: 1, name: '时间', sample: '13:37:33' }, ...]

  // 输出指令（拼到 system prompt，教 AI 何时/如何输出该组件）—— 关键字段，不能省
  output_guidance,      // text，参考竞品范式：「在每次对话开头时输出 <环境数据></环境数据>
                        //   组件：<环境数据><时间>填写当前剧情时间</时间>...</环境数据>」

  enabled,              // 全局开关
  visible,              // 是否对终端用户暴露开关（用户可在聊天页关闭可见性 true 的规则）
  order_index,          // 应用顺序
  created_at, updated_at
}

// 用户对正则的个人开关（visible=true 的规则）
user_regex_preferences {
  user_id, regex_rule_id, enabled
  PRIMARY KEY (user_id, regex_rule_id)
}
```

**索引重点：**
- `characters (visibility, created_at DESC)` —— 探索页推荐流
- `characters USING gin (tags jsonb_path_ops)` —— 标签筛选
- `messages (session_id, created_at)` —— 历史读取
- `regex_rules (character_id, order_index)` —— 应用顺序

---

## 四、核心模块拆解

### 模块 1 · 探索页 (`src/app/explore/page.tsx`)

**v1 形态：**
- 顶部：搜索框 + 「显示 NSFW」toggle（localStorage 持久化，默认 ON）+ 用户头像
- 左侧 nav（图标条）：探索 / 创建 / 我的 / 设置
- 主体：
  - 一级 Tab：**推荐** / **最新** / **全部**（先不做关注/趋势/MuMu推荐）
  - 二级标签筛选条：单选「性向」(BG/BL/GL/全部) + 多选题材 tag（古风/校园/治愈…），先写死 10-15 个
  - 角色卡网格：3-4 列响应式，卡片含立绘 + 标签 chip + 名称 + 描述 + 对话数
    - NSFW 卡显示一个角标（如左上角"R18"或小图标），让用户一眼分辨

**NSFW 筛选逻辑：**
- 「显示 NSFW」toggle = OFF → query 加 `WHERE nsfw = false`
- 「显示 NSFW」toggle = ON → 无过滤，所有卡都展示
- **平台不主动做任何内容检测**，nsfw 字段完全靠创作者自报

**推荐逻辑 v1：**
- 推荐 = `conversation_count DESC` + 一点时间衰减（最近 7 天权重 ×2）
- 最新 = `created_at DESC`
- 全部 = `created_at DESC` 但分页大

**实现要点：**
- 用 RSC 直接 query 数据库渲染初始页面，分页用 `cursor` 模式（不用 offset，避免大库慢）
- 标签 chip 点击通过 URL 参数实现，避免重复 fetch
- 搜索框 v1 用 Postgres `ILIKE` + GIN 索引，后期换 Meilisearch

### 模块 2 · 聊天页 (`src/app/chat/[sessionId]/page.tsx`)

**v1 形态：**
- 左侧：会话列表（按 last_message_at 排序）
- 右侧：消息流 + 输入框
- 顶部条：角色立绘 + 名称 + 「角色信息」按钮（弹窗展示人设、正则、开场）

**稳定 selector 挂载：** 所有聊天页 UI 必须挂 `nj_*` 前缀的 ID/class 作为 creator CSS 的锚点。完整清单见模块 5.1，简版：
- `<header id="nj_chat_header">` 含 `#nj_back_button` / `#nj_header_follow_btn` 等
- `<div id="nj_chat_input_container">` 含 `#nj_chat_input_box` + textarea + 各按钮
- 消息气泡按角色 + 标签类型挂 `.nj_ai_message_bubble` / `.nj_user_message_bubble` / `.nj_message_system` / `.nj_message_narration`
- React 组件内部样式继续用 CSS Modules / Tailwind；这套 selector **额外挂**，仅供 creator CSS 锚定，**不用于内部样式**

**消息流处理（核心）：**
```
用户输入 → POST /api/chat
        → 拼装 system prompt（详细组装见模块 4.4 buildSystemPrompt）:
            persona + adversity + default_cognition
            + plot_setting（情节走向段）+ output_setting（输出格式约束段）
            + sample_dialogue（样例对话与文风段，作为参考样例非真实历史）
            + opening 解析出的 <scenario>/<system> 段
            + 所有 enabled regex_rules 的 output_guidance（教 AI 何时产出短 XML）
            + 做 {{char}} / {{user}} 模板变量替换
        → 拼装 messages 数组：
            [
              ...session.messages,                          // 真实历史（sample_dialogue 不入此列，已在 system prompt）
              { role: 'user', content: userInput }          // 当前输入
            ]
        → opening 字段在会话初始化时解析：
          <message> → 写入 messages 表作为 AI 第一条消息（注：这条消息也会走 applyRegex）
          <scenario> / <system> → 已经拼到 system prompt（见上）
        → AI SDK streamText({ model, system, messages, ... })
        → 流式 SSE 边收边写 messages.content
        → 收完触发 applyRegex(message.content, character.regex_rules, user.preferences)
        → 把 rendered_html 写回 messages.rendered_html
        → 客户端 useChat() 接收原始流，前端实时增量调用 applyRegex 局部渲染
        → 通过 react-markdown + rehype-raw + DOMPurify 渲染
```

**AI SDK 的好处直接体现：**
- `streamText({ model: anthropic('claude-sonnet-4-6') })` 换成 `google('gemini-2.5-pro')` 或 `openai('gpt-4o')` 业务代码零改动
- 后续要加 tool call、structured output、reasoning 都是 SDK 自带能力，不用手写适配

**关键：流式渲染时正则匹配怎么处理？**
- 流式过程中 AI 还没输出完，`<EnvironmentData>` 可能只有半截
- 方案：维护一个 buffer，遇到完整的 XML 开闭对才触发该条规则；闭合标签出现前显示原始文本占位
- 这是 vibe coding 第一个"硬骨头"，预留 POC 时间打磨（见里程碑 W3 POC、W6 正式实现）

### 模块 3 · 角色卡 (`src/app/characters/`)

**对齐竞品在线创建表单的字段集**（中等深度，不到完整 50+ 模块，但远超 5 字段骨架）。完整字段定义见第三节 `characters` 表。

**UI 分组（对照截图）：**

**A. 角色信息**（meta / 探索页用）
- 名称、性别、年龄
- 基础类别：NSFW 开关（创作者自报）/ 是否为AI 开关
- 内容类型：原创 / 自设 / 同人（单选）
- 角色图片：主图（建议 9:16 或 3:4）+ 头像（1:1，从主图截取或单独上传）
- 角色标签（chip 多选 + 自由输入）
- 角色介绍（textarea，明确标注「不纳入推理，仅用于卡片描述」）
- 角色可见性（公开 / 私密 / 不列出）

**B. 角色设定**（进入 LLM prompt，核心展开）
- **人设**（主 textarea，含 token 计数器；placeholder 写入竞品风格的样例骨架）
- **逆境处理**（textarea，对应"角色面对冲击的独特反应"）
- **默认认知**（textarea，对用户的默认设定）
- **开场设计**（textarea，含 `<message>` `<scenario>` `<system>` 三类标签的语法提示）

**C. 高级设置**（折叠 panel，默认收起；对应竞品的「高级设置 - 更多设定、背景等」）
- **情节设定**（textarea，含 token 计数器；placeholder 提示"达成条件 / 结局"格式）—— 拼到 system prompt 的「情节走向」段
- **输出设定**（textarea，含 token 计数器；placeholder 提示"剧情快慢 / 对话 vs 描述 / 群像 vs 单主角"等）—— 拼到 system prompt 的「输出格式约束」段
- **样例对话&文风**（textarea，含 token 计数器；placeholder 提示"## User: ... / ## Assistant: ..."格式）—— 拼到 system prompt 的「样例对话与文风」段
- **全局美化**（textarea，整段 `<style>...</style>`） —— 注入聊天页，**强制经过 CSS 白名单 walker**，详见模块 5。旁边「✨ AI 美化」按钮 → 走 global-css 生成器（详见模块 7）
- **小剧场**（textarea，HTML / SVG 片段） —— v1 UI 标 `实验性`，schema 占位不渲染

**D. 正则规则**（独立 Tab，连到模块 4）
- 见模块 4 —— 创建/编辑角色页有「正则规则」侧栏 Tab

**v1 运行时启用矩阵：**

| 字段 | schema | UI 展示 | 运行时启用 |
|------|--------|---------|------------|
| name / gender / age / tags / bio / cover_image / avatar / visibility / nsfw / is_ai / content_type | ✅ | ✅ | ✅ 完整 |
| persona | ✅ | ✅ | ✅ 完整（拼到 system prompt） |
| opening | ✅ | ✅ | ✅ 解析 `<message>` / `<scenario>` / `<system>` 标签分别渲染 |
| adversity | ✅ | ✅ | ✅ 追加到 system prompt 末尾 |
| default_cognition | ✅ | ✅ | ⚠️ v1 直接拼到 system prompt（mask 覆盖机制 v2） |
| plot_setting | ✅ | ✅ | ✅ 拼到 system prompt「情节走向」段 |
| output_setting | ✅ | ✅ | ✅ 拼到 system prompt「输出格式约束」段 |
| sample_dialogue | ✅ | ✅ | ✅ 拼到 system prompt「样例对话与文风」段（作为参考样例而非真实历史，避免污染剧情上下文） |
| global_css | ✅ | ✅ | ✅ 完整启用：注入聊天页 + 经 CSS 白名单过滤 + 仅允许 `nj_*` 前缀 selector，详见模块 5 |
| mini_theatre | ✅ | ✅ | ❌ v1 标"实验性"，不渲染 |

**模板变量：** `{{char}}` → 角色名，`{{user}}` → 当前用户的人设面具名（v1 = display_name）。拼接 system prompt 时做字符串替换。

**v1 不做：**
- 模板下载（顶栏按钮，v1 由 docs 站点提供示例 JSON 链接代替）
- 草稿箱、暂存（底栏按钮，v1 用一次性创建表单）
- 引继码导入/导出（B 块的美化模版） —— global_css 让创作者裸写
- token 计数器精确实现（v1 用 `content.length / 2` 粗估）
- AI 生成助手（"AI 一键生成指令"）
- 9:16/3:4 立绘强制比例校验（v1 上传任意尺寸，截取头像让创作者手动）

**v1 做（对照截图明确）：**
- 「文件导入」/「角色导出」顶栏按钮 → 见模块 6 导入导出系统
- 角色卡 16 字段含「高级设置」折叠 panel（情节设定 / 输出设定 / 样例对话&文风）

**实现要点：**
- 创建后 redirect 到角色详情页（左：人设预览，右：「立即测试」嵌入式聊天窗口）
- 编辑保存按钮 + 「测试」按钮并排 —— 创作者改完立刻在右侧测试，类似竞品的实时预览
- 表单分组用折叠 panel，默认展开 A，B/C 折叠，避免一上来"50+ 字段恐惧"

### 模块 4 · 正则系统 (`src/lib/regex/`)

**这是项目的灵魂，单列一节。** 设计上要分清两条时间线：
- **创作期**（Build-time）—— 创作者在角色卡编辑页配置规则（6 步工作流，对应竞品手册）
- **聊天期**（Runtime）—— 用户和角色对话时，规则在两端发力（system prompt 注入 + AI 输出后正则替换）

#### 4.1 创作者工作流（对齐竞品 6 步手册）

**入口：** 角色卡编辑页 → 「正则规则」侧栏 Tab（标题"正则创建 - 文本过滤、稳定美化"，副标题"通过正则规则可以过滤文本并注入稳定交互美化渲染"）

**列表页空状态：** 居中插画 + 文案"这张角色卡还没有正则，点击创建一条吧"。列表页右上三个按钮：「选择导出」/「选择导入」/「新建正则」。

**新建正则弹窗 UI（左右分栏）：**

```
┌─────────────────────────────────────┬─────────────────────────┐
│ [工具模式]  [通用模式]              │ 测试面板                │
│                                     │                         │
│ 正则名称                            │ 测试字符  如何测试?    │
│ ┌─────────────────────────────────┐ │ ┌─────────────────────┐ │
│ │                                 │ │ │ 模拟 AI 输出...     │ │
│ └─────────────────────────────────┘ │ │ (默认预填 target_text)│ │
│                                     │ └─────────────────────┘ │
│ 启用 [⬤]   可见性 [○] 是否对用户可见│                         │
│                                     │ [    测试    ]          │
│ ┌── tool_type tab ─────────────┐    │                         │
│ │ [代码组件] 符号匹配 文本样式 ...│   │ 效果预览               │
│ └─────────────────────────────┘    │ ┌─────────────────────┐ │
│                                     │ │ 渲染结果...          │ │
│ ◎ 目标字符  如何设计格式?  [载入模板]│ │ (applyRegex 实时跑) │ │
│ ┌─────────────────────────────────┐ │ └─────────────────────┘ │
│ │ AI输出的规范文本...             │ │                         │
│ │ <标识符>                        │ │                         │
│ │   <变量名1>动态变量</变量名1>   │ │                         │
│ └─────────────────────────────────┘ │                         │
│                                     │                         │
│ </> 正则表达式  自动生成（只读）    │                         │
│ ┌─────────────────────────────────┐ │                         │
│ │ <标识符>\s*<变量名1>(.*?)</...│ │                         │
│ └─────────────────────────────────┘ │                         │
│                                     │                         │
│ (... 替换字符串 + output_guidance ...) │                       │
│                                     │                         │
│       [ 取消 ]  [ 创建正则 ]        │                         │
└─────────────────────────────────────┴─────────────────────────┘
```

**关键 UI 元素：**

- **顶部双 tab：** 工具模式 / 通用模式（切换即清空 tool_type 子 tab + target_text 重置）
- **正则名称 input**（必填，用于规则列表展示 + output_guidance section 拼 prompt 时的标题）
- **启用开关**（绑 `regex_rules.enabled`，默认 ON）
- **可见性开关**（绑 `regex_rules.visible`，副标题"是否对用户可见"。默认 OFF，creator 显式开后用户在聊天页能看到这条规则并可关闭它）
- **tool_type 子 tab**（仅工具模式可见）：代码组件 / 符号匹配 / 文本样式 / 文本过滤
- **目标字符 textarea** + 旁边小链接「如何设计格式?」（跳转 docs.dearm.ai/regex 或类似）+ 「载入模板」按钮（弹小窗列内置案例如"环境状态面板""动态记忆区""寄情手机"，点击后预填 target_text + replacement + output_guidance + runtime）+ **「✨ AI 生成」按钮**（target-text 生成器，详见模块 7）
- **正则表达式 textarea**（自动生成，只读；标"自动生成"小标签）—— 通用模式下变可编辑
- **替换字符串 textarea**（含变量映射 chip 列：[$1 时间] [$2 天气]，点击插入光标）+ **「✨ AI 生成」按钮**（replacement-html 生成器，输入组件类型+风格，AI 自动用 variable_mapping 把 $1/$2 填到位）—— 在弹窗下半，超出截图但 4.1 步骤 4 已描述
- **output_guidance textarea** + **「✨ AI 写指令」按钮**（output-guidance 生成器，自动推断 target_text + replacement）—— 4.1 步骤 6 已描述
- **测试面板**（右半固定）：测试字符 textarea + 「测试」按钮（手动触发，也可 onChange 自动 300ms 防抖）+ 效果预览框
- **底部按钮：** 取消 / 创建正则
- **顶部右侧关闭 X** 和左侧"教程"链接（跳 docs）

**两个帮助链接：**
- 「如何设计格式?」(在目标字符旁) → 跳转 `/docs/regex/target-text-formats`
- 「如何测试?」(在测试字符旁) → 跳转 `/docs/regex/testing`

v1 不真做 docs 站点，链接先指向 GitHub README 的 anchor，或 `docs/handover/regex-system.md` 的相应章节。

**工具模式 - 代码组件 的完整 UX 流程**（对照竞品 6 步，其他三种 tool_type 简化但同构）：

```
步骤 1 准备文本
  └─ 创作者粘贴 AI 输出结构样例到「目标字符」textarea
     例：<环境数据><时间>13:37:33</时间><天气>多云转小雨</天气>...</环境数据>
     存到 regex_rules.target_text
     ↓
步骤 2-3 自动生成
  └─ 系统解析 target_text → 用 fast-xml-parser 提取结构
     → 自动生成 pattern：<环境数据>\s*<时间>(.*?)</时间>\s*<天气>(.*?)</天气>\s*<环境>(.*?)</环境>\s*</环境数据>
     → 按顺序识别捕获组：[{ index: 1, name: '时间', sample: '13:37:33' }, ...]
     → 存 regex_rules.pattern + variable_mapping
     UI 把 pattern 显示在只读 textarea（标"自动生成"小标签；通用模式下变可编辑）
     ↓
步骤 4 填写美化代码 + 映射回填
  └─ 创作者把美化 HTML 模板粘到「替换字符串」textarea（含 <style>...</style> 整段）
     右侧列出 variable_mapping 的 chip：[$1 时间] [$2 天气] [$3 环境]
     点击 chip → 把 $1/$2/$3 插入到光标位置（v1 不做拖拽，光标点击就够）
     存 regex_rules.replacement
     ↓
步骤 5 测试面板（右侧分栏实时预览）
  └─ 测试字符 textarea（默认用 target_text 预填）+ 效果预览框
     创作者改测试字符 → onChange 防抖 300ms 重新渲染（也可点「测试」按钮手动触发）
     实时调 applyRegex(testInput, [thisRule], {}) → 按 runtime 字段走 sanitize 或 iframe
     ↓
步骤 6 输出指令
  └─ 创作者写「output_guidance」textarea，告诉 AI 何时/怎样产出该组件
     例：「在每次对话开头时输出 <环境数据></环境数据> 组件：
           <环境数据><时间>填写当前剧情时间</时间>...</环境数据>」
     存 regex_rules.output_guidance
     → 聊天期会拼到 system prompt
```

**v1 不做（但 schema 已经为之留余地）：**
- 拖拽变量回填（v1 用点击插入）
- 正则模板市场（内置案例在「载入模板」按钮里走系统模板路径，不做用户上架）
- ReDoS 灾难性回溯检测器（仅 lint 警告占位，不强制拒绝）

**v1 做（对照截图新发现）：**
- 「选择导入」/「选择导出」批量正则规则 JSON 包 —— 见模块 6 导入导出系统

#### 4.2 数据流（聊天期 / Runtime）

```
                     ┌── 拼接 ──┐
character.regex_rules ─┤ system  ├─→ 写入 system prompt 的「输出指令」段
  .output_guidance     │ prompt  │
                     └─────────┘

用户消息 + system prompt → LLM → AI raw output（含短 XML 标签）
                                      │
                                      ↓
              character.regex_rules.pattern + replacement
              user_regex_preferences （visible 规则的用户开关）
                                      ↓
                              applyRegex()
                                      ↓
                  rendered_html（含富 HTML + 可能含 <script>）
                                      ↓
                  按 regex_rule.runtime 字段分流：
        ┌──────────────────────┴───────────────────────┐
        ↓ runtime='sanitize'                            ↓ runtime='iframe'
   DOMPurify 剥 script/iframe                      iframe sandbox srcdoc
        ↓                                               ↓
   react-markdown + rehype-raw                    MessagePort 建立
        ↓                                               ↓
   内联到 <Message> 组件                          host API postMessage 协议（见 4.6）
                                                        ↓
                                                  iframe 内执行 creator JS
```

**关键设计：** v1 双轨渲染。简单状态面板（环境数据、动态记忆区）走 sanitize 路径，零 JS、零额外开销；交互组件（Dearm 手机、可玩物品栏）走 iframe 路径，creator 能写真实 JS 但被严格隔离。**两条路在 schema 上由 `runtime` 字段标识，运行时一处分流。**

**正则规则在 system prompt 和 AI 输出处理两端协同：**
- system prompt 端：拼接所有 `enabled=true` 规则的 `output_guidance`，教 AI 何时输出什么标签
- 输出处理端：`applyRegex()` 把 AI 输出的标签替换成富 HTML，再按 runtime 字段决定渲染路径

#### 4.3 `applyRegex()` 实现要点（`src/lib/regex/apply.ts`）

```ts
function applyRegex(
  raw: string,
  rules: RegexRule[],
  userPrefs: Map<string, boolean>
): Array<HtmlSegment | IframeSegment> {
  // 1. 过滤：enabled === false 跳过；visible === true 但用户关闭跳过
  // 2. 按 order_index 升序逐条应用
  // 3. 每条规则：new RegExp(pattern, 'g') + raw.replace(pattern, replacement)
  // 4. 关键变化：返回**分段数组**而非单字符串
  //    - sanitize 规则产出 → HtmlSegment（后续走 DOMPurify）
  //    - iframe 规则产出 → IframeSegment { srcdoc, regexRuleId, captureGroups }
  // 5. 未匹配的原始文本作为 HtmlSegment 保留（走 sanitize）
  // 6. ReDoS 防御：每条规则限制执行时间 50ms（v1 先信任 creator，预留接口）
}

type HtmlSegment = { type: 'html', content: string }
type IframeSegment = {
  type: 'iframe',
  srcdoc: string,
  regexRuleId: string,
  captureGroups: string[]  // $1, $2... 的原始值，用于 host API 注入
}
```

渲染层（`<MessageBubble>` 组件）遍历分段数组：HtmlSegment → DOMPurify + react-markdown；IframeSegment → `<RegexIframe>` 组件（见 4.5）。

#### 4.4 System prompt 拼装（`src/lib/ai/build-prompt.ts`）

```ts
function buildSystemPrompt(character: Character, user: User): string {
  const ctx = { char: character.name, user: user.display_name }
  return [
    // 1. 角色设定主体
    interpolate(character.persona, ctx),
    character.adversity && `## 逆境处理\n${interpolate(character.adversity, ctx)}`,
    character.default_cognition && `## 默认认知\n${interpolate(character.default_cognition, ctx)}`,
    // 2. 高级设置中的剧情/输出/样例约束
    character.plot_setting && `## 情节走向\n${interpolate(character.plot_setting, ctx)}`,
    character.output_setting && `## 输出格式约束\n${interpolate(character.output_setting, ctx)}`,
    character.sample_dialogue && `## 样例对话与文风（仅作风格参考，非真实历史）\n${interpolate(character.sample_dialogue, ctx)}`,
    // 3. 开场设计中的非 message 部分
    parseOpening(character.opening).scenarios,
    parseOpening(character.opening).systems,
    // 4. 所有启用规则的输出指令（关键：让 AI 知道何时产出短 XML）
    buildRegexGuidanceSection(character.regex_rules),
  ].filter(Boolean).join('\n\n')
}

function buildRegexGuidanceSection(rules: RegexRule[]): string {
  const enabled = rules.filter(r => r.enabled && r.output_guidance)
  if (!enabled.length) return ''
  return '## 输出格式要求\n' + enabled.map(r =>
    `### ${r.name}\n${r.output_guidance}`
  ).join('\n\n')
}
```

**为什么 sample_dialogue 进 system prompt 而非 messages 前缀（重要决策）：**
- 进 messages 前缀的隐性风险：模型把 few-shot pair "当成真的发生过的事"，会引用其中的"事实"作为剧情背景污染当前会话
- 进 system prompt 段落（前缀"仅作风格参考，非真实历史"）：模型理解为风格模板，文风/语气模仿但不污染剧情
- 同时 system prompt 段落的注意力比中段 messages 历史更稳定（长对话后期不会衰减），适合放反复要遵循的样本
- 这是 寄情 与"教科书 few-shot"做法的反转，来自竞品 creator 实战经验

#### 4.5 iframe Sandbox 协议（交互组件渲染层）

**`<RegexIframe>` React 组件**（`src/components/regex/RegexIframe.tsx`）

```tsx
function RegexIframe({ segment, hostContext }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const portRef = useRef<MessagePort | null>(null)

  useEffect(() => {
    const iframe = iframeRef.current!
    iframe.addEventListener('load', () => {
      // 建立 MessagePort 通道（不依赖 origin 校验，因为 srcdoc 的 origin 是 'null'）
      const channel = new MessageChannel()
      portRef.current = channel.port1
      iframe.contentWindow!.postMessage({ type: 'init', context: hostContext },
                                        '*', [channel.port2])
      channel.port1.onmessage = handleIframeMessage
    })
  }, [])

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"      /* 关键：allow-scripts 但不 allow-same-origin */
      srcdoc={wrapWithHostBridge(segment.srcdoc, segment.captureGroups)}
      className="w-full"
      /* CSP 通过 srcdoc 内的 <meta http-equiv="Content-Security-Policy"> 注入 */
    />
  )
}
```

**Sandbox 属性组合：**

| 属性 | 给/不给 | 理由 |
|------|---------|------|
| `allow-scripts` | ✅ 给 | 否则 creator 写不了交互逻辑 |
| `allow-same-origin` | ❌ 不给 | 给了就能读 parent cookie、parent DOM、localStorage；这是核心防线 |
| `allow-forms` | ❌ 不给 | iframe 不需要原生表单 submit，所有动作走 host API |
| `allow-popups` | ❌ 不给 | 防止恶意弹窗 |
| `allow-top-navigation` | ❌ 不给 | 防止 iframe 把宿主页面导航走 |
| `allow-modals` | ❌ 不给 | 防止 alert/confirm 弹窗骚扰 |

**iframe 内的 CSP**（通过 srcdoc 注入 `<meta http-equiv="Content-Security-Policy">`）：

```
default-src 'self' 'unsafe-inline';        /* iframe 内 inline script 必须允许（creator 代码就在这） */
connect-src 'none';                          /* 关键：禁止 fetch / XHR / WebSocket，防止把用户对话外泄 */
script-src 'self' 'unsafe-inline' <白名单>;  /* 仅允许预审过的 CDN */
style-src  'self' 'unsafe-inline' <白名单>;
img-src    'self' data: https:;             /* 图片宽松一些，立绘/头像/表情包多源 */
font-src   'self' data: https:;
frame-src  'none';                           /* 禁止嵌套 iframe */
```

**v1 CDN 白名单**（开放问题第 10 条决策）：

- `cdn.tailwindcss.com`（Tailwind Play CDN）
- `cdn.jsdelivr.net`
- `unpkg.com`
- `fonts.googleapis.com` / `fonts.gstatic.com`
- `cdnjs.cloudflare.com`

#### 4.6 Host API（postMessage 协议）

iframe 里 creator 不能用 `window.parent.document`（被 sandbox 拦截），但能通过预注入的 `window.host` 对象与宿主通信。这是 寄情 给 creator 的**正式 SDK**，替代竞品的 DOM hack。

**注入机制：** `wrapWithHostBridge(srcdoc, captureGroups)` 在 creator 的 HTML `<head>` 里追加一段 bridge 脚本：

```js
<script>
  (function() {
    let port;
    let _resolvers = new Map();
    let _seq = 0;

    window.addEventListener('message', (e) => {
      if (e.data?.type === 'init') {
        port = e.ports[0];
        port.onmessage = (ev) => {
          const { id, result, error } = ev.data;
          const r = _resolvers.get(id);
          if (r) { (error ? r.reject : r.resolve)(error || result); _resolvers.delete(id); }
        };
        // 注入 host 上下文（含 capture groups、消息历史、角色卡 meta）
        window.host.context = e.data.context;
        window.dispatchEvent(new Event('host-ready'));
      }
    });

    function call(method, args) {
      return new Promise((resolve, reject) => {
        const id = ++_seq;
        _resolvers.set(id, { resolve, reject });
        port.postMessage({ id, method, args });
      });
    }

    window.host = {
      context: null,                            // 加载时由 init 注入
      sendMessage: (text) => call('sendMessage', { text }),
      getHistory: () => call('getHistory'),
      getCharacter: () => call('getCharacter'),
      setComponentState: (state) => call('setComponentState', { state }),
    };
  })();
</script>
```

**Host API 函数清单（v1）：**

| 方法 | 用途 | 返回 |
|------|------|------|
| `host.sendMessage(text)` | 在主聊天框发一条用户消息（替代 Dearm 手机的 `window.parent.document` hack） | Promise<void> |
| `host.getHistory()` | 拿当前会话消息列表（v1 限只读，仅 role + content） | Promise<{role, content}[]> |
| `host.getCharacter()` | 拿当前角色卡的 public 元数据（name / avatar / tags / bio） | Promise<CharacterMeta> |
| `host.setComponentState(state)` | 持久化组件状态（绑到 session × regexRuleId，下次打开恢复） | Promise<void> |
| `host.context` | 同步对象，含 `captureGroups: string[]`（$1, $2... 的原始值） + `userName: string`（display_name） | 见 init 注入 |

**v1 不做的 host API：** `sendImage / sendFile`（无上传管线）、`navigateTo`（不允许跨页面跳转）、`requestPermission`（无权限提示框 UI）。

**host 侧消息路由：** 在 `<RegexIframe>` 组件的 `handleIframeMessage` 里 switch method，调用 hooks（`useSendMessage` / `useChatHistory`）执行后回写 port。所有调用走 `(id, method, args) → (id, result|error)` 协议，简单同构。

**Creator 写组件的范式：**

```html
<script>
  window.addEventListener('host-ready', async () => {
    // 用 capture groups（$1, $2...）
    const [userMsgs, aiMsgs] = window.host.context.captureGroups
    renderBubbles(userMsgs.split('|||'), aiMsgs.split('|||'))

    // 用真实历史（替代 |||分隔字符串的 hack）—— 推荐
    const history = await window.host.getHistory()
    renderBubbles(history)
  })

  document.getElementById('send-btn').addEventListener('click', async () => {
    const text = document.getElementById('input').value
    await window.host.sendMessage(text)   // 替代 window.parent.document hack
  })
</script>
```

#### 4.7 工具模式（自动挡）的 4 种预设

| 场景 | 创作者输入到 target_text | 系统自动生成的 pattern | 创作者填 replacement |
|------|--------------------------|------------------------|----------------------|
| 代码组件 | XML 嵌套样例（如 `<环境数据><时间>...</时间>...</环境数据>`） | 按 XML 结构推导 pattern + 捕获每个叶子标签 | 美化 HTML 模板 + 点击映射回填 $1/$2/$3 |
| 符号匹配 | 包裹符号样例（如 `[开心]`） + 字典映射（独立 UI） | `\[(.*?)\]` | `<img src="${dict[$1]}">`（v1 字典存 jsonb 字段） |
| 文本样式 | 目标文本（字面或正则） + CSS 类名 | 用户输入直接转 pattern | `<span class="${cls}">$1</span>` |
| 内容过滤 | 屏蔽词或正则 | 用户输入直接转 pattern | `''`（空串） |

**通用模式（手动挡）：** target_text 可空、variable_mapping 不生成；裸 textarea 让用户写 pattern + replacement + output_guidance。

**runtime 选择：** 创作者保存规则时系统自动检测 replacement 是否含 `<script>` → 自动标 `runtime='iframe'`；否则默认 `'sanitize'`。creator 可在规则详情页手动覆盖（如想强制把简单 HTML 也丢 iframe 里测试）。

#### 4.8 5 个官方案例的对齐选择

按竞品文档的 5 个官方案例，v1 我们内置 **3 个**：

1. **环境状态面板**（sanitize 路径）—— 验证 sanitize 渲染管线 + 工具模式工作流，新人创作者第一个例子
2. **动态记忆区**（sanitize 路径）—— 短期记忆 / 长期记忆压缩，体现"正则不只是 UI 装饰，也参与认知"
3. **Dearm 手机适配版**（iframe 路径）—— 验证 iframe sandbox + host API 全套机制，是 v1 交互组件的旗舰案例。把外部原版的 `window.parent.document.querySelector(...)` hack 改写成 `await window.host.sendMessage(text)`

**v1 暂不做：**
- 地图组件（CSS 属性选择器有点 hacky，sanitize 路径勉强能做但优先级低）
- 表情包字典（要素材库 + 字典管理 UI，工程量大）

内置案例以"系统模板"形式提供：创作者新建正则时可选「从模板开始」→ 直接预填 target_text + replacement + output_guidance + runtime，一键创建。

#### 4.9 安全红线

**sanitize 路径：**
- **DOMPurify 必须强制开启**，禁止 `<script>` / `<iframe>` / 事件属性
- **白名单 CSS 属性**（DOMPurify 配置）：防止 `position:fixed` 之类的 UI 劫持

**iframe 路径：**
- sandbox 属性组合见 4.5（`allow-scripts` 但禁 `allow-same-origin` 等所有其他权限）
- CSP `connect-src 'none'` —— **绝对红线**，禁止 iframe 内 fetch/XHR/WebSocket，防止 creator 把用户对话外泄到自己服务器
- CDN 白名单写死在 srcdoc 模板里，creator 无法绕过
- iframe `srcdoc` 加载的 origin 是 `null` —— 不会污染任何 same-origin 资源
- host API 所有调用做 zod 校验 + rate limit（防止 iframe spam `sendMessage`）

**通用：**
- **正则规则的可执行性扫描**：拒绝包含 `.*.*.*` 这类灾难性回溯模式（lint 警告，不强制拒绝）
- **CSP header**（宿主页）：禁止 inline script execution，所有页面 JS 来自 build 产物

### 模块 5 · 全局美化系统 (`src/lib/styling/`)

**这是项目的第二大差异化**（仅次于正则系统）。creator 通过 `characters.global_css` 字段写 CSS，注入聊天页全局作用域，针对 寄情 暴露的 `nj_*` 前缀稳定 selector 改造视觉。

> **不做的：** 引继码买卖商店、CSS 主题分发市场、定价/抽成/交易。creator 自己写、自己用、可以贴文本分享给别人复制。

#### 5.1 稳定 selector 契约（一旦发布就是 API）

**前缀：`nj_`**（早期品牌缩写，已作为稳定 API 保留）。命名结构：`nj_<area>_<element>_<subelement>`。

| 区域 | 元素 | 类型 | Selector |
|------|------|------|----------|
| 聊天背景 | 背景图 | ID | `#nj_background_image` |
| 聊天背景 | 遮罩 | ID | `#nj_background_overlay` |
| 顶部栏 | 容器 | ID | `#nj_chat_header` |
| 顶部栏 | 返回按钮 | ID | `#nj_back_button` |
| 顶部栏 | 关注按钮 | ID | `#nj_header_follow_btn` |
| 顶部栏 | 亮度按钮 | ID | `#nj_header_clarity_btn` |
| 顶部栏 | 消息按钮 | ID | `#nj_header_message_btn` |
| 顶部栏 | 更多按钮 | ID | `#nj_header_more_btn` |
| 输入框 | 容器 | ID | `#nj_chat_input_container` |
| 输入框 | 框体 | ID | `#nj_chat_input_box` |
| 输入框 | textarea | 后代 | `#nj_chat_input_box textarea` |
| 输入框 | 重说按钮 | ID | `#nj_chat_input_replay_btn` |
| 输入框 | 模型按钮 | ID | `#nj_chat_input_model_btn` |
| 作者的话 | 容器 | ID | `#nj_author_note` |
| 聊天操作 | 按钮 | ID | `#nj_message_actions_btn` |
| 聊天操作 | 展开容器 | ID | `#nj_message_actions_box` |
| 聊天操作 | 删除 | ID | `#nj_message_actions_delete` |
| 聊天操作 | 修改 | ID | `#nj_message_actions_edit` |
| 聊天操作 | 复制 | ID | `#nj_message_actions_copy` |
| 气泡框 | AI 气泡 | Class | `.nj_ai_message_bubble` |
| 气泡框 | 用户气泡 | Class | `.nj_user_message_bubble` |
| 系统设定 | 卡片 | Class | `.nj_message_system` |
| 心理叙述 | 容器 | Class | `.nj_message_narration` |
| 代码块 | 容器 | Class | `.nj_code_block` |
| 加重句 | 文本 | Class | `.nj_emphasis_text` |
| 状态栏 | `<details>` 原生 | 标签 | `details summary`, `details li` |

**实现要求：**
- 所有 UI 组件渲染时**必须**挂这些 selector（即使 v1 内部 React 组件用 CSS Modules / Tailwind，也要额外 ID/class）
- selector 命名一旦发布就**不许改名**——破坏性改动必须走 deprecation 流程（保留 alias 至少一个 major version）
- 写一份独立的 [`docs/handover/selector-contract.md`](../handover/selector-contract.md)（v1 上线前完成），按上表 + 各 selector 的 DOM 位置截图 + 示例 CSS

#### 5.2 特殊渲染标签

AI 输出 + creator 的 opening 字段都会用这些标签。前端解析为对应 selector 的 DOM 元素。

| 标签 | 渲染为 | 来源 |
|------|--------|------|
| `<message>...</message>` | `<div class="nj_ai_message_bubble">...</div>` | opening 字段的开场消息 / AI 输出（也可省略标签自动判定为 AI 气泡） |
| `<system>...</system>` | `<div class="nj_message_system">...</div>` | opening 字段（同时拼到 system prompt）/ AI 输出 |
| `<narration>...</narration>` | `<div class="nj_message_narration">...</div>` | AI 输出心理叙述 |
| `<scenario>...</scenario>` | 不渲染，仅拼到 system prompt 的场景设定段 | opening 字段 |
| ` ```...``` ` | `<pre class="nj_code_block">...</pre>` | markdown 代码块 |
| `**bold**` | `<strong class="nj_emphasis_text">...</strong>` | markdown 加重 |
| `<details>...</details>` | HTML 原生，creator 可对 `details summary` / `details li` 写样式 | AI 输出状态栏 |

**`<system>` 的双重身份：** opening 字段里的 `<system>` 既作为初始消息渲染（创作者写好的场景设定卡片），也拼到 LLM 的 system prompt（让 AI 知道当前世界设定）。AI 输出里再次出现 `<system>` 时纯渲染。

#### 5.3 注入流程（`src/lib/styling/inject.ts`）

```ts
// 聊天页加载时：
function injectCharacterStyle(global_css: string, characterId: string) {
  // 1. 解析 CSS（postcss）→ AST
  const ast = postcss.parse(global_css)

  // 2. 经白名单校验（详见 5.4），删除非法规则、违规属性
  const sanitized = sanitizeCss(ast)

  // 3. 自动注入 scope 前缀，防止泄漏到全局：
  //    `.nj_ai_message_bubble { color: red }`
  //    → `[data-character-css="${characterId}"] .nj_ai_message_bubble { color: red }`
  //    聊天页根节点挂 `data-character-css={characterId}`，CSS 仅对当前角色生效
  const scoped = addScopePrefix(sanitized, characterId)

  // 4. 渲染为 <style> 标签，挂到 chat 页 <head>
  return <style dangerouslySetInnerHTML={{ __html: scoped.toString() }} />
}
```

**关键设计：scope 隔离** —— 不同角色卡的 CSS 互不干扰。切换角色卡时旧 style 卸载、新 style 加载。

#### 5.4 CSS 白名单（防 UI 劫持）

**允许的属性：**
- 颜色：`color`, `background-color`, `background-image`, `background-*`
- 字体：`font-family`, `font-size`, `font-weight`, `font-style`, `letter-spacing`, `line-height`, `text-*`
- 边框：`border`, `border-*`, `border-radius`, `outline`, `outline-*`
- 阴影：`box-shadow`, `text-shadow`, `filter`, `backdrop-filter`
- 透明度：`opacity`
- 变换：`transform`, `transition`, `animation`, `@keyframes`
- 内外距：`margin`, `padding`（但限制极端值，如 `margin: -9999px`）
- 布局子属性：`flex-*`, `grid-*`, `gap`, `align-*`, `justify-*`
- 可见性：`overflow`, `visibility`

**禁止的属性（UI 劫持风险）：**
- `position: fixed | sticky`（防止覆盖宿主关键控件）—— `position: relative | absolute` 在 scoped 范围内允许
- `z-index` 超过预设上限（如 100）—— 防止凌驾于 modal / toast 之上
- `pointer-events: none` 用在禁掉点击的关键 selector 上（如 `#nj_chat_input_container`）—— v1 简化为：直接禁止 `pointer-events` 任何写法
- `cursor: none`（隐藏鼠标骚扰）

**禁止的 selector 形态：**
- 不能针对 `html`, `body`, `:root`（防止全局污染）
- 不能用 universal selector `*`（开销大 + 风险高）
- selector 第一个限定**必须**是 `nj_*` 前缀或允许的标签（`details summary`, `details li`, `strong`, `pre`）—— 否则规则被丢弃
- 禁止 `@import`（外部网络）
- 禁止 `url(http://...)` 之外的 `<style>` 嵌套、`expression(...)` 等 IE 老语法（理论上现代浏览器不解析，但保险起见过滤掉）

**实现：** 用 `postcss` 写一个 walker 遍历 AST，逐 declaration / selector 检查；不符合规则的删除。v1 不上 cssnano / autoprefixer。

#### 5.5 v1 不做

- **引继码导入/导出**（一段 base64 编码的 CSS 包）—— v1 让 creator 直接贴文本即可
- **AI 一键生成 CSS** —— 角色卡编辑页可以提供"复制 prompt 到剪贴板"的便捷按钮（把当前角色的 CSS 上下文 + selector 表 + 美化需求一起组装），但 v1 不直接接 LLM。这是给 creator 自己拿去问 ChatGPT 用的
- **多套 CSS 切换**（如同一角色卡的"白天/夜晚"两套主题）—— `global_css` 是单字段
- **CSS Live Preview**（编辑实时刷新预览）—— W8 看时间再决定

#### 5.6 安全红线（重复强调）

- CSS 白名单 walker **不可绕过**：所有 global_css 写入 DB 前用 walker 校验一遍存归一化形式（防止前后端校验不一致）
- scope 前缀 **自动且强制**：creator 即使写 `body { ... }` 也会被 walker 删掉，不存在"忘加 scope"的情况
- 切换角色卡时旧 `<style>` 必须卸载，不能累积污染

### 模块 6 · 导入导出系统 (`src/lib/import-export/`)

creator 能力的一部分（不是平台运营）：让创作者把角色卡 + 正则规则 + 美化 CSS 整体导出为 JSON，跨账号迁移或私下分享。

#### 6.1 范围

| 操作 | v1 做 | v1 不做 |
|------|-------|---------|
| 整张角色卡导出（含所有字段 + 关联正则规则 + global_css） | ✅ JSON 文件下载 | — |
| 整张角色卡导入 | ✅ JSON 上传 → 新建卡（owner 改为当前用户） | 覆盖已有卡（v2） |
| 正则规则批量导出（多选规则 → JSON 包） | ✅ 角色卡正则列表页「选择导出」按钮 | — |
| 正则规则批量导入 | ✅ 「选择导入」按钮，上传 JSON 后追加到当前卡 | 智能合并/冲突解决（v2） |
| 模板下载（顶栏「模板下载」按钮） | ❌ docs 站点提供 1-2 个示例 JSON 链接代替 | — |
| 引继码买卖 / 商店分发市场 | ❌ 永远不做（平台运营，不是 creator 能力） | — |

#### 6.2 JSON Schema

```ts
// 角色卡完整导出包
type CharacterExportV1 = {
  format: 'yearn.character',
  version: 1,
  exported_at: string,        // ISO 8601
  character: {
    // 所有 characters 字段（除 id / owner_id / conversation_count / created_at / updated_at）
    name, gender, age, nsfw, is_ai, content_type,
    cover_image_url, avatar_url, tags, bio, visibility,
    persona, adversity, default_cognition, opening,
    plot_setting, output_setting, sample_dialogue,
    global_css, mini_theatre,
  },
  regex_rules: Array<{
    // 所有 regex_rules 字段（除 id / character_id / created_at / updated_at）
    name, mode, tool_type, target_text, pattern, replacement,
    variable_mapping, output_guidance, runtime,
    enabled, visible, order_index,
  }>,
}

// 正则规则批量导出包
type RegexRulesExportV1 = {
  format: 'yearn.regex-rules',
  version: 1,
  exported_at: string,
  rules: Array<{ /* 同上 regex_rules 子结构 */ }>,
}
```

**导入流程：**
```
用户上传 .json → zod 校验 schema + version
              → version 不匹配：拒绝 + 提示用户更新平台或导出方降级
              → 校验通过：
                - 角色卡导入 → INSERT characters (owner_id = current_user) + INSERT regex_rules
                - 正则规则导入 → INSERT regex_rules WHERE character_id = current_open_card
              → 立绘/头像 URL 处理：
                - 如果是外部 URL（http/https）→ 保留原样
                - 如果是上传到原平台的 URL → v1 提示"图片需要重新上传"，schema 字段清空
                  (这是因为 URL 可能指向另一个 Dearm 实例的 R2，不可达)
```

#### 6.3 关键设计

- **`format` + `version`** 字段是兼容性闸门。未来 schema 演化时，导入时 version mismatch → 提示用户而非崩溃；可以写迁移函数 `migrateV1ToV2`（v1 暂不需要）
- **owner_id 强制改写**：导入的卡始终归当前用户所有，不能伪造 owner（防权限绕过）
- **正则规则的 order_index 重映射**：导入到已有卡时，新规则的 order_index 从当前最大值 + 1 开始递增，避免冲突
- **冲突角色卡名**：v1 允许同名（characters.name 不强制 unique on owner，creator 自己负责）
- **导入大小限制**：单个 JSON 文件上限 1MB（含 global_css + 所有 replacement HTML），超过提示用户拆分

#### 6.4 UI 入口

| 位置 | 按钮 | 行为 |
|------|------|------|
| 角色卡详情页右上 | 「导出角色卡」 | 下载 `{name}-{characterId}.character.json` |
| 角色卡创建页右上 | 「文件导入」 | 上传 JSON → 跳转到新卡的详情页 |
| 正则规则列表右上 | 「选择导出」 | 进入多选模式，勾选后下载 `rules-{characterId}.rules.json` |
| 正则规则列表右上 | 「选择导入」 | 上传 JSON → 追加到当前卡 |

**对应竞品截图的顶栏三按钮：**
- 「模板下载」→ v1 替换为 docs 站点的"示例下载"链接，不在产品 UI 里做
- 「文件导入」→ v1 做
- 「角色导出」→ v1 做

#### 6.5 v1 不做

- 跨实例图片迁移（导入时下载远程图 → 上传到本地 R2）—— v1 让 creator 重新上传
- 智能合并/冲突解决（"这个名字的规则已存在，要覆盖吗？"）—— v1 不检测，直接追加
- 加密导出（防止内容被他人复制）—— 与 creator 友好原则冲突，永远不做
- 模板市场（用户上架自己的卡作为模板供别人下载）—— v2 评估

### 模块 7 · AI 辅助生成系统 (`src/lib/ai/generators/`)

**核心差异化 #2。** 竞品的做法是文档里给一段固定 prompt，让 creator 复制到外部 AI 工具（ChatGPT/Claude）问，把回答粘回对方的 textarea。**割裂、丢上下文、要切换三四个标签页**。我们把这套做进产品：creator 点一个按钮，描述需求，AI 流式回填到 textarea，零跳转零复制。

#### 7.1 4 个生成器

| 生成器 | 触发位置 | creator 输入 | LLM 上下文 | 输出 |
|--------|----------|--------------|------------|------|
| **replacement-html** | 新建正则弹窗「替换字符串」上方「AI 生成」 | 组件类型（状态面板/对话气泡/物品卡/...）+ 视觉风格（暗色赛博朋克/可爱粉色/极简白色/...） | target_text + variable_mapping（$1=时间, $2=天气...） | HTML + CSS（含 `<style>`），$1/$2/$3 自动填到正确位置 |
| **global-css** | 角色卡「全局美化」textarea 上方「AI 美化」 | 目标 selector（dropdown 列 `nj_*` 完整表 + 多选）+ 视觉描述（紫色渐变白边 AI 气泡） | selector-contract.md 完整内容 + CSS 白名单 | 整段 `<style>...</style>`，经 walker 实时校验提示哪些被删 |
| **output-guidance** | 新建正则弹窗「输出指令」上方「AI 写指令」 | （无需额外输入，自动推断） | target_text + replacement（让 LLM 反推应该在什么场景输出该组件） | 「何时/怎样输出」段落（参考 4.1 步骤 6 范式） |
| **target-text** | 新建正则弹窗「目标字符」上方「AI 生成」 | 描述（"我要一个状态面板含时间天气环境氛围"） | （无） | XML 骨架（如 `<状态面板><时间>...</时间>...</状态面板>`） |

#### 7.2 调用通路

统一走 `/api/ai/generate`：

```ts
POST /api/ai/generate
Body: {
  type: 'replacement-html' | 'global-css' | 'output-guidance' | 'target-text',
  input: { /* 各 type 不同的输入对象 */ },
  context: { /* 各 type 不同的上下文，由前端组装传入 */ },
}

Response: text/event-stream  // 流式回填
```

后端 `src/lib/ai/generators/{type}.ts` 每个文件：
1. 拼装系统 prompt（含角色 = "组件生成器"/"CSS 美化助手"/etc）
2. 拼装 user prompt（含 input + context）
3. 调 AI SDK `streamText({ model: anthropic('claude-sonnet-4-6'), ... })`
4. 流式返回给前端

**为什么走 Claude Sonnet 4.6：** 对结构化输出（HTML / CSS / XML）和遵循样式约束（CSS 白名单告知）稳定性最好。AI SDK 让我们能用同一份代码切到 GPT/Gemini 做对比。

#### 7.3 Prompt 模板范式

每个生成器的 system prompt 内置在 `src/lib/ai/generators/prompts/{type}.txt`，creator 不可见、不可改。范式：

```
你是 寄情 的 {组件类型} 生成助手。

# 上下文
{动态注入的 selector 表 / target_text / variable_mapping 等}

# 强制约束
1. 输出**仅**为 {HTML/CSS/XML/文本指令}，不要解释、不要前后缀
2. {组件类型特有约束}：
   - HTML：width 100%、禁定宽、竖向优先、内联 <style>
   - CSS：仅针对 nj_* 前缀 selector、禁 position:fixed / pointer-events / *
   - XML：英文标签名优先（Gemini 类模型对中文标签输出不稳）

# 用户需求
{creator 输入}
```

参考竞品文档里那段「AI 一键生成指令」的提示词工程范式，但更精炼且**写死在我们后端**，creator 不需要知道。

#### 7.4 UI 流程

```
creator 点「AI 生成」按钮
    ↓
弹小窗收集输入（type 决定字段）
    ↓
点「开始生成」→ POST /api/ai/generate（流式 SSE）
    ↓
弹窗变成"生成中..."状态，进度条 + 中途文本预览
    ↓
流式完成 → 「应用到 textarea」按钮 + 「重新生成」按钮 + 「关闭」
    ↓
点「应用」→ 替换 textarea 内容（如果原本有内容，弹个 confirm 询问是否覆盖）
点「重新生成」→ 在同一弹窗内 + 同输入再调一次（让 creator 比对两次结果）
```

#### 7.5 Rate Limit + 成本控制

- 每用户每小时 20 次生成（v1 写死，后期看用量调整）
- Token 上限：每次生成最多 3000 输出 token（防 creator 把 AI 当聊天 bot 用）
- 失败降级：API 超时或错误 → 弹窗显示"AI 暂时不可用，请稍后重试"，不阻塞 creator 手动写
- v1 不做：账号级 token quota、付费解锁更多次数、模型选择（统一用 Sonnet 4.6）

#### 7.6 v1 不做

- AI 生成 persona / adversity / sample_dialogue 等角色卡 prompt 字段 —— v1 让 creator 自己写，这是创作核心，不该被 AI 代笔
- AI 修改/优化已有内容（如"把这段 CSS 改成暗色风"）—— v1 只做"从零生成"，迭代修改 v2
- 多轮对话式生成（"再加一点呼吸灯效果" → 接着上一次的产出改）—— v1 每次生成独立
- AI 生成参考图片（"按这张截图的风格"）—— v1 不接图

#### 7.7 安全红线

- 生成器返回值**必须**走对应的 sanitize / 白名单（CSS walker / DOMPurify 等）—— AI 也可能输出违规内容
- prompt 模板写死在后端，creator 不能用某种 injection 让 AI 输出非法内容（哪怕 AI 真输出了，后端 sanitize 会拦下）
- 生成 API 必须验证 creator 是当前角色卡的 owner（不能拿别人的 character_id 调）

### 模块 8 · 调试模式 (`src/components/chat/DebugPanel.tsx`)

**核心差异化 #3。** 当 creator 在测试自己的角色卡时，经常遇到"AI 输出了，但我的状态面板没渲染出来"——竞品让 creator 自己肉眼找原因（是 pattern 没匹配？是 output_guidance 不够清楚？是 AI 漏了标签？）。我们做一个内置调试面板，把这些信息全部摆出来。

#### 8.1 入口与可见性

- 聊天页右上角 toggle「调试」开关（角色卡 owner 才能看到这个开关，普通用户没有）
- 开启后聊天页所有 AI 气泡下方多出一个折叠面板「调试信息」（默认折叠，点击展开）
- 用 cookie / localStorage 持久化偏好

#### 8.2 调试面板内容

```
┌─ 调试信息（点击展开）─────────────────────────────┐
│ ▸ AI 原始输出（未经正则替换）                       │
│   <环境数据><时间>14:30</时间><天气>晴</天气>...   │
│                                                    │
│ ▸ 匹配的规则（2 条）                                │
│   ✓ 环境状态面板  →  pattern OK，捕获 [14:30, 晴]   │
│   ✓ 心情图标     →  pattern OK，捕获 [开心]          │
│                                                    │
│ ▸ 未匹配的启用规则（1 条）                          │
│   ✗ 物品栏面板  →  pattern <Inventory>... 无匹配    │
│     ↳ 提示：AI 没产出 <Inventory> 标签              │
│       检查 output_guidance 是否要求 AI 输出该组件   │
│                                                    │
│ ▸ 性能                                              │
│   tokens: 312 in / 1840 out                        │
│   latency: 4.2s                                    │
│   model: claude-sonnet-4-6                         │
│                                                    │
│ ▸ system prompt（点击展开，长文本，默认折叠）        │
│   [persona]...[adversity]...[plot_setting]...     │
└────────────────────────────────────────────────────┘
```

#### 8.3 实现

- 数据来源：`messages` 表加一个 `debug_info` jsonb 字段（仅 owner 可读，API route 加 ACL）
  ```ts
  debug_info: {
    raw_output: string,
    matched_rules: Array<{ ruleId, ruleName, captureGroups: string[] }>,
    unmatched_rules: Array<{ ruleId, ruleName, reason: string }>,
    tokens_in, tokens_out, latency_ms, model,
    system_prompt: string,
  }
  ```
- 生成时机：每次 chat 完成后，service 层组装 debug_info 写入
- 数据量：每条 AI 消息可能多 1-5KB（system_prompt 占大头）。可以在 schema 上分两个字段：常存的 `debug_summary`（不含 system_prompt，<200 bytes）+ 按需查询的 `debug_full`（含）
- v1 简化：直接全存 `debug_info`，不优化（等 DB 撑不住再分）

#### 8.4 创作者用调试模式定位问题的常见路径

| 现象 | 调试面板线索 | 解法 |
|------|--------------|------|
| 状态面板没渲染 | AI 原始输出里没有 `<环境数据>` 标签 | 改 output_guidance，强化"何时输出" |
| 状态面板有但显示错乱 | 匹配的规则里 capture groups 不对 | 检查 pattern 与 AI 实际输出的标签名/嵌套是否一致 |
| 状态面板显示但样式丑 | 匹配 OK，问题在 replacement | 编辑 replacement，预览面板调 |
| AI 答非所问 | system prompt 段折叠开看 persona / output_setting 是否冲突 | 改高级设置或 persona |
| 速度太慢 | latency: 8s+ | 减 persona 字数、减启用的 regex_rules 数量、换 Haiku 模型 |

#### 8.5 v1 不做

- 重放 AI 生成（"用同一 system prompt 再试一次"按钮）—— 实用但容易让 creator 把 AI 当玩具刷，v2 再做
- 对单条规则的"试运行"（不发到 LLM，只用 pattern 在 raw_output 上测试） —— W5 新建正则弹窗的测试面板已经覆盖，不重复
- system prompt 字符高亮（哪段是 persona / 哪段是 regex output_guidance）—— v1 用 markdown `## 标题` 分段，creator 看得懂就行

---

## 五、目录结构

```
dearm/
├── CLAUDE.md                    # 项目规则（开发纪律）
├── ARCHITECTURE.md              # 架构总览
├── README.md
├── package.json                 # bun 也读 package.json
├── bun.lockb                    # bun lockfile
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── biome.json                   # 或 .eslintrc + .prettierrc
├── lefthook.yml                 # git hook
├── src/
│   ├── app/
│   │   ├── (auth)/              # 登录注册
│   │   ├── (main)/
│   │   │   ├── explore/         # 探索页
│   │   │   ├── characters/      # 角色卡 CRUD
│   │   │   ├── chat/            # 聊天页
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── chat/route.ts    # 流式聊天 SSE（AI SDK streamText）
│   │   │   ├── characters/      # CRUD
│   │   │   └── regex/           # 规则 CRUD + 工具模式生成器
│   │   ├── layout.tsx
│   │   └── page.tsx             # 首页 = 重定向到 /explore
│   ├── components/
│   │   ├── ui/                  # Radix 基础组件
│   │   ├── chat/                # MessageList, MessageBubble, Composer
│   │   ├── explore/             # CharacterCard, TagFilter, TabBar
│   │   ├── character/           # CharacterForm, RegexEditor
│   │   ├── regex/               # RuleList, ToolModeForm, GeneralModeForm
│   │   └── layout/              # NavRail, AppShell
│   ├── lib/
│   │   ├── db/                  # schema.ts + migrations + queries
│   │   ├── ai/                  # AI SDK 封装 + model registry
│   │   ├── regex/               # apply.ts, presets.ts (4 种工具模式)
│   │   ├── sanitize.ts          # DOMPurify 配置
│   │   └── auth.ts              # Auth.js 配置
│   ├── hooks/
│   │   ├── useStreamingChat.ts  # 基于 AI SDK useChat
│   │   └── useRegexPreview.ts
│   ├── types/
│   │   └── index.ts             # 所有业务类型
│   └── i18n/
│       ├── zh.ts                # v1 中文为主
│       └── en.ts                # 占位，后期补
├── docs/
│   ├── exec-plans/
│   │   ├── active/v1-foundation.md  # 本文件
│   │   └── completed/
│   ├── handover/                # 技术交接文档
│   ├── insights/                # 产品思考文档
│   └── research/                # 调研文档
└── public/
    ├── examples/                # 内置正则规则模板示例
    └── placeholders/            # 默认头像 / 立绘
```

---

## 六、里程碑（按周）

| 周 | 里程碑 | 验收 |
|----|--------|------|
| **W1** | 项目脚手架 + DB schema + Auth | 能注册登录，schema 跑通迁移 |
| **W2** | 角色卡 CRUD（16 字段含高级设置折叠 panel）+ 探索页基本网格 | 能创建一张卡（A/B/C 三块字段都能填+保存），在探索页看到 |
| **W3** | 聊天流式 + AI SDK 接入 + buildSystemPrompt 完整拼装（含 plot_setting / output_setting / sample_dialogue 段）+ 流式正则 POC | 能与一张卡对话，sample_dialogue 文风模仿生效；消息持久化；POC 文档结论 |
| **W4** | 正则系统 V0 —— 通用模式（手动挡）+ output_guidance 拼接 system prompt | 能写一条 pattern/replacement/output_guidance 规则；AI 因为指令产出短 XML，输出被替换后渲染 |
| **W5** | 正则系统 V1 —— 工具模式 6 步工作流（target_text → pattern 自动生成 → 映射点击 → 测试面板）+ 新建正则弹窗 UI（左右分栏 + 启用/可见性开关 + 载入模板按钮）+ 环境状态面板内置模板 | 创作者贴 XML 样例后系统自动出 pattern，点击 chip 回填 $1/$2/$3，测试面板实时渲染 |
| **W6** | sanitize 路径打磨：流式增量正则匹配 + DOMPurify 配置 + 环境状态面板 / 动态记忆区案例跑通 + **调试模式 v0**（messages.debug_info 字段 + 聊天页 toggle + AI 气泡下调试面板） | 流式 XML 闭合后局部渲染、安全审计通过，两个 sanitize 路径案例可用；卡 owner 能在聊天页打开调试面板看到 AI 原始输出 + 规则匹配 |
| **W7** | **iframe 路径**：`<RegexIframe>` 组件 + sandbox + CSP + Host API postMessage 协议 + Dearm 手机适配版案例跑通 | Dearm 手机能在 iframe 里跑通：渲染历史消息、用户在 iframe 输入框打字、`host.sendMessage()` 把消息发回主聊天框、CSP 阻止 fetch 外部域 |
| **W8** | **全局美化系统**：所有 UI 挂 `nj_*` selector + 特殊渲染标签（`<message>` / `<system>` / `<narration>`）+ global_css 注入流程 + postcss CSS 白名单 walker + scope 隔离 + selector-contract.md 文档 | 创作者写一段 CSS（如紫色渐变 AI 气泡）保存后聊天页立即生效；写 `body { display: none }` 被 walker 删；切换角色卡旧样式卸载干净 |
| **W9** | **AI 辅助生成系统**（4 个生成器：replacement-html / global-css / output-guidance / target-text）+ 配套 UI（各 textarea 上方「✨ AI 生成」按钮 + 弹窗 + 流式回填）+ rate limit + sanitize 链路集成 | 创作者描述"暗色赛博朋克状态面板"→ AI 流式生成 HTML 含 $1/$2 → 应用到 textarea → 测试面板渲染通过；CSS 美化同理；超过 20 次/小时被限流 |
| **W10** | **导入导出系统**（角色卡 / 正则规则 JSON 包，含 zod schema 校验 + 版本号）+ 探索页打磨（标签筛选 + 搜索 + 推荐排序 + NSFW toggle）+ 部署上线 + 双份文档完成 | 角色卡能导出 JSON 再导入恢复，正则规则可批量选择导出导入；探索页可用；生产环境可访问；handover / insights 双份文档齐全 |

**节奏哲学（vibe coding）：** 每周末 commit + push，跑通就发，先丑后美。前 4 周不要碰 UI 细节。

---

## 七、开发纪律

**必须坚持：**
- pre-commit hook (lefthook)：`bun run typecheck && bun run lint && bun test`
- Conventional commits（feat / fix / refactor / chore / docs）+ body 详细说明 **why** 而非 what
- **改动自查清单**：每次 commit 前确认
  1. 改动是否涉及 i18n —— 是否需要同步 `src/i18n/zh.ts` 和 `en.ts`
  2. 改动是否涉及数据库 —— 是否需要新增 drizzle migration
  3. 改动是否涉及类型 —— 是否需要更新 `src/types/index.ts`
  4. 改动是否构成新功能或大迭代 —— 是否需要写双份文档
- **双份文档（新功能必写）：**
  - 技术交接文档 → `docs/handover/<feature>.md`：架构、数据流、DB schema、API 路由、关键设计决策
  - 产品思考文档 → `docs/insights/<feature>.md`：用户问题、设计理由、外部参考、未来方向
  - 两份文件名一致，开头互相反向链接
- **执行计划目录化：**
  - 活跃计划 → `docs/exec-plans/active/`
  - 完成后移至 `docs/exec-plans/completed/`
  - 纯调研放 `docs/research/`
- **新增功能前先调研：** 不在主代码中试错，先 POC（如流式正则匹配）
- **API route + Server Action：** 输入用 Zod 校验，输出类型从 Drizzle schema 反推
- **SSE / streaming API：** 必须有连接超时 + 客户端断线清理
- **UI 改动手工验证：** v1 不上自动截图，靠人工在 `bun run dev` 下点一遍关键路径

**已知不做：**
- ❌ Worktree 隔离（单人 vibe 项目不需要）
- ❌ 多平台桌面发版（Web 项目，CI 自动部署 Vercel 即可）
- ❌ 严格 Release Notes 格式（用 CHANGELOG.md 简版）

---

## 八、还需要拍板的开放问题

| # | 问题 | 推荐 |
|---|------|------|
| 1 | 部署平台 | Vercel（最快 + SSE 已验证） |
| 2 | 数据库托管 | Neon（serverless Postgres，无空闲费用） |
| 3 | Auth 方案 | Auth.js v5 + email magic link |
| 4 | LLM 默认模型 | `anthropic('claude-sonnet-4-6')` —— 对短 XML 标签输出稳定性好，AI SDK 让切换零成本 |
| 5 | NSFW 处理 | **创作者自报 `nsfw` 字段**（boolean，默认 false），用于用户侧筛选。探索页顶栏放「显示 NSFW」toggle，存 localStorage，默认 ON（平台定位本来就服务 NSFW 受众）。**平台不做任何内容检测、违禁词扫描、AI 审核、强制下架** —— `nsfw` 只是元数据，不是合规闸门 |
| 6 | 是否做 i18n | v1 中文优先，但代码留 i18n 文件，后期补英文 |
| 7 | 角色立绘存储 | Cloudflare R2（出口流量免费） |
| 8 | 内容审核 / 违禁词检测 | 完全不做。平台对内容本身放任，所有"管控"只发生在创作者侧（自报 nsfw）和用户侧（筛选偏好） |
| 9 | Lint 工具 | Biome（单工具 + 速度快），如团队习惯 ESLint + Prettier 也行 |
| 10 | iframe CDN 白名单 | v1 推荐：`cdn.tailwindcss.com` / `cdn.jsdelivr.net` / `unpkg.com` / `fonts.googleapis.com` / `fonts.gstatic.com` / `cdnjs.cloudflare.com`。CSP `connect-src` 永远是 `'none'`，不松动 |
| 11 | iframe 组件状态持久化 | v1 做：`host.setComponentState(state)` 存到 sessions 表的新 jsonb 字段 `component_states: { [regexRuleId]: state }`，下次加载会话注入回 iframe。这样 Dearm 手机的"小气泡列表"能跨会话还原 |
| 12 | Selector 前缀 | **`nj_*`**（早期品牌缩写，已作为稳定 API 保留）。一旦发布即 API，破坏性改动须 deprecation 流程保留 alias 至少一个 major 版本 |
| 13 | CSS 白名单边界 | 见模块 5.4。允许颜色/字体/边框/阴影/动画/变换/内外距；禁止 `position: fixed/sticky` / `pointer-events` / `z-index > 100` / `body`/`:root`/`*` selector。v1 上线前 walker 需有 80%+ 单测覆盖 |
| 14 | 全局美化是否上 Live Preview | v1 不做。角色卡编辑页保存后跳转测试聊天即可，CSS 修改路径仅"改 textarea → 保存 → 重载聊天"。Live preview 留 v2 |
| 15 | AI 辅助生成的成本 | v1 写死 20 次/小时/用户 + 每次 ≤3000 输出 token + 统一 Claude Sonnet 4.6。预估单用户日均创作产生 ~10 次调用，月费约 $0.5-2/活跃 creator。如用量起来快上 Haiku 4.5 兜底 |
| 16 | AI 生成的提示词工程归属 | prompt 模板写死在 `src/lib/ai/generators/prompts/{type}.txt` 后端，creator 不可见不可改。理由：(a) 防 prompt injection (b) 后端可随版本迭代优化质量而不影响 creator 的工作流 |
| 17 | 调试信息存储 | messages.debug_info jsonb 全存（含 system_prompt）。一条 AI 消息可能多 1-5KB。v1 不分表不归档。如果 DB 撑不住再拆 debug_summary（常存）+ debug_full（按需查询）|

---

## 九、风险与开放问题

1. **流式增量正则匹配是技术难点** —— XML 闭合标签出现前怎么处理半截输出？方案需要 POC 验证（W3）。备选：流式过程不应用正则，全部内容到位后一次性应用（体感差但稳）。
2. **AI 模型对短 XML 标签输出不稳定** —— 竞品文档点名 Gemini 2.5 会输出 `<-状态栏>` 之类的破坏。我们 v1 默认 Claude Sonnet 4.6（标签遵循稳定性较好），AI SDK 让我们能 1 行配置切到 Gemini / GPT 做横向对比。
3. **DOMPurify 配置是安全红线** —— 任何 XSS 漏洞都会让用户失去信任，必须有专门一周做安全 review（W6 sanitize 路径）。
4. **iframe sandbox 配置是另一条红线** —— `connect-src 'none'` 是 v1 唯一防止 creator 把用户对话外泄的机制；任何写错 CSP / 错配 sandbox 属性都让 iframe 变成 exfiltration 通道。W7 必须把 iframe 安全审计作为验收项之一
5. **iframe srcdoc 体积** —— 单条带 script 的规则的 replacement 可能很大（Dearm 手机 8KB+ HTML），多个 iframe 同时渲染时 DOM 节点压力大。**v1 缓存策略：** 同一 `regexRuleId` 复用 iframe 节点（key 设到 regexRuleId），不重渲染整个 srcdoc；不同 rule 各自 iframe
6. **iframe 与流式输出的协调** —— 流式 XML 闭合前不应触发 iframe 创建（半截 srcdoc 会让 iframe 反复 reload）；定义"完整闭合后再首次创建 iframe"，之后的同 ruleId 增量更新通过 host API push 而非 reload iframe
7. **Selector 契约一旦发布就是 API** —— 任何 `nj_*` ID/class 改名都会让所有 creator 的 global_css 集体翻车（竞品自己点名了这个迁移痛点）。**v1 上线前 selector-contract.md 必须签字定稿**，发布后破坏性改动须走 deprecation 流程保留 alias 至少一个 major 版本。W8 必须做的事：在所有 React 组件确认 selector 挂对、selector-contract.md 与代码同步审核。
8. **CSS 白名单 walker 漏洞 = UI 劫持漏洞** —— v1 用 postcss 写 walker，漏掉一条危险属性（如忘了禁 `pointer-events`、`position: fixed`）就可能让 creator 屏蔽掉用户的关键控件。**v1 上线前 walker 单测覆盖 ≥ 80%**，列出所有禁用属性 + 禁用 selector 形态，每条都有正反例。
9. **Drizzle 迁移没有回滚** —— 约定"禁止破坏性迁移"（不删字段、不重命名）。
10. **Vercel SSE 超时 30s（Hobby 计划）/ 300s（Pro）** —— 长对话流式输出可能超时，需要测试边界；万一不行换 Fly.io。
11. **Bun + Next.js 偶发兼容性** —— Next.js 16 对 Bun 支持已稳定但仍有边缘 case，遇到问题随时切 Node 兜底（仅本地开发，部署用 Vercel 默认 runtime）。

---

## 十、第一周开工清单（W1）

1. `bun create next-app@latest dearm` —— 选 App Router + TypeScript + Tailwind + Biome
2. 加依赖：
   ```bash
   bun add drizzle-orm @neondatabase/serverless
   bun add next-auth@beta @auth/drizzle-adapter
   bun add ai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/openai
   bun add isomorphic-dompurify react-markdown rehype-raw streamdown fast-xml-parser postcss
   bun add zod
   bun add @radix-ui/react-* lucide-react
   bun add -d drizzle-kit lefthook @biomejs/biome
   ```
3. 写 `src/lib/db/schema.ts`（按本文档第三节实体）
4. 写 `drizzle.config.ts` + 首次迁移：`bun drizzle-kit generate && bun drizzle-kit migrate`
5. 写 `src/lib/auth.ts`（Auth.js + email provider + Drizzle adapter）
6. 写 `src/app/layout.tsx` + `(auth)/signin/page.tsx`
7. CLAUDE.md / ARCHITECTURE.md 初版
8. lefthook 配置：pre-commit 跑 typecheck + lint + bun test
9. `bun run dev` 验证一切跑通

跑通这一周 = 一个能注册登录的空壳应用 + 完整数据库 schema + 项目文档骨架。

---

## 附：参考资料

**项目内部文档：**

**外部资料：**
- 调研原文：`https://my.feishu.cn/docx/H9lNdwiKCodSsExNMPacTIlhnjf`（飞书 docx token `H9lNdwiKCodSsExNMPacTIlhnjf`）
- Vercel AI SDK：`https://sdk.vercel.ai/docs`
- Drizzle ORM：`https://orm.drizzle.team/`
- Auth.js：`https://authjs.dev/`
- Bun + Next.js：`https://bun.com/guides/ecosystem/nextjs`
