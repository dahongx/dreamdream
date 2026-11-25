# Mufy 全量画像采集与迁移交接

产品边界见 [设计说明](../insights/mufy-profile-collector.md)。

## 测试服新增 Top100（2026-10-14）

### 首批5张实际迁移准备实验

后续用户明确允许“没有音频就没有，主体先迁移，迁移后列差异表”。增加显式`--allow-missing-audio`并传入统一Agent及底层迁移器；默认仍严格。只省略未取得的音频URL并记warning，隐藏空原生音频控件，不删除人物Prompt、不换假歌曲、不降低图片/CSS/身份关卡。已取得的曲目保留。测试18项通过（含3项音频策略回归）。新标准下祁远宁、周岳山通过并实际写TEST私有卡，库存103→105，后续原位更新没有重复建卡；另3张仍仅CSS阻断。成品视觉验收尚未完成，迁移状态与差异表.txt区分“已写”“待适配”“已验收”。固定TEST写入脚本在容器现有环境内执行，不导出密钥；源指纹核对、db主机、owner、同名重复与更新目标保护保留。明确不据此授权正式服。

用户授权开始首批5张TEST-only实验。`prepare-mufy-pilot.ts`按最终100名单收藏顺序选祁远宁、宋怀远、周岳山、薛山烬、风满楼，从原ZST重读完整Prompt并核验SHA256，私密保存于任务目录pilot-5。`check-mufy-pilot.ts`对新运行态重做身份判定与新测试库存防重，然后调用真实迁移Agent dry-run；不能用旧身份结论代替当前来源核对，也不修改旧reviews强行交接。每份运行态的hash生成独立Agent目录，修复后不会覆盖不同来源合同。

首轮5张身份重新判定通过，但迁移预检全部阻断：5张引用媒体未完整内嵌，宋怀远/薛山烬/风满楼另有全局CSS作用域适配错误。这属于资源和兼容层问题，不是重新认定角色身份错误，不自动换卡。已执行正常来源补抓，不删除内容或降低安全门槛；本批次服务器写入0，成品验收0。

来源运行态导出器新增公开详情字段白名单，剔除当前用户会话/面具信息与URL中的sessionId；新增captureExecutionMs计时。修正资源超时只覆盖响应头、不覆盖响应正文的问题。新增脱敏回归验证两者，迁移解析与身份判定相关20项测试通过。此轮仅记录实际程序执行时段，用户停留不计入；报告明确未完整记录的分析、开发及早期失败尝试，不能将小计当Agent全工时。

### 当前任务：仅确定100个角色，已完成

用户明确停止继续迁移预检，改为先把最终角色确定完。新入口build-mufy-identity-pool.ts构建收藏优先的500候选及经原档案SHA256核验的私密本地事实缓存；resolve-mufy-identities.ts只做身份对应及库存去重，不调用迁移器或写服务器。实际核对池内310张后取得100个充分对应角色，roleId和sourceKey各100唯一，最终名称与测试库存精确碰撞0；204条已读取但证据不足的关联单列，190条未读取不冒充失败。

确认条件：索引及Prompt主角对应，且86张较长开场正文完全对应、14张至少两段45字符以上的非指令型人物资料与公开人物介绍逐字对应。通用长欢迎词不作为身份依据。年龄基本字段可仅为元数据差异，不重写本地隐藏设定；本轮使用用户已授权的本地档案版本，并明确不保证线上隐藏Prompt最新版。排除测试服已有同时按名称、公开简介和人物设定指纹检查；只读SQL在库内计算md5(btrim(persona))，不输出测试服Prompt原文。该指纹只用作保守去重，不作为认证或加密机制。

最终交付：最终100角色名单.txt、confirmed-role-identities.json；每条有sourceKey、Prompt SHA256、公开证据种类及摘要hash、观察时间、作者与收藏快照。身份待确认清单.txt不进本次100名单；不是把证据不足判定为人物错误。排序范围是已充分对应的本地候选，不宣称全站Top100，也不宣称190张未读都已审过。身份阶段complete=true，不等于迁移/成品验收完成。原20张预检和18无阻断报告属于此前阶段历史，不能继续当作当前“角色已确定数量”。

