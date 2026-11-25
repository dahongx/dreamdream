# 回复灵感（2026-10-27）

产品范围见 [产品说明](../insights/reply-suggestions.md)。这是基于 RB 实测交互的独立实现，不是取得或复刻其后台提示词。

## 2026-10-28 角色详情构建故障

**最新结果：已部署成功。** 运行镜像 `feeb804dddfe2fe554f6cc9a259aa0ab09bb23e61e08f79e355d400d83d1ace8`，最终归档 `tips-20261027163308183`。浏览器直接打开用户提供的亓厄角色页成功；从探索页点击谢寻及刷新详情页均成功，点赞/收藏/分享按钮可见。运行容器内 manifest 检查通过，日志未再出现原错误；ChatRoom 与 whitelist 哈希保持上一版不变。GitHub/正式服未动，待用户验收。

构建过程：第一轮检查脚本误把 explore 合法的空本地 chunks（复用父级资源）判为失败，修正后 6 项回归测试通过。第二轮依赖安装在日文字体包耗时过长，停止仅属于本任务的构建容器，确认源码已恢复；第三轮使用固定旧运行镜像的已安装依赖，核对 dependencies/devDependencies 一致及 Next 精确版本，并在独立依赖层应用同一两行修复。仅临时 compose/Dockerfile 构建覆盖放在归档目录，仓库 Dockerfile 未改；正常构建仍由 package.json/bun.lock 和持久 patch 安装。新增检查在最终构建与运行镜像均通过。截图 `outputs/character-manifest-fix-20261028/role-fixed.png`。

用户提供 `/characters/6648459e-137f-4470-bc4f-32ab04aaef5e`，浏览器及服务端同现 digest `3172210059`。`CharacterEngagementButtons` 已在客户端 chunk 2124 中生成，模块编号为 0，但所有 client-reference-manifest 缺失该组件。Next 16.2.6 的 flight-manifest-plugin 对 ConcatenatedModule 使用 `if (concatenatedModId)`，会漏登记合法编号 0。修复采用 Bun 持久依赖补丁，CJS/ESM 两处均改为非 null/undefined 判断，不改角色业务或样式。重新安装验证补丁生效，5 项回归测试通过；新增构建后检查直达详情页及 explore 弹窗 manifest，缺失映射则阻止部署。

候选仅包含 package.json 的 build/补丁配置、bun.lock 补丁项、Next 补丁文件和构建检查脚本，基于最新测试服文件生成，未覆盖本地其他未提交修改。发布归档 `tips-20261027161154269`；目前构建中，未宣称上线成功。用户批准删除 d317133a 最旧测试回滚镜像及其三个标签，保留当前与三个较新回滚镜像；已清理其无引用构建层，容量门槛通过。正式服、数据库、GitHub 未改动。

## 当前交付状态（2026-10-27 晚）

居中修复已部署并核验：运行镜像 `1c66d22c020167903ba558cbabd0297fbf1ff7a10fe54d0590a59d3ecad114d7`，备份 `tips-20261027154208381`，ChatRoom 新哈希 `76166c031fef72987c647cff0960bde4ff5da499bc3c3290ffb9482b62689344`。美化 whitelist 仍为 `66ebb68426f96aaa777e5d593ba9eab1d83f3f5385452585bff05b49151ef58a`，项目/运行容器一致。390px 手机及 1707px 桌面输入框中心差约 0px，textarea 从 52px 恢复自然 40px；多行输入高度/scrollHeight/clientHeight 均 112px，无裁切。手机普通剧情及角色美化都检查，测试草稿已清除未发送；截图 `alignment/mobile-verified.png`，临时 viewport 已恢复。原 release/manifest.json 为历史初版，今后 Tips 守卫须用 alignment/manifest.json 中 ChatRoom 新哈希覆盖其对应项，其余九文件不变。等待用户验收后再提交 GitHub，正式服未动。

输入框居中修复（用户验收前禁止 GitHub 提交、正式服不动）：去掉 textarea 的 `min-h-13`，增加 `self-center`，沿用原有上下 padding 和自动增高，不改变四按钮/卡片结构。旧版手机实测 textarea=52px、line-height=24px、上下 padding=8px，额外 12px 留在文字下方，导致偏上 6px。单文件候选基于最新远程 ChatRoom 生成，位于 `outputs/reply-suggestions-20261027/alignment/`。限定类型检查、15 项 Tips 测试及界面机械扫描通过。已获用户许可删除最早 56212daa 回滚镜像，较新版本保留。首轮依赖下载停滞，停止专属构建容器后脚本确认 `BUILD_FAILED_SOURCE_RESTORED`，运行服务未切换；第二轮 `tips-20261027154208381` 正常完成依赖安装，后续部署/浏览器结果待核实。

