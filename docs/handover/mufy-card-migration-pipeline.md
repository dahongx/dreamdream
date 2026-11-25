# Mufy 角色卡批量迁移流水线

> 实验结果与后续迭代摘要统一维护在[迁移实验主报告](../research/mufy-migration-experiment-report.md)，阶段证据与失败案例见其附录。本文件继续作为技术交接，不代替最新实验结果。

> 产品与设计取舍见 [Mufy 角色迁移为什么必须“原样搬运 + 显式缺口”](../insights/mufy-card-migration-pipeline.md)。

## 目标

批次新增迁移从[画像选卡阶段](mufy-profile-collector.md)开始：只读刷新测试服库存 → 全候选按收藏（可选点赞/totalChats）排序、roleId去重 → 排除已有/版本名称冲突并补足100 → 身份与Prompt版本核对 → handoff → 原有迁移和视觉验收。profile交接及Agent均复查测试库存；候选榜不是可直接写库的名单。

把此前分散在六卡专项脚本里的方法收口到一条可重复执行的命令。完整迁移一张卡必须提供三类来源：

1. 角色名、Mufy `roleId` 或角色聊天链接；
2. 含该角色完整 Prompt 的 JSON；
3. 在已登录 Mufy 聊天页运行 `scripts/export-mufy-runtime.js` 得到的运行态 JSON。

详情接口只能提供原始字段，不能证明动态侧栏、手机、播放器和媒体已经在寄情可用。运行态 JSON 缺失、头像/背景未内嵌或角色不匹配时，Agent 必须阻断写库。

入口：

- CLI：`scripts/migrate-mufy-card.ts`
- 命令：`bun run mufy:migrate`
- 批量 Agent：`scripts/migrate-mufy-batch.ts`
- 批量命令：`bun run mufy:migrate:batch`
- 登录态一站式 Agent：`scripts/run-mufy-migration-agent.ts`
- 推荐命令：`bun run mufy:agent`
- 登录态角色发现器：`scripts/discover-mufy-role.js`
- 浏览器运行态导出器：`scripts/export-mufy-runtime.js`
- 寄情验收态导出器：`scripts/export-dearm-runtime.js`
- 自动视觉验收：`scripts/verify-mufy-visual-parity.ts`
- 验收命令：`bun run mufy:verify`
- 通用解析器：`src/lib/import/mufy-migration.ts`
- 单测：`src/lib/__tests__/mufy-migration.test.ts`

## 输入契约

### 画像库交接（可选）

全量名单、热度采集、候选排序由独立的 [画像采集模块](mufy-profile-collector.md) 负责。
画像模块的 `handoff` 只输出已确认roleId与完整原始Prompt，不写服务器。
迁移入口同时指定 `--profiles-job <画像任务目录> --profile-key <本地档案key>` 时，
会验证确认依据、Prompt SHA256和来源运行态roleId；任何不一致都会在迁移前阻断。
候选热度高或名字相同不能替代身份/版本确认，也不取消现有TEST-only保护。

### 角色定位

`--role` 支持三种输入：

- `晋南慈`
- `7adabcbe-f5cf-4eeb-895e-8ce75051efc6`
- `https://chat.mufy.ai/chat?roleId=...&sessionId=...`

角色名搜索时，优先精确匹配；其次允许把 `赵漳平(新增婚后开场白)` 与 Prompt 中的基础名 `赵漳平` 对齐。若出现多个候选会立即停止，不会猜测。

### Prompt 来源

支持以下形式：

```json
{
  "characters": [
    {
      "character_name": "角色名",
      "found": true,
      "prompt": "<CharaPrompt>...</CharaPrompt>..."
    }
  ]
}
```

也支持记录数组、单条 `{ "prompt": "..." }`、JSON 字符串形式的完整 Prompt、已经组装好的 `*_prompt.txt`，以及带 `required_modules` / `optional_modules` / `module_order` 的提取 JSON 或 JSONL。纯文本必须含有完整的 `<CharaPrompt>...</CharaPrompt>` 标签。

当前识别七个 Mufy Prompt 区段：

| Mufy 区段 | 寄情字段 | 必需性 |
|---|---|---|
| `CharaPrompt` | `persona` | 必需 |
| `AdversityHandling` | `adversity` | 可空，缺失会报告 |
| `DefaultCognition` | `default_cognition` | 可空，缺失会报告 |
| `Greeting` | `opening` 的候选来源 | 可由线上 `greeting` 替代 |
| `PlotSetting` | `plot_setting` | 可空，缺失会报告 |
| `OutputSetting` | `output_setting` | 可空，缺失会报告 |
| `StyleSamples` | `sample_dialogue` | 可空，缺失会报告 |

组装 Prompt 的总控模板可能在说明文字中提到 `<CharaPrompt>` 等标签。解析器沿用已验证规则：取第一个闭标签之前最近的同名开标签，避免误把总控说明当人物正文。

### Mufy 登录信息

推荐流程不需要向 Agent 提供账号密码：用户在内置浏览器登录一次，`export-mufy-runtime.js` 会把无 token 的角色详情和运行态一起导出，`mufy:agent` 直接使用这份快照。

环境变量登录只保留为没有浏览器快照时的 API 备用路径，且不把账号密码写进脚本或 Git：

```powershell
$env:MUFY_EMAIL="你的 Mufy 邮箱"
$env:MUFY_PASSWORD="REDACTED"
```

如果已经有人从登录态导出了详情 JSON，可传 `--detail-json`，此时不需要 Mufy 登录信息：

```powershell
bun run mufy:migrate --role "角色名" `
  --prompt-json "完整Prompt.json" `
  --detail-json "mufy-role-detail.json"
```

### 运行态来源（必需）

打开目标 Mufy 聊天页，等待开场、侧栏/手机/播放器全部渲染后，在 DevTools `Console` 或 `Sources -> Snippets` 执行 `scripts/export-mufy-runtime.js` 全文。脚本下载 `<角色>-mufy-runtime.json`，包含：

- 与角色 ID 绑定的详情快照；
- 运行时注入的侧栏/播放器 DOM 与相关 CSS；
- 视口和页面尺寸；
- 头像、封面及页面内视觉资源清单；
- 能从登录页读取的资源 data URL（不导出登录 token）。