最新阶段：补读6张及排除3条审定错配后再补读3张，最新100草稿均有详情证据；20张优先卡又补取头像/背景元数据。增加档案主角一致性、本人年龄（不扫描NPC年龄）、开场正文比对及可保留HTML包裹同步的判据。玉雪融档案主角应逐星、程今越CEO对校园生、凌曜高中对大学已记录audited-rejections.json；通用`reject --key --role-id --evidence`按sourceKey/roleId/Prompt指纹保存审定排除，后续select自动跳过并补位，不把不相容来源转成已确认身份。

`stage-mufy-priority.ts`重读20份原Prompt、指纹验证、原文私密导出及真实prepareMufyMigration dry-run：必需人物/开场20份具备，18张无阻断、2张阻断。盛则言optimizationCode之外有audio；邱石之外有表情库HTML。逐卡记录异常，其余卡继续，不把旧报告当本轮成功；非CSS内容不能删掉规避检查。运行态/道具/媒体/目标来源映射及视觉验收尚未完成，不写服务器。`export-mufy-process-progress.ts`生成本轮进度与决策.txt；工作流程与验收口径.txt说明每环节输入、门槛、失败办法及耗时口径。开放可展开UI仍属后续优化，未假称已实现。

用户进一步授权“能用或者你能同步的就用呗”：版本标准改为本地档案底稿，公开资料可同步，不再要求无法取得的隐藏Prompt最新版证明；不授权猜改人物设定或混用明确不同版本。`plan-mufy-local-baseline.ts <job-dir> --local-baseline-authorized`输出local-baseline-plan.json及可读优先名单，保留原Prompt指纹与授权依据，不更改reviews或绕过Agent验收。首轮17张同时满足公开开场归一化一致、基本年龄已知且相同，优先进入预检；其余83张继续核对/同步，不是全部废弃。此为预检计划，不是17张已经迁移完成或完整身份已验收。

同时收窄版本名称规则：新增18岁番外的标题不代表主卡变18岁；顾知裴等更新提示不再自动排除。男高版等明确阶段版本仍不借用未标明该版本的基础Prompt。新增防误排测试通过。没有写测试服或正式服数据库。

2026-10-14北京时间10:19:35—10:21:34完成首轮100张公开详情取证：100成功、0失败，墙钟118.831秒、请求累计18.0623秒（其余含串行等待）。证据selection-live-evidence.json仅保留公开卡资料，不含token、session、mask；selection-live-plan.json锁定原核对名单，audit-mufy-selection.ts从原ZST重读并逐条校验Prompt SHA256。输出selection-identity-version-audit.json：27张公开开场归一化后相同，32张基本年龄字段不一致（仅疑点，不能判定错卡）；详情creatorName全部为空是字段缺失，不是100张作者更换。

首个详情探针401后，通过正常搜索观察到网站refresh=200，搜索重试=200，随后详情=200；不得把初次401直接判为需要再次手工登录。新取证器只做只读串行获取，401/403/429/协议变化立即暂停，绝不导出凭据。来源身份、隐藏Prompt版本、改名后的目标不存在证明依然未完成；不能将公开开场相同当完整Prompt同版本。

显式不同版本标签（年龄版/魔尊版/社畜版/不用打拼版等）若不对应本地完整名称或别名，先排除该关联，不借用基础版Prompt。全候选中排除82条此类关联，首轮100换出7张并补7张；补位7张不在首轮实时核对证据范围，待后续读取。当前100仍是草稿、accepted=0。已请求用户确认“严格要求证明同版本，允许不足100”或“按本地档案版本迁移、标注不能保证线上最新版”的版本标准；未获确认前不推进服务器写入。35项相关测试通过，新增代码范围严格类型检查通过。

**验收更正：此步骤目前是实验草稿，不是完成验收的迁移编排。** 旧100名单经名称关联复查有21条非直接相容（包含简称/后缀，不全是错卡）；宴雎→本人、人设生成小助手→生成等全文命中关联不应进入迁移。select现先排除不相容的关联，再roleId去重和补位；同一卡有另一个相容本地来源时仍可列入草稿。rejected-associations.json留逐条记录，pending-reviews.json列逐卡未完成的身份、版本、目标不存在核对。草稿accepted=0。handoff与画像Agent入口拒绝未完整验收的名单，完整验收需逐卡证据及Prompt指纹，不接受仅status=verified的空壳。