最新完成通知（来自美化任务，未由本任务独立远程复核）：按钮适配已完成，实际镜像报告为 `c371a6a19246680159af0602589c1853c52477c8ff2ed1c6415656e3f490601d`，whitelist 为 `66ebb68426f96aaa777e5d593ba9eab1d83f3f5385452585bff05b49151ef58a`；对方已核对容器/项目/latest 和 Tips 十文件哈希，六张重点卡双尺寸复验通过，无构建任务，发布锁已释放。此通知取代下方排队状态。后续如获准发布仍须读取最新现场，以该后续版本为已知基线，不能恢复旧 Tips 镜像；本任务未因此启动远程操作。

最新排队通知（来自美化任务，未由本任务远程复核）：8091 当前报告运行镜像为 `478e86399ec0`（allowed-donor 修复），Tips 十文件哈希仍保留。default-family 单文件候选 `66ebb684` 正在共享锁内构建，备份 `chat-skin-20261027150557095`，最终镜像待对方通知。本任务继续暂停所有远程发布、重打标、清理及回滚，不覆盖该版本；本次仅更新本地协调记录。

后续协调消息记录（本任务未再次远程核验）：美化任务报告串行发布已完成，实际运行和 latest 均为 `4bac71d19dd72abb911a2040d981773c762832deee96cf30fc1383197baf1ac5`；远程/运行 whitelist 均为 `fb59f4cf1b709c120d3f217ce189bdad9c458c8907b5ef65b481dc463263e3d8`，Tips 十文件哈希全部保留。备份 `chat-skin-20261027134855473`，d317 留作回滚。下方 d317 为本任务历史发布版本而非最新版本；不得用旧 Tips 备份覆盖后续样式。本地另有未发布样式修改，后续继续只按最新远程哈希和共享锁准备精确补丁，不上传整个 dirty 工作区。本消息未触发任何远程操作。

本地发布脚本加固完成（未执行远程）：`deploy-tips-test.ts` 使用共享 `flock -n /root/projects/yearn-chat/.test-release.lock` 覆盖最终哈希/容量校验、实际运行镜像备份、copy/build/up 和回滚。构建前后核对实际容器镜像，发现其他版本则停止交由复核；源文件偏离候选哈希也不覆盖回滚。备份目录记录原镜像、候选镜像和阶段状态，SSH 断线没有自动重连回滚。仅通过 Bun 打包语法检查，尚未远程演练。上传独立时间戳候选目录发生在锁外，不修改工作源码；锁竞争失败不进入发布临界区。

发布协调检查点（13:28:57 UTC）：本任务暂停后续远程构建、up、重打标、回滚和镜像清理。只读检查未发现 compose build/up 进程；实际运行与 latest 均为 `d317133ac51abc7d466bcb2d9368362226903cc819bda2f43b6c8fb69ffd9d13`。latest 对齐发生在收到协调消息之前，消息后没有远程写操作。10 文件预期哈希完整保留于 `outputs/reply-suggestions-20261027/release/manifest.json` 的 `entries[].after`，实际结果与检查点见同目录 `deployment.json`。后续应共用发布锁并备份实际运行镜像，不能仅以 latest 判断回滚目标；本任务尚未实施该发布锁。

最新核实：SSH 恢复，上次远程构建继续完成，测试服运行镜像为 `d317133ac51a`，端口 8091。已浏览器实测普通图书馆对话：生成三条真实建议、铅笔填入输入框、清除测试草稿后重新展开命中建议，四个工具按钮保留。截图 `outputs/reply-suggestions-20261027/test-live.png`，部署记录 `release/deployment.json`。未发送新聊天、未推 GitHub、未动正式服。另一个并发 chat-skin 发布结束后将自己的 whitelist 源文件恢复旧版，但本次运行镜像包含其新版；此非 Tips 文件未改动，下次构建前需协调源文件与运行版本差异。当前运行镜像已另打 `tips-verified-20261027` 标签并对齐 latest。用户视觉验收待完成；下次构建仍须容量检查。