导出器会并发抓取资源并对单个请求设置超时，也会把快照写入页面中的
`#mufy-runtime-snapshot-export`，方便浏览器自动化在下载受限时直接读取 JSON。
当前导出格式为 `version=3`，除 DOM、CSS、媒体外还会生成一份视觉验收合同，记录：

- 宿主聊天区、气泡、输入框、思考按钮的 computed style 与伪元素；
- 页面内固定/粘性悬浮件的位置、可见比例与文本签名；
- 思考按钮默认收起/展开状态；
- 输入框真实 placeholder 与伪元素文案；
- 可关闭提示文本；
- 损坏图片/音视频和横向溢出。

批量 Agent 只接受 `version=3 + quality.version=1`。旧 `version=2` 仍可供单卡历史重放，但不能作为新卡“一次搬完”的依据。
若原站允许浏览器展示、但跨域或临时镜像导致个别资源未嵌入，可运行
`scripts/repair-mufy-runtime-assets.ts` 做服务端补抓；脚本仍受单资源 10 MiB、
总计 40 MiB 上限约束，不会用无关媒体替代失效素材。

迁移时增加：

```powershell
--runtime-json "余斯是-mufy-runtime.json"
```

## 自动迁移流程

### 推荐模式：用户只负责首次登录

用户只需要在内置浏览器打开并登录 Mufy。Codex Agent 负责在目标角色页执行来源导出器、保存快照并调用统一入口；密码不进入聊天、脚本或 Git。来源运行态 `version=3` 已包含登录态角色详情，因此不再要求 `MUFY_EMAIL/MUFY_PASSWORD` 或单独的 `detailJson`。

角色定位遵守固定优先级：用户给出 `roleId` 或含 `roleId` 的链接时直接打开并复核；只给角色名时，Codex 在当前登录页设置 `window.__MUFY_ROLE_DISCOVERY_QUERY__` 并执行 `scripts/discover-mufy-role.js`。发现器通过登录态搜索接口取得候选和详情，但不导出 token。唯一精确/标准化名称匹配会自动进入角色页；多个候选则结合 Prompt 开场、头像和作者复核，仍不唯一时状态为 `role-confirmation-required` 并交给用户选择，严禁猜测。

统一入口会为每个 `roleId + 来源快照 + Prompt` 建立稳定任务目录，默认位于 `logs/card-imports/mufy-agent/<角色>-<roleId前8位>/`。其中 `agent-state.json` 记录当前阶段、测试服角色 ID、包 ID、目标页面和下一步。新聊天可以读取这个状态续跑，不会因为重复执行而再次创建同名卡。

```powershell
bun run mufy:agent -- `
  --mufy-runtime "角色-mufy-runtime.json" `
  --prompt-json "角色_prompt.txt"

# 预检通过后只允许写测试服
bun run mufy:agent -- `
  --mufy-runtime "角色-mufy-runtime.json" `
  --prompt-json "角色_prompt.txt" `
  --owner-email "test@example.com" `
  --expected-db-host "测试数据库主机" `
  --test-base-url "http://测试服地址" `
  --commit

# Codex 在测试服分别导出手机和桌面运行态后完成验收
bun run mufy:agent -- `
  --mufy-runtime "角色-mufy-runtime.json" `
  --prompt-json "角色_prompt.txt" `
  --dearm-mobile-runtime "角色-dearm-mobile.json" `
  --dearm-desktop-runtime "角色-dearm-desktop.json"
```

状态只在手机、桌面两份验收都通过时变为 `complete`。修复通用适配器后使用 `--remigrate` 会读取状态中的角色 ID 和美化包 ID 原位覆盖，不会重复建卡。统一入口拒绝 `dearm.ai` / `www.dearm.ai` 正式地址；底层写库仍同时要求 `--scope TEST` 与数据库主机完全匹配。

1. 解析角色名、`roleId` 或链接。
2. 优先从已登录浏览器运行态快照读取角色详情；两者都没有时，才使用环境变量登录 Mufy。
3. 备用 API 模式下，角色名输入先调用 `/api/characters/query` 唯一定位角色；随后调用 `/api/characters/get?id=...` 获取线上详情。
4. 从完整 Prompt JSON 唯一定位同一角色，校验角色名。
5. 把七个 Prompt 区段映射到寄情的七个 LLM 字段。
6. 开场白优先使用线上 `detail.greeting`，因为它代表用户当前实际看到的版本；若与 Prompt 中的 `Greeting` 不同，在报告中同时记录差异。
7. `optimizationCode` 单独映射为全局 CSS；只转换宿主选择器 `mufy_` → `nj_`。
8. `codeRenderContent` 原样保留为演绎室/悬浮组件。严禁把其中的组件私有 `<style>` 再抽出应用到寄情宿主，否则会破坏聊天高度、输入框和手机布局。
9. 读取运行态快照，校验角色 ID、动态节点和媒体。头像、封面及原代码引用的已内嵌资源上传到寄情 Storage，再统一替换 URL，禁止保留会返回 403 的 Mufy CDN 热链。
10. 对全局 CSS 做寄情作用域安全预检，记录所有 warning；不在迁移脚本中自创视觉。
11. 生成 dry-run 报告。缺运行态快照或媒体不完整均为阻断错误；只有无阻断错误且显式指定测试环境后，才允许创建/更新。
12. 写库成功后，保存原始 Prompt、详情 JSON、运行态 JSON和 SHA-256 清单，供适配器升级后重放。
13. 在寄情测试服打开迁移后的角色页，分别以手机和桌面视口运行 `scripts/export-dearm-runtime.js`。
14. 用 `bun run mufy:verify` 对比 Mufy 来源合同与寄情运行态；任何错误都表示“尚未搬完”，不能交付。

## 批量 Agent

批量入口读取来源目录的 `manifest.json`、`assembled/*_prompt.txt` 与显式角色映射表。映射表必须提供准确的 Mufy URL 或 `roleId`，不允许在写库阶段仅凭名字猜卡：

```json
{
  "version": 1,
  "roles": [
    {
      "localName": "角色名",
      "selector": "https://chat.mufy.ai/chat?roleId=...",
      "runtimeJson": "runtime/角色名-mufy-runtime.json",
      "targetName": "角色名",
      "minGreetingSimilarity": 0.95,
      "enabled": true
    }
  ]
}
```

运行预检：

```powershell
bun run mufy:migrate:batch --source-dir hot_0926 `
  --only "角色甲,角色乙"