正常Mufy详情页面可见祁远宁的原版和不用打拼版；旧详情读取接口在同站点原有登录方式下仍返回401，已请用户正常重新登录。不得把页面缓存可见当作接口登录可用，也不反复重试或导出凭据。当前先进行本地错误关联剔除与补位，不宣称100张卡版本已核对。

画像采集后先执行 `bun run mufy:profiles inventory-test --job-dir <目录>`，再执行 `bun run mufy:profiles select --job-dir <目录> --metric favorites --top 100 --candidates`。这是迁移 Agent 的选卡阶段，不是数据库导入。

inventory-test 固定测试机115.29.213.73，以60秒超时的SSH执行数据库 READ ONLY 事务，仅取全部characters的id/name；不读Prompt或凭据，不使用本地DATABASE_URL。保存test-inventory.json（测试范围、完整性、采集时间），超过24小时拒绝使用。每次新增批次及实际写入前应刷新，不能把24小时有效期当作实时库存保证。

select 对全部已观察候选按指标降序、roleId去重，再排除测试服名称碰撞，最后向下补足100。名称NFKC/空格归一化；共享基础名的括号版本先保守留待复核，不声称同一版本。test-selection.json含入选名单及逐项排除理由/目标ID，test-top100.txt供人直接阅读。重复观察保留排序最高值，不相加。短缺会如实输出selected，不编造100。

现阶段测试库存没有Mufy来源ID映射，因此改名/别名的历史卡仍需核对；同名排除也不证明卡片相同。入选只是候选，不表示本地Prompt对应。review仍绑定身份和精确Prompt SHA256；handoff强制读取库存、再次去重排除。带--profiles-job的迁移Agent在原有身份/指纹关卡后检查库存，冲突拒绝新建；只有显式--remigrate及正确--update-character-id允许更新。

本轮测试服只读取得103张卡，候选池9124个唯一roleId，保守排除93个名称碰撞，剩9031个，收藏排序生成100个新候选。没有执行任何角色迁移或服务器写入。新增5项筛选回归测试与已有24项画像/浏览器/监控测试共29项通过。

## 模块边界

画像模块独立于迁移写库。画像程序没有数据库或 Storage 写入能力；只读取本地档案、登录页能访问的搜索数据，保存本地任务文件。迁移交接仍要求最新版运行态、手机/桌面验收和原有 TEST-only 保护。

- CLI：`scripts/mufy-profile-pipeline.ts`，命令 `bun run mufy:profiles`。
- 页面采集器：`scripts/collect-mufy-profiles.js`。
- 数据契约与排序：`src/lib/import/mufy-profiles.ts`。
- 已集成迁移入口：`scripts/run-mufy-migration-agent.ts` 的 `--profiles-job` 与 `--profile-key`。

## 操作顺序