22:00 后续：用户授权清理废弃测试镜像并部署。根据测试部署归档 build.log 对照镜像 ID，保护全部有标签镜像、所有容器引用及其父层，仅用非强制 docker image rm 删除确认未引用的测试构建镜像；未删容器、卷、数据库或备份。空闲由约 13GiB 增至约 26GiB，使用率 73%，容量检查通过。重新基于测试服最新源码生成 10 文件候选并启动部署，备份目录 `/root/mufy-transfer-archive-20261015/tips-20261027130005169`。随后 SSH 在握手前被服务器关闭，多次只读重连均失败；网站 8091 仍返回正常登录跳转。**无法确认构建/切换/回滚最终状态，不得标记部署完成或盲目重跑**。恢复连接后先检查该目录 build.log、源文件哈希、运行容器及镜像，再决定续部署或恢复。未推 GitHub、未操作正式服。

初版代码和 10 文件独立测试服候选包已完成。`prepare-tips-test.ts` 基于测试服当前文件只应用 Tips 的补丁，不覆盖其他人更改；`deploy-tips-test.ts` 含文件 hash 校验、测试端口检查、容量检查和回滚。四个工具按钮的原有布局未修改。准备文件位于 `outputs/reply-suggestions-20261027/release/`。

真实渠道：通过测试服当前配置对 Gemini 3 Flash 与 Gemini 3.8 Flash 各做一次自编普通剧情调用，均 HTTP 200 / stop / 三条有效建议。结果在 `test-channel-check.json`，不是完整应用接口端到端验收；默认仍为 Gemini 3 Flash。看到少量无依据道具和意图同质问题后，进一步补充了禁止凭空道具与覆盖给定分支的提示词，最后这条强化尚未重新实测。

验证：本轮 6 项 helper + 9 项独立路由测试、限定类型检查均通过。部署在任何上传/修改前被安全容量检查阻止：测试盘 90% 使用，约 9.5GiB 空余，要求至少 20GiB 且使用率不超过 80%。只读 Docker 汇总显示镜像可回收约 21.46GB，但尚未确定具体可清理对象，不能直接 prune。未修改测试服、未动正式服、未推 GitHub。下一步需确认清理范围或扩容，再部署及登录态浏览器验收。

## 实现

- `ReplySuggestions`：输入框内灯泡、三条等高自适应玻璃卡片。正文发送、铅笔编辑；已有草稿编辑前确认，直接发送建议保留草稿。桌面/手机均横滑，列宽分别 44%/86%，最长内容撑高，面板上限 40dvh。
- 视觉优化：沿用夜青银 token，正文升为 base 字号、增大内边距，发送提示与编辑操作分区，展开按钮有选中态，面板增加关闭按钮。未修改生成或计费逻辑。优化后桌面/390px 手机截图为 `polished-desktop.png`、`polished-mobile.png`；类型检查、样式检查通过，关闭及焦点回归已验证。
- `ChatRoom`：复用现有 `sendMessage` 和同步发送锁，正常聊天计费保持不变。现有重说、续写、创作者 selector 保持。只新增 `nj_reply_*` selector。
- `POST /api/chat/suggestions`：认证 → 会话归属/未丢弃/角色访问校验 → 最近 12 条活跃消息 → 独立模型请求 → 校验恰好三条纯文本回复。
- 客户端不传历史、角色设定或模型。只读取服务端可见历史和玩家面具姓名，不读取创作者私有 persona/system prompt，避免把创作者资产带入建议。
- 历史剥离 script/style/think/HTML，每条最多 3000 字符，总计 12000 字符。建议通常 45–100 中文字符，中文指令上限 180、硬校验 240；仅提供非露骨的回复建议。
- `NIMIR_REPLY_SUGGESTIONS_MODEL` 可指定已注册模型，默认 `gemini-3-flash`。独立于聊天页选择的模型。最多输出 1200 tokens，45 秒服务端超时，不自动重试。
- 不写聊天消息、不扣用户币。不将建议调用计入聊天成功率。模型 usage/finishReason/耗时写服务端结构化日志；目前没有独立费用数据库表，不能当作已完成持久化财务对账。
- 每用户每小时最多 20 次新生成，复用现有限流器但独立 key。5 分钟、最多 200 项进程内缓存，同一上下文并发合并；缓存 key 含用户、会话、模型、面具、消息 ID 和正文摘要。进程重启清空，多副本不共享：正式放量前应评估共享限流。
- 对话变化（包括同 ID 编辑/续写）、面具切换或同 ID 面具改名时取消旧请求并隐藏旧建议。失败不造假建议，可重试。生成聊天期间禁用。