```

Agent 会先对全部选中角色执行在线 dry-run。开场白先移除 HTML、CSS、脚本和标点，再按字符二元组计算正文相似度；低于映射表门槛时将其视为错版卡并阻断。只有全部角色预检通过，`--commit` 模式才会进入逐卡测试库写入阶段。每次运行都会在来源目录的 `migration-agent-reports/<时间>/` 下保存单卡报告和批次总报告。

测试库写入仍需显式提供四项保护：

```powershell
bun run mufy:migrate:batch --source-dir hot_0926 `
  --only "角色甲,角色乙" --visibility public `
  --owner-email "test@test.com" --expected-db-host "db" --commit
```

角色名搜索只用于发现候选，不能替代映射表。遇到同名、改名、非公开或已下架卡时，应回到原始数据补 `roleId/source_url`，而不是降低相似度门槛强行导入。

## 运行方式

### 第一步：只检查，不写数据库

```powershell
$env:MUFY_EMAIL="..."
$env:MUFY_PASSWORD="..."

bun run mufy:migrate --role "晋南慈" `
  --prompt-json "完整Prompt导出.json" `
  --runtime-json "晋南慈-mufy-runtime.json"
```

输出报告默认位于：

`logs/card-imports/mufy-<角色>-<时间>/migration-report.json`

报告包含七段长度、线上开场与 Prompt 开场是否一致、原始视觉长度、选择器转换数量、CSS 警告、iframe 数量、悬浮组件数量、图片是否缺失、未映射数据等。

### 第二步：确认后写入测试服

```powershell
$env:DATABASE_URL="测试数据库连接"

bun run mufy:migrate --role "晋南慈" `
  --prompt-json "完整Prompt导出.json" `
  --runtime-json "晋南慈-mufy-runtime.json" `
  --owner-email "test@test.com" `
  --expected-db-host "测试数据库真实主机名或IP" `
  --scope TEST --commit
```

三道防误写保护：

- 必须有 `--scope TEST`；
- 必须提供 `--expected-db-host`，且必须和 `DATABASE_URL` 的 hostname 完全一致；
- 新角色默认 `private`，不会未经审核直接公开。

运行态可能包含播放器音频、字体和 CSS。测试服 Supabase Storage 的 `media`
bucket 必须允许实际出现的 MIME（除图片外常见为 `audio/mpeg`、
`application/octet-stream`、`text/css`）；仍应保留合理的单文件大小上限。
迁移器接受带 `charset` 等标准参数的 data URL，例如
`data:text/css;charset=utf-8;base64,...`。

审核后可增加 `--visibility public`。若要明确覆盖默认值，可使用：

- `--nsfw true|false`（Mufy 详情没有可靠的 NSFW 布尔值，默认按 `true` 导入，避免成人卡误入普通筛选）；
- `--content-type original|self_designed|fanwork`；
- `--target-name 新名称`。

### 第三步：迁移后自动视觉验收（必需）

在测试服角色页运行 `scripts/export-dearm-runtime.js`，然后执行：

```powershell
bun run mufy:verify -- `
  --source "余斯是-mufy-runtime.json" `
  --target "余斯是-dearm-runtime.json" `
  --report "logs/card-imports/余斯是-visual-acceptance.json"
```

验收器会阻断我们在余斯是、宋聆语上实际遇到过的回归：

- 浮动猫咪跟随正文滚走、被裁切或弹层只显示一部分；
- 输入框定制文案丢失；
- 对话气泡样式没有生效；
- 思考正文默认展开，或收起按钮的图标/横线动效丢失；
- 顶部可关闭提示遗漏；
- 超大图、失效图、音频失败或页面横向溢出。

必须在手机和桌面各导出一次并分别得到 `ok: true`。只写库成功、只看开场页或只通过单元测试都不能称为迁移完成。

### 迭代已有迁移卡

```powershell
bun run mufy:migrate --role "角色名" `
  --prompt-json "新版完整Prompt.json" `
  --runtime-json "角色名-mufy-runtime.json" `
  --update-character-id "寄情角色UUID" `
  --pack-id "对应美化包UUID" `
  --owner-email "test@test.com" `
  --expected-db-host "测试数据库主机" `
  --scope TEST --commit
```

更新必须校验角色 owner 和角色名。角色只有一个自有美化包时可省略 `--pack-id`；有多个时必须明确指定。更新过程中先写事务，成功后再保存新一版原始材料和清单。

## 什么能搬，什么会明确留下缺口

| 数据 | 当前处理 |
|---|---|
| 人设、逆境、默认认知、开场、剧情、输出、文风 | 从完整 Prompt 七段映射 |
| 角色名、年龄、标签、简介、作者的话 | 从 Mufy 详情映射 |
| 头像、背景图 | 从运行态快照读取并上传寄情 Storage；禁止外链 Mufy CDN |
| 全局 CSS | 只来自 `optimizationCode`，只改宿主 selector 前缀 |
| 小剧场、灵动岛、侧边栏、播放器 | `codeRenderContent` 保持组件内样式；运行态 DOM 用于补齐动态注入部分和适配审计 |
| 每轮状态栏生成协议 | 由 Prompt 的 `OutputSetting` 保留，不另造规则 |
| Mufy 道具 `items` | 寄情暂无等价表；原始详情留底并报告数量 |
| 独立正则规则导出 | 普通详情接口不含此字段；必须另采正常页面的规则响应，保序迁入共享画布，见下方2026-10-15补充 |
| Prompt 声明但详情未导出的运行时侧栏/播放器 | 标记为阻断错误，禁止写入半成品；从已登录 Mufy 页面补抓运行时组件后再扩展适配器 |
| 加密且接口不返回的资产 | 不破解、不伪造；报告为缺口，取得明文后迭代适配器 |

## 当前成熟度与验证状态（2026-10-01）

Prompt 七段解析、详情唯一匹配、正文相似度和视觉代码分流已有单测覆盖。余斯是的旧输入已用于质量门禁回归：没有 `--runtime-json` 时 dry-run 返回 `RUNTIME_SNAPSHOT_REQUIRED` 并以失败码退出，批量 Agent 因此不能再把半成品推进到写库阶段。

当前可视为“可重复迁移 + 自动验收”的第三阶段，而不是完全无人值守：