```powershell
# 1. 全量建立索引；Prompt 原文不进入画像索引
bun run mufy:profiles prepare --archive "完整档案.jsonl.zst" --job-dir "logs/mufy-profiles/my-job"
# 系统找不到 zstd 时可指定 --zstd-bin "zstd.exe绝对路径"

# 2. 从成功采集的断点生成剩余全量队列，不设置 --limit 就是全部
bun run mufy:profiles queue --job-dir "logs/mufy-profiles/my-job"

# 3. 用户登录 Mufy；操作者把 browser-queue.json 对象赋给
# window.__MUFY_PROFILE_QUEUE__，再执行 collect-mufy-profiles.js。
# 页面任务自己串行运行，不需要按每100条重新发指令。
# 结果持续写入该站点自己的 IndexedDB，并在
# window.__MUFY_PROFILE_EXPORT__() 导出最新无凭据快照。
# DOM节点 mufy-profile-export 每25条及结束/错误时发布完整快照。
# 在工具环境用已授权的浏览器 developer/CDP 接口执行，不绕过浏览器授权。

# 4. 保存无凭据快照到本地，然后入库；同一快照重复导入不会重复计数
bun run mufy:profiles ingest --job-dir "logs/mufy-profiles/my-job" --snapshot "无凭据快照.json"

# 5. 查看候选榜和任务状态；未采集不能当成0
bun run mufy:profiles monitor --job-dir "logs/mufy-profiles/my-job" --snapshot "实时无凭据快照.json"
bun run mufy:profiles rank --job-dir "logs/mufy-profiles/my-job" --metric favorites --top 100 --candidates
# 角色候选榜按roleId去重，避免多个名字命中同一卡重复占名额
bun run mufy:profiles rank --job-dir "logs/mufy-profiles/my-job" --metric favorites --top 100 --candidates --unique-roles
bun run mufy:profiles status --job-dir "logs/mufy-profiles/my-job"
bun run mufy:profiles report --job-dir "logs/mufy-profiles/my-job"

# 6. 核对人物/开场/版本后，写入明确证据；不能只凭同名确认
bun run mufy:profiles review --job-dir "logs/mufy-profiles/my-job" --key "档案key" --role-id "Mufy UUID" --evidence "具体比对依据"

# 7. 只导出已确认卡的完整原始Prompt与role-map，不做迁移写库
bun run mufy:profiles handoff --job-dir "logs/mufy-profiles/my-job" --metric favorites --top 100

# 8. 正常抓取源运行态，再进入已有迁移 Agent
bun run mufy:agent --mufy-runtime "来源运行态.json" --prompt-json "handoff/assembled/key_prompt.txt" --profiles-job "logs/mufy-profiles/my-job" --profile-key "档案key"
```

## 搜索口径、限速与中断

真实页面请求已核实为 POST `/api/search/characters`，参数 `pageNum/pageSize/contentType/genderText/searchText/sortBy/showNsfw`。
全量采集明确使用 `showNsfw:true`，不改变用户页面偏好；只能取得账号本来有权限访问的数据。旧 UI 试采集曾使用 `showNsfw:false`，其空结果不能当作全范围缺失，也不能当作这条全量任务的成功断点。

默认串行、每页至少等待1秒（队列默认1.5秒），网络请求15秒超时。网络/5xx最多3次指数退避。401/403、429、字段协议变化立即暂停，不绕过身份挑战或限流。每个名字完整翻页后才允许 `not-found`；最多100页，超限是失败，不是查完。

浏览器节点不是持久后台服务：关闭页面、关闭应用、机器休眠可能停止执行。重新执行相同job队列会从 IndexedDB 已完成key续跑；CLI队列又从本地已入库断点过滤。页面库仅使用 `mufy-profile-collector-<sourceDigest>`，不清理或覆盖站点原有数据。

## 记录和交付

任务目录保存 `job.json`（来源指纹）、`sources.json`（全名单与Prompt指纹，不含原文）、`observations.json`、`reviews.json`、`ranking.json`、`operations.jsonl`。
`report` 输出全名单 `roster.csv`、一对多候选明细 `candidates.csv` 和覆盖率摘要，可用Excel筛选排序；CSV有UTF-8 BOM并转义公式前缀。它不含Prompt原文、密码或登录token。最终美化Excel是报告层，不影响断点。
页面快照记录开始/结束、逐条elapsedMs、attempts、activeMs、waitMs、状态及搜索参数。CLI日志记录命令开始、结束、失败和耗时。开发耗时与正式采集耗时独立；没有采集的范围不能宣称全库Top100。

指标保留 null 与真正的0；`totalLikes` 对应心形点赞，`totalFollowers` 对应页面星形收藏，`totalChats` 保留原字段，不擅自解释为用户数或会话数。
候选不是已确认画像。`review` 必须由操作者核对来源；已确认的 roleId 与原始Prompt SHA256一起绑定，后续Prompt改变即拒绝迁移交接。

当前可筛选Excel在 `outputs/mufy-profiles-20261012/角色画像总表.xlsx`；它是阶段性报告，不是采集器的持久状态。全量任务与旧109条试采集严格分开，后续报告从新的任务数据生成。

## 2026-10-13 实验记录