## 验证及边界

- 单元测试：`bun test src/lib/chat/__tests__/reply-suggestions.test.ts`。
- 独立路由测试：`bun test scripts/tests/reply-suggestions-route.test.ts`；模块 mock 必须单独运行，不混入全量测试进程。
- 限定类型检查：`bun x tsc --noEmit -p tmp/reply-suggestions-typecheck.json`。
- 本地真实组件测试页：`bun tmp/serve-reply-suggestions-preview.ts`，127.0.0.1:4319。接口为明确标注的演示响应，不是线上模型效果证明。
- 截图：`outputs/reply-suggestions-20261027/`。
- 本地检查：5 项单元测试、9 项独立路由测试通过；限定范围类型检查通过。浏览器已验证发送/编辑、错误/限流、慢请求后切换上下文、390px 手机与桌面布局。均不代表真实上游端到端通过。
- 多语言结构回归另有 21 项通过，共 35 项相关测试。独立复核发现并修复同 ID 面具改名后旧建议不失效；20px 图标和滚动条主题修正后，复核给出 ship（仅限这三项修复与本地组件证据，不是整站上线验收）。
- 全量 typecheck 受已有脚本、备份目录和 iframe 测试类型错误阻挡；本次未修无关文件。
- 当前仅本地实现，尚未部署测试服/正式服，尚未用真实上游做端到端验收。工作区存在其他人的未提交改动，不能整目录覆盖部署或全量提交。

## Direction contract

2026-10-27 初版落地更新（后于上述预览）：`ReplySuggestions` 已移到 `#nj_chat_input_box` 内，灯泡在发送键之前，面板使用单行 CSS Grid 的自然行高；所有卡片由最长内容撑到同高，没有固定卡片高度。手机 86% 列宽、桌面 44%，超长内容面板上限 40dvh 可滚动；不再显示标题/发送文字/编辑文字，图标仍有可访问名称。`nj_*` ID 保留，输入框外层改为可换行 flex，创作者自定义布局仍需测试服验收。

生成指令更新为场景锚点、玩家动作＋对白、三个不同意图、不代替角色回答/不捏造往事；中文通常 45–100 字、上限 180 字，输出校验仍为每条最多 240 字符。输出预算由 700 提到 1200 tokens，指令本身加入缓存键，避免旧指令缓存。辅助模型仍为独立 `gemini-3-flash`，收费路径未改。

本轮验证：6 项 helper 测试 + 9 项路由测试通过，限定类型检查及新文件 Biome 通过；390px 下三卡实际同高 173.33px、桌面 145.33px，无整页横向溢出，编辑填入未直接发送。真实模型用三组自编普通剧情试跑失败；补充一次诊断得到上游 HTTP 502，记录为 `outputs/reply-suggestions-20261027/quality-v2*.json`，不能据此声称文案质量已验收。4321 预览现在渲染真实前端组件，API 响应仍为标明的模拟示例。未部署、未提交 GitHub。

2026-10-27 后续视觉预览：用户拒绝初版说明文字，改为输入框内灯泡 + 一体化玻璃容器 + 三张横滑卡片，仅显示正文与铅笔。独立模拟预览位于 `tmp/reply-glass-preview.tsx` / `.css`，通过 `bun tmp/serve-reply-glass-preview.ts` 在 127.0.0.1:4321 打开。尚未替换正式组件，未部署、未接模型。已验证 390×844 和桌面外观、编辑填入、模拟发送、横滑及无页面横向溢出。顶部演示标记与工具栏仅为预览说明。截图 `outputs/reply-suggestions-20261027/glass-mobile.png`；背景复用仓库 `public/character-pilot/shen-yihan-v3.jpg`，剧情与回复均为模拟。

THESIS：玩家卡住时选一句可发送的话，不增加额外玩法。
OWN-WORLD：继承聊天页现有夜青银 token、字体、边框和 Lucide 图标，不更改 DESIGN.md。
STORY：点灯泡 → 看到三条建议 → 发送或编辑。加载、错误、限流状态可读。
FIRST VIEWPORT：灯泡加入现有输入工具栏，建议紧邻输入区上方；手机露出下一张卡提示横滑，输入框仍可操作。
FORM：现有界面的局部扩展，用户已明确选择 RB 交互；不另做风格方案。
FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