| 能力 | 当前状态 |
|---|---|
| Prompt 七段、角色身份、开场相似度 | 自动解析并阻断错卡 |
| 头像、背景、图片、音频 | 自动抓取、本地化并阻断失效热链 |
| 开场小剧场、运行态侧栏、播放器、悬浮件 | 自动抓取并走通用沙箱/悬浮层适配 |
| 宿主 CSS、气泡、输入框、顶部提示、思考动效 | 已沉淀通用适配和回归测试 |
| 手机/桌面视觉验收 | 来源/目标双快照自动对比，错误即未完成 |
| 新型复杂交互 | 仍需首次扩展通用兼容层，修一次后进入回归集 |

余斯是、宋聆语现已作为完整验收基准卡：两张卡经历的 CDN 403、私有 CSS 泄漏、悬浮定位、弹层裁切、输入框文案、气泡、顶部提示、回复模板、思考动效和默认收起问题，都已变成迁移器规则或自动验收项。后续同类卡不应再等待人工截图才发现。

## 后续迭代规则

### 2026-10-15 人工复核后的验收收紧

此前基础视口检查没有覆盖完整正文美化、原位组件和状态切换，不能据此声明五卡成品合格。新流程增加原站实际开场渲染采集：通过授权浏览器执行 `scripts/export-mufy-rendered-opening.js`，只导出已显示的公开开场，不读凭据或存储。展开懒加载状态后采集，保留渐变文字裁切、背景、布局及图片尺寸；原模板含脚本时仍在原有隔离沙箱执行，剔除原站桥，不开放同源或联网权限。

`renderedOpening` 与 roleId、原始 greeting SHA256 绑定，迁移器生成仅匹配该开场的规则。兼容已有会话种子过滤 system 的情况，不改历史消息；新种子把视觉 system 转为 sys，避免再被当作隐藏设定。这个合同不是未知后续模型回复的美化转换器，不得宣称已覆盖所有未来回复。

正文RegexIframe原来未传入onFillComposer，导致原位表单即使调用Host API成功也没有实际填入。现已从ChatRoom经ChatMessagesList、MessageBubble传递同一稳定回调，TEST实测生成860字符且不发送；旧侧边浮层链路不变。部署前核对三份源文件与远端指纹一致，只同步这三份最小修改，保留远端其他改动并备份旧文件/镜像ID。

原定制指令与物品栏菜单必须分开。保留原位三步表单，递归修正 template 内事件；Clipboard API 和临时 textarea 的旧式 copy 均接入 fillComposer，验收必须读取真实草稿，不按“已复制”提示判成功。宋怀远动态 GIF 超限时生成保留动画的压缩副本，记录画质变化和来源原件。折叠高度按自然正文测量，并在一个栅栏含多份 HTML 文档时逐文档注入。

`--fidelity-report` 是完成门禁：来源、目标、渲染器指纹一致，预览/对话 × 390/1280 × 初始/展开/收起/再展开共16个实测状态；每个保留证据及美化、文案、用户名、组件、资源、输入命中、布局、高度结果。缺证据保持未验收。此门禁会核验报告结构和绑定，不会自动判断截图像素语义；浏览器逐项检查仍由执行 Agent 负责，不能把生成检查计划写成已自动通过。

本轮执行记录：`logs/mufy-profiles/full-20261013/pilot-5/repair-execution.jsonl`；工程跨度、人工约50分钟首次复核与程序耗时分别统计。TEST 临时盘满的一次传输失败保留记录，旧传输件移至远端专用归档目录，没有删除来源或迁移备份；传输链增加失败即停，避免解包失败后仍尝试执行。

### 2026-10-15 独立渲染规则和后续回复

正常原站页面另加载 `/api/characters/regex/list?characterId=...&enabled=true`。授权浏览器只读取该已观察响应，按公开渲染规则字段白名单保存，不导出会话凭据；详情和原站开场不足以替代这份输入。`stage-mufy-source-rules.ts` 校验全部五卡后，将原件归档并合入runtime顶层`sourceRules`，成功空集合也必须有真实响应记录。

`mufy-source-rules.ts`按原站规则顺序、原flags和编号捕获替换，保护已生成区域；编辑器mode不参与公开渲染。`mufy-source-rule-envelope.ts`保存明确版本的JSON元数据，segments识别后完整转换，并将多段HTML组件合入同一个RegexIframe隔离画布，保留跨组件样式和交互，不再逐围栏拆成独立文档。整体皮肤`optimizationCode`同时传入该画布；不执行源码于宿主页，不放宽CSP/sandbox。非法数据及限额错误保留原文和失败原因。原生同步RegExp没有硬超时，输入和匹配限额不能等同可终止Worker防护。

源组件父页面输入框写入仅映射到沙箱内专用草稿relay，调用fillComposer不发送；定制指令只定向适配已确认命名空间，其他父页面API仍不支持。动态文字替换不改URL、样式及脚本。source组件传最小高度1，普通规则保留原默认值，防止收起后遗留240px。

规则转换覆盖与浏览器成品验收分开记录。合成fixture可证明新字段转换，不能证明图片加载、交互或完整视觉等价；本轮五卡保持私有直到完整验收。来源runtime与渲染器组合指纹包含独立规则引擎、envelope、segments及运行适配，不允许复用旧指纹报告。

最新阶段：07:56 UTC的回放启动依赖失败，修复后08:02和08:10两轮五卡回放均成功。原始记录和失败记录保留。五卡仍私有，完整来源视觉比对尚未完成；类型检查需区分限定迁移文件检查与全仓检查。各命令时间见`repair-execution.jsonl`，用户首次人工复核约50分钟继续单列。

### 2026-10-15 通用浏览器检查执行器与修复交接

`scripts/mufy-browser-check-driver.js` 是供授权浏览器工具执行的静态函数，接收既有tab和精确TEST角色URL；不是另启浏览器的终端爬虫。执行Agent将函数作为静态代码运行，不使用字符串eval。390/1280、preview/chat、initial/expanded/collapsed/reopened分步执行，`state`指定单步、`save:true`每步下载无凭据JSON。重名iframe按实例序号定位；summary使用稳定索引并逐次核对open结果。已存在图片最多等待8秒，仍在加载与加载失败分别记录，不重复请求资源。

逐步文件归档到`pilot-5/browser-loop-20261015/observations`，同一`inspectionId`汇总，缺失状态、空页面、失败点击、旧写入前证据不能通过。`review-mufy-pilot-browser.ts --observations <目录> --inspection-id <批次>`只读本地输入，生成`browser-review.json`及每卡修复队列；当前专用于已核对的五卡映射。新迁移后必须新建检查批次，不混用上轮记录。