- 开发任务首次开始：北京时间10:17:08；截至11:19:52墙钟经过62分44秒。这包含开发、验证和工具/恢复间隔，不等同于纯人工工时，也不能当作单卡采集耗时。
- 新任务：`logs/mufy-profiles/full-20261013`，索引10,839条；首5条实采请求时间4.49秒、配置等待7.5秒。重复执行这5条时请求数为0，验证页面检查点有效。
- 全量剩余10,834条已启动。首轮遇到AUTH_REQUIRED暂停；通过网站正常搜索自动刷新登录后恢复，没有手工输入凭据。最新入库52条、59条候选，尚未完成全量或确认最终Top100。
- 新增测试18项通过，模块严格类型检查通过，diff检查通过。全仓测试572通过、2失败/2加载错误：`wallet-event.test.ts` 和 `model-status.test.ts` 在postgres初始化时报ERR_INVALID_URL；不修改或输出数据库凭据。全仓类型检查另有原有脚本错误，不能宣称全仓验证通过。
- 页面仍运行，必须保留该页面并避免休眠；登录/限流暂停需先恢复正常页面访问，再执行相同队列。失败记录保留于快照和CLI操作日志。入库/报告可重复运行，成功记录不重复计数。
- 补充验证：只在测试子进程中清空无效DATABASE_URL、不连接任何数据库，完整测试581项通过、0失败；不改用户环境文件。11:23:25全量检查点171条，仍运行；恢复后本轮实际墙钟6分25秒，请求累计126.92秒、配置等待252秒。

## 暂停监控补齐（2026-10-13）

此前采集器11:30因AUTH_REQUIRED停止，却没有独立监控唤醒主任务；网页脚本并不等于Codex持续监督。不能再向用户承诺会自动知道失败。

已在当前聊天创建ACTIVE心跳巡检，ID=`mufy`，每5分钟检查真实页面，而非读取旧文件。程序入口 `monitor --snapshot` 更新 `monitor-state.json`、写operations.jsonl：首次暂停/恢复/结束提醒，重复状态不报警，连续10分钟成功数和请求数不变标为stalled；finished且仍有失败标记finished-with-failures，不冒充完整成功。

AUTH_REQUIRED只尝试一次网站正常搜索触发其正常刷新；仍失败通知用户重新登录，不循环攻击接口，不自动输入凭据。限流/协议变化通知后暂停。巡检保存快照、入库和刷新报表。页面/电脑休眠或应用关闭可能使巡检无法执行，5分钟是配置检查间隔而不是即时通知保证。

15:34:18正常页面访问恢复后已从原检查点启动，15:36核验已推进至375条成功、1条失败，status=running；追加6项监控测试通过，模块严格类型检查通过。手动运行monitor已验证暂停与恢复notify=true；定时唤醒/系统通知实际送达尚需首轮巡检验证。

追加最终核验：当前成功453条、失败1条且running；隔离无效数据库连接配置后全仓587项测试通过。不能将453条成功写成454条成功；全部失败记录需要任务结束后复查。

## 全量完成记录

2026-10-14北京时间03:26:10搜索队列结束。10839个唯一档案key全覆盖，missing=0、incomplete=0、failed=0；4626个名字有候选、6213个名字搜索无结果。候选明细11200行，去重9124个roleId。无结果并非证明Mufy不存在原卡，有候选也不是身份/版本已确认。

收藏、点赞、totalChats候选榜分别输出top100-*-candidates.json，`--unique-roles`确保同一roleId只占一行；重复观察按该指标最高观察值保留，不相加，每行仍带原观察时间。榜单身份未确认，不自动授权迁移或宣称Mufy全站Top100。全名单roster.csv和候选明细candidates.csv可筛选。completion-audit.json记录覆盖审计与耗时，心跳mufy已PAUSED。

从最初开发任务开始到采集结束墙钟17小时09分02秒，包含开发、验证、最初约4小时登录暂停及约2小时浏览器不可访问等间隔；不是纯采集时间，不宜直接当作复用后的性能基准。
- `waitMs` 是限速与退避的配置等待量，后台节流可能增加实际墙钟时间；实际经过时间以startedAt、finishedAt或exportedAt差值及逐条elapsedMs为准。