迁移入口增加`--browser-check-report`，能读取原始runs数组或汇总报告的runs；结构异常进入`repair-queue.json`。`--auto-repair`启用既有通用运行态/宿主兼容配方，不代表能凭空修复任意新结构。执行Agent读取任务后自行定位和修补通用适配、增加回归、原位重迁、重新检查；普通布局与交互问题不交给用户排查。相同缺陷重复时应保留失败样本、改变修复方法，不无限重放同一版本。

用户已授权的媒体缺项可保留为`deferredMedia`继续主体检查；不吞掉空页面或折叠失败。结构检查始终`finalFidelityAccepted:false`，不能绕过来源截图与组件语义比对。已保存本轮80个内嵌结构/原生折叠状态、396次点击，五卡这一层通过，另有13条状态级媒体等待记录。成功观测步骤内计时507351ms；不涵盖开发、早先中断和步骤间隔。

### 2026-10-14 首批五张修复记录

后续本轮已修复播放器占位、物品栏指令桥接、手机 border-box 与折叠高度：`mufy-runtime-adaptation.ts` 按组件结构自动识别，不按角色名分支。父文档寄生组件使用现有沙箱 shim；设定/MP3共享一个浮层，避免独立 iframe 的透明点击盒挡关闭；来源可见且未锁定的 actions 通过 Host API 只填 composer。旧会话用迁移器专属标记规则兼容显示，不改历史消息。替换时同时识别标准与旧 Latin-1 编码组件名，只清理迁移器拥有的组件。

Windows→TEST执行包改为ASCII Unicode转义；批量包在一个远端执行内依次原位更新，有源指纹、TEST/db、owner/pack保护，每轮用独立目录避免报告回传冲突。`replay-mufy-pilot-batch.ts --commit` 为现有试点映射的批量回放，`run-mufy-migration-agent.ts` 产出浏览器检查计划，不能把计划文件当已经通过。

实测：五卡10个视口基础检查通过；云朵唯一实例并可展开，缺音源禁用；截断续写真实填入271字符且无发送；设定、MP3开关通过，TEST本地化音频readyState=4、245.89932秒并已停止；手机组件内溢出0、高度随内容收缩。26项回归通过。尚未声明全部来源功能完整等价；先前本节“占位待查”已被此补修记录替代。计时会话 `20261014T151049Z` 单列，不混入前一轮。

用户授权 `--allow-missing-media`：缺失或明确超过存储限制的图片/音频保留来源审计并延后修复，不阻断主体；认证、网络和权限错误不可据此吞掉。无扩展名资源按已知 MIME 识别。`--use-local-age` 取已授权底稿年龄，祁远宁40、周岳山45；不重写人物正文。`--adapt-host-css` 将正文契约选择器限定到聊天消息域，非可移植装饰逐项延期，安全过滤不放宽。

首批五张均已写入 TEST 私有卡，先核对源 roleId 与目标映射再恢复剩余写入，避免 SSH 中断造成重复卡。五张均有390px/1280px输入命中及无横向溢出检查；这不等于完整视觉/交互通过。宋怀远播放器、薛山烬定制指令占位仍需检查，风满楼首屏遮罩尚需交互验收。本次22项回归通过，迁移关联文件限定类型检查通过。实测命令阶段时间见 `pilot-5/repair-execution.jsonl`，不与分析开发墙钟混算。

遇到新卡迁移失败时，不新增角色专用重写脚本。按以下顺序处理：

1. 保存原始详情、Prompt 和失败报告；
2. 判断是“新字段”“新视觉容器”“新 selector”还是“平台无对应能力”；
3. 在 `mufy-migration.ts` 或寄情现有 opening/CSS 兼容层中增加通用适配；
4. 为该新结构增加最小脱敏 fixture 和回归单测；
5. 重跑旧 fixture，确认没有破坏已迁移卡；
6. 使用 `--update-character-id` 重放目标卡。

这样迭代积累的是通用迁移能力，而不是越来越多不可维护的单卡补丁。

## 2026-10-19 后续回复黑底回归

### 连续测试续跑与源站表格默认底色

本次续跑已正常发送并核对8条实际模型回复（四张各两条），不再等待银币确认；显示合计16银币，未独立核销账单、未补余额。检查点为pilot-5/live-replies-20261019/generation-ledger.json。完整视觉验收仍未通过，下一批五张未开始。

新增单条消息检查，跳过无关开场iframe，覆盖普通DOM回复及其折叠。截图校验补充边界：隐藏IAB可能返回尺寸正确但内容陈旧的PNG；传入browser的captureMufyViewportProof会拒绝隐藏模式并选中目标页，但仍不代替逐图视觉核对。旧截图仅证明文件/几何存在，不能据此补写visual pass。实际显示页面后发现祁远宁手机表格黑字贴在深色立绘上；源站公开DOM证明tr有white/#f0f0f0平台默认底色。

修复由mufy-native-table.ts判断显式黑字且没有自带背景/背景图的表格；MessageRenderer仅在MessageBubble识别有效迁移开场标记时启用源平台行底色CSS模块。普通卡不启用；作者显式表格背景、行内背景、图片及渐变不重写；来源iframe仍走原路径。不会改存储文本、提示词、历史、计费或数据库。发布脚本deploy-mufy-native-table-test.ts核对8091及两份精确基线，剥除本补丁后必须逐字等于远端，防止夹带脏工作区；失败构建不切运行镜像。详情与截图见本地检查点，不把本地测试通过当作线上验收。

下一批记录独立runId和逐阶段时长，计划未启动时不填假startedAt。mufy-execution-timing.ts区分compute/browser/generation-wait，排除未测间隔并去除并发墙钟重复；time-mufy-pilot.ts保留命令计时兼容字段、支持独立日志路径。命令耗时不是CPU耗时，不得与整轮Agent工时混称。

发布结果：native-table-20261019120359000.json，8091完整构建成功并重建app；首次失败报告native-table-20261019120148525.json保留。手机390/桌面1280已在实际图片中看到正文与恢复的白/浅灰行底色，390横向溢出0。其余普通HTML卡重新加载后宋怀远两条各5控件、周岳山两条各3控件保留，后者同型黑字表格也启用源默认底色。局部修复已验证，不代替五卡全量视觉合同。另见IAB可见性getter不可靠时保护会拒绝，诊断图需逐图人工核对，不能填造browserVisible=true。

渲染指纹已补入MessageRenderer.tsx、mufy-native-table.module.css和mufy-native-table.ts，避免以后只改默认表面样式却沿用旧视觉验收。40项本轮相关回归通过，限定迁移类型检查通过；线上完整Next构建包含UI类型检查通过。原先默认5秒文件I/O测试超时和一次诊断测试中止均保留计时失败记录，重跑增加测试超时后通过，不把失败算成成功或重复累计测试数量。

### 后续回复纳入迁移 Agent 完成门槛

2026-10-19 实际浏览器复验补充：`pilot-5/browser-quality-20261019/reconciled-summary.json` 从逐状态本地文件重建五卡80个观测状态（chat/preview × 390/1280 × 四状态），排除1条实际宽度不符记录。它仍是结构观测检查点，`finalAccepted:false`。聊天页原生截图接口返回宿主JPEG缩略图而非仿真视口PNG，40条此类截图不进入PNG验收；另补10张聊天页真实视口PNG，详情预览40状态已绑定实际PNG。不得把“80次结构观测”写成“80份完整视觉验收通过”。

新增 `scripts/mufy-browser-viewport-proof.js`：只对精确TEST目标读取实际视口/角色名，显式PNG、实际视口clip、校验图像宽高；`scripts/mufy-browser-state-driver.js` 将公开DOM、原生折叠、真实PNG采集成单步（无发送、无私有状态/凭据、无网络API）。单步结束立即保存，避免整批超时丢证据。原有浏览器执行器也补入1500ms有界的只读open状态稳定观察；不会通过再次点击来“重试”toggle。

后续回复检查点（2026-10-19更新）：已通过正常UI发送4次，祁远宁2条、宋怀远1条、周岳山1条均看到完整实际回复。用户已明确授权正常消耗测试银币，不足时通过8091管理后台补当前测试号；不直连数据库，不改扣费规则，不再等待16银币确认。逐次记录见pilot-5/live-replies-20261019/generation-ledger.json，已发送内容不可重发。风满楼已有五条后续回复，其中四条走来源消息画布，双端未再观测到黑底。宋怀远一项未加载图片仍保留；薛山烬初始加载中的图片随后成功，不判成永久坏图。预览高度过渡时曾读到旧iframe高度，后续DOM已收敛，不据单次过渡值改通用渲染器。来源桌面截图工具超时不等于Mufy阻断。真实回复生成成功不等于完整视觉验收通过。

用户确认下一批仍五张。预留冻结名单第6-10位，将莱、宋洋、盛则言、崔稚玉、陈妄；保留最终100原文和指纹，不使用旧未验收 `test-selection.json`。本轮没有新迁移、发布或数据库操作。新增截图采集保护的4项回归连同既有23项验收回归共27项通过；迁移限定类型检查通过。

`run-mufy-migration-agent.ts` 新增必需验收输入 `--reply-report`，由 `mufy-reply-review.ts` 校验。仍保留原来的16项开场状态证据；另要求至少两条不同的已存在后续 assistant 消息，各自覆盖390/1280下 initial/expanded/collapsed/reopened 共8状态。旧 `complete` 状态每次续跑重新验收，不能缓存绕过。全部通过才记录 `opening-and-continuous-replies`。

后续报告 version=1、scope=`continuous-replies`，与开场报告分开。顶层绑定 sourceRuntimeSha256/targetCharacterId/rendererSha256；cases[] 每项含 input、sourceObservation、sourceScreenshot（path/sha256）及 observations[]（width/state/proof/screenshot）。input为公开可见回复正文；sourceObservation记录来源组件合同、inputSha256及来源快照指纹，合同含 transparentOuter/systemBoxCount/controlCount，不按角色名猜测。

proof记录真实聊天URL、observedAt、kind=`existing-chat-reply`、role、可见DOM消息标识/序号、inputSha256、视口及 measurements。代码中的字段名为 `metrics`：透明外层、系统框数量与无样式框数量、原始标签、用户占位、溢出/裁剪、正文高度、控件及展开数量、运行错误数量；另需 visualStatus/visualComparison，不能仅写总开关。不同状态不得混入另一条消息，同一消息不得冒充两个案例，开场和仅空白不同的正文拒绝。PNG像素数据、实际视口、证据哈希及目录边界均校验；过期、缺项、黑底、系统框缺失或交互不完整均阻断。

失败写入 `visual-acceptance.json` 和 `reply-repair-queue.json`；执行Agent负责修复和重采。仅渲染器变化不强制重迁卡，不默认发送付费模型请求。离线新值规则测试不等于真实聊天验收；截图与数据指纹证明完整性，不代替来源视觉语义判断，也不能防止恶意采集器造假。

本次验证：101项迁移/规则/开场/验收回归通过，迁移限定类型检查通过，其中含五卡真实公开规则配合合成新值的本地测试。修正了旧测试误把纯内存self-test中的哈希构造当成篡改来源指纹；保留原始来源绑定检查并实际执行零真实文件写入自测。没有新迁移、数据库操作或本轮发布；五卡完整浏览器成品验收仍待完成，不能因这些测试通过改成成品通过。产品动机见[迁移思考](../insights/mufy-card-migration-pipeline.md)。

风满楼的固定开场合同仍可显示透明正文及系统框，但后续规则把整页 optimizationCode 注入共享消息 iframe，原 `body,html` 黑底因此盖住立绘；原站只有时间栏正则，`system` 可见框依赖 `.mufy_message_system` 皮肤契约，不能只保留未知标签。

本次修复仅在 `splitMufySourceFrames` 的消息画布内应用：提取 `<style>` 包装中的CSS；声明该系统框皮肤时将非栅栏内的system/sys标签转成对应class，随后照常完整sanitize；消息iframe的html/body透明，内部卡片底色保留。独立RegexIframe、固定开场、普通聊天及sandbox/CSP不改。原规则程序不进行语义标签替换。

验证：新增真实风满楼公开开场组件案例及透明外层/内部底色/系统框/脚本隔离测试。仅发布8091测试站，不重导卡、不修改历史消息或数据库。发布包与远端10月15日基线逐字对比，除该函数外保持原样，避免带入本地未发布的序列化重构。首次整文件构建因依赖版本不同失败，源文件已自动恢复、运行镜像未切换；失败记录保留。
# 2026-10-19 验收工具安全补充

最新续跑（2026-10-20本地）：`pilot-5/final-acceptance-20261020/visual-review.json` 保存全部80个视口图的实际复核及明确证据缺口，composer-review.json保存五卡双宽10次真实输入框命中/聚焦。80/80图片完整性通过并不代表完整开场/逐消息/定制交互验收。祁远宁来源旧图为加载骨架，补存loaded版本，不按DOM后来加载推定旧截图有效。60项回归及专项类型检查通过。高度探针发现即时采样可跨越iframe异步调高/缩高，后续实际已收敛；最终报告必须另有稳定证据，不能用过渡值伪填通过。最终验收尚未通过，下一批五张未开始；本轮无发送、回退、部署或数据库访问。产品说明见[迁移思考](../insights/mufy-card-migration-pipeline.md)。

用户已明确同意改用 Chrome，测试账号已正常登录，无凭据搬运。最新证据在 `pilot-5/final-acceptance-20261019/chrome-native-final/visual-review.json`。原始 JPEG 保留并绑定哈希，无缩放转换 PNG；硬件 DPR 与截图像素比例分别记录。原始 CDP 截图曾漏掉 iframe，不应视作可靠视觉通过。Chrome 原生截图也必须逐图复核。

本次在薛山烬两条真实回复完成桌面展开/收起/重开：各有5个折叠控件，实图看到手机栏、记忆和正文透出背景。重复设置已有尺寸会导致工具输入/画面失步，驱动现跳过同尺寸覆盖；但这不是完整修复，滚动后鼠标仍曾误触。已改为原生 summary 的 Enter 键交互，并实测第二条回复成功。44项相关回归通过，迁移专项类型检查通过。预览 DOM 1280×600 而 JPEG 1265×593 仍被尺寸门禁拒绝；首批未完成最终验收、下一批五张未开始。没有发送/回退/重生成、部署或数据库操作。

14:06Z续跑：新目录 `final-acceptance-20261019/visible-recovery-600/run.json` 记录42项新观测与精确停点。`scripts/mufy-checkpoint-browser-step.js` 提供一次一个状态、完成后哈希复用，汇总脚本区分单回复与整页。18项回归通过。600px/独立实测DPR/有界绘制等待曾恢复正常像素，但之后可见性再次false，仍不能据此完成首批或开始下一批。保持原站两个标签页，不重复生成8条既有回复。计时仅汇总已独立测得步骤，不补估超时中断部分。

收尾实测与逐图断点在 `logs/mufy-profiles/full-20261013/pilot-5/final-acceptance-20261019/visual-review.json`。本地检查器支持保留原生/独立实测DPR，传入browser时隐藏交互直接中止，并在每次折叠点击前后检查意外弹层，避免点入对话回顾后继续运行。13项相关测试通过。150%宿主缩放的缓解并未消除所有IAB空旧截图/点击不同步，因此仍不得跳过实际像素检查、不得自动判定首批通过。正常视口已恢复，没有执行回退/发送或数据库操作。

## 2026-10-21 首批后续回复报告与开场稳定测量

五卡两条既有后续回复各自的 390/1280 × 四状态报告，现已全部通过 `verifyMufyReplyEvidence`。报告及原图在 `final-acceptance-20261020/reply-reports/`；风满楼两张错位图保留，显式覆盖引用改用实际补图。首条回复的火焰入口是独立辅助控件，不计入五个正文折叠面板，也未宣称它已验收。原始六控件记录仍保留。

新增 `openingOnly` 驱动只操作介绍和开场，不重复操作已验后续回复。`opening-settled/coverage-audit.json` 对账 80 个唯一状态、80 张原始 JPEG/PNG 哈希与尺寸绑定，当前 80 状态均测得稳定高度；81 次已记录步骤（包含一次未通过的首次观测）合计约 781.94 秒浏览器步骤耗时，不能当整个 Agent 净工时。所有新图已显示复核；宋怀远桌面预览初始视口仍不能证明具体 FAQ 可读。手机首次展开开场白3曾在 7 秒观测窗后仍短高，后续独立读值收敛，原失败图保留在 `non-accepting-first-attempt`，不改共享渲染器去修未确认的持续缺陷。

最新剩余项在 `final-acceptance-20261020/remaining-acceptance.json`。宋怀远白底朋友圈评论正文继承 `rgb(226,232,240)`，需继续对照源组件并修适配；宠物可见气泡和风满楼辅助入口报告仍未收口。薛山烬播放器实际音源为空，Play/暂停字样变化不代表播放；来源正常可见视图有 03:34 时长，未获取可验证的原音源，不换歌、不宣称恢复。已有媒体后补授权与交互错误要分开。

本轮相关 82 项测试通过（七文件68项＋浏览器驱动14项，含两项开场范围新测试）；两个离线汇总脚本 strict 类型检查通过。没有付费发送、历史回退、重生成、部署或数据库操作。下一批仍未开始，完整首批验收仍未完成。产品说明见[迁移链路思考](../insights/mufy-card-migration-pipeline.md)。

### 2026-10-21 局部收尾补丁（构建与线上验收分开记）

`iframe-bridge.ts` 新增按公开组件结构识别的兼容兜底：仅对带 `#f7f7f7` 来源背景的 interaction-area/comment-item 补零 specificity 的 CanvasText 继承色，作者显式文字色仍优先，html 仍保持 dark/透明画布；仅对 cy-audio-deck/core/play 三标识齐全且空音源或实际媒体错误的播放器显示 Audio unavailable 并拦截无效 Play，不更换歌曲、不修改正常播放器。导入数据和历史消息不重写。

新增 5 项组件测试，与原 iframe 渲染测试合计 37 项通过；新增文件 strict 类型检查通过。`deploy-mufy-component-fallbacks-test.ts` 精确要求 8091 和远端基线 SHA，剥除补丁后本地必须逐字还原基线，禁止夹带工作区其他改动。发布记录单独保存，不把构建成功当视觉验收，也不把旧截图重新绑定为新版。

宠物交互已实图看到狗/猫紫色文字气泡，来源脚本本有三秒自动消失。即时 computed opacity=0 是动画初值，不能当作持续产品缺陷；较慢采集也可能错过整个显示期。保存可见图 `component-closeout/shy-dog-visible-2.jpg` 和 `shy-cat-visible.jpg`，不改宠物代码。薛山烬设置侧栏已正常打开、切人物介绍并关闭，实图在同目录。最终状态以该目录后续 closeout-summary.json 为准；未通过/未绑定项仍保留，不因用户催促而写假通过。

发布已成功，8091 构建及重建应用实测 538123.6014ms（8分58秒），无数据库命令。发布后双端实图确认宋怀远评论黑字、蓝色昵称保留；薛山烬空音源点击后仍为 Audio unavailable、paused=true、readyState=0、无 is-playing 类。未宣称音频恢复。风满楼原黑底未回归，辅助火焰正常展开/收回，但内容只见占位，不能伪称正文已验。

本次十个相关文件合计 119 项回归通过、0 失败；新增修复/测试/发布/汇总脚本 strict 类型检查通过。回复报告编译器新增全批预检：若既有报告的渲染版本与当前不同，在写入任何文件前拒绝执行。已实测拒绝，历史五卡报告未被改写。完整开场报告与版本收口仍未完成，下一批仍不假记为开始。

## 2026-10-21 旧版收口（已撤销，不是当前状态）

当前渲染指纹 `dab408870dac021939d6da5d687b8ed59c686f7a3ea381baac6b7e6e8f08be9a`。`final-acceptance-20261020/release-closeout.json` 已重新执行严格开场、回复文件校验：五张各16个开场状态及两条独立回复各8状态，合计160个当前版本状态通过，原始JPEG、无缩放PNG、实际视口和逐图复核均绑定。开场在 `opening-reports-release/`，回复在 `reply-reports-release/`；旧报告及错误截图保留，不改指纹冒充新图。`remaining-acceptance.json` 指向最新结果，旧内容备份为 `remaining-acceptance-before-release.json`。

风满楼终端不是空正文：精确公开DOM证明包含吐槽、任务及背包。真正的新版缺陷是后续来源消息画布没继承开场组件的独立终端CSS。新增 `mufy-shared-component-style.ts` 仅提取含 mf-fire-widget/mf-fire-panel 的独立公开样式块，拒绝全局主题、标记和超限块；按当前聊天React上下文提供给匹配的来源iframe，已有显式回复样式优先，普通卡及宿主CSS不改。四文件8091发布耗时237715.5395ms，报告 `shared-style-20261020213557511.json`；无数据库命令、无正式站写入。双端实图已见有样式终端和实际吐槽/任务正文，关闭及重开成功。

验收范围不能扩大：风满楼选择两条现有来源画布回复（DOM序号2、3），未改写最早的旧原生回复（序号1）。旧原生回复有完整终端文字但不继承来源iframe样式，单列历史显示差异，**没有宣称全部历史回复修复**。媒体按已授权缺项逐URL登记，未把缺失音频称为恢复播放。宠物可见气泡、设置开关及缺音源提示有独立实图；长终端并非每一段都在同一视口可见。

Agent补齐：指纹覆盖13份实际渲染文件，包含聊天样式上下文和独立样式提取器；开场与回复必须绑定同一版本；回复编译器支持独立采集/报告/人工复核文件；保留原图、先稳定后精确聚焦；截图后端先采原生画面再保留下一帧，仍必须逐图看内容，不能自动授予视觉通过。`finish-mufy-pilot-release.ts` 是离线只读证据收口，不运行旧迁移器、私有来源导出或数据库脚本。

最新一次相关回归118项通过、0失败（10文件，报告运行21秒），不是全仓类型检查通过；全仓仍有无关既有类型错误。当前开场步骤区间去重约683.45秒、回复约308.41秒，包含已测失败/替换尝试但排除步骤间停留，不是整个Agent净工时。下一批仍严格五张，另起时间账本；不得使用旧数据库迁移通路。产品边界见[迁移链路思考](../insights/mufy-card-migration-pipeline.md)。

## 2026-10-28：正常页面规则响应补齐（未最终验收）

用户明确扩大到正常页面已加载的渲染规则响应后，批次30已保存28份真实响应，16非空/12空；16条完整有序链已通过测试服正常包导入、排序及重载核对。原始包和聊天不覆盖。证据在next-batch-30-20261028/source-rule-capture-summary.json及source-rule-live-repairs.json。

准备入口现在要求真实响应，不从“无可见规则”推断空列表；source-rule-transfer.ts将完整链封装进正常XML/规则JSON，保持作者内部顺序和flags。离线重放用可终止子进程限制不可信正则，不能把匹配成功当视觉通过。公开头像兼容显式opt-in，并保留在混合来源画布中。

发现并分别回归：独立有样式邮件不应继承外围全局白字；原生表单提交的CRLF规则头不能失去来源链识别。前者已上线8091并通过桌面/390px文字颜色及内部滚动检查；后者当前构建中，详见批次RUNBOOK。普通卡、共享meta样式及既有高度修复保持。

发布必须从远端精确基线生成局部hunk，不能整文件夹带工作区未发布依赖拆分。第一次候选在构建阶段被拦下而未切运行镜像；失败记录保留。构建墙钟、浏览器操作耗时、模型等待均不冒充Agent净工时。产品原因见[迁移链路思考](../insights/mufy-card-migration-pipeline.md)。

## 2026-10-31：独立开场字体与逐块证据（未发布）

文攸临、祁述的正常公开 iframe 实测 body 默认声明为 `"Noto Sans SC"`，TEST 被通用 iframe reset 改成 `system-ui,sans-serif`。`OpeningSlot` 现在只对明确 opt-in 的 Mufy 独立完整文档，在作者 CSS 前补回默认字体；普通卡、父页面注入片段、来源回复画布不改，作者显式字体优先，也不额外下载字体。画布标记须同时检查原组件，不能只检查拆分后可能丢失标记的 srcdoc。两次失败的定向测试输出保留于工具记录，修复标记丢失后完整定向回归 273/0、1353 断言与类型检查通过，不等于 TEST 上线或整卡通过。

公开证据在批次 `final-acceptance/27,28,29,44,45/`。CSS 隐藏/显现有过渡时，先确认选中页 visibility/opacity，再对该页正文；不可用切换中间帧的整个容器 innerText 判定丢内容。顾晏琛原图在 TEST 实际返回 64px“已过期”图片，不能把 naturalWidth>0 当原图恢复；原曲无解码进度也不能凭 PLAYING 标签通过。映射对账脚本保留逐块未确认项；当前未启动 TEST 构建或发布。产品边界见[迁移链路思考](../insights/mufy-card-migration-pipeline.md)。
