# 已保存公开回复的真实渲染复验

产品边界见 [验收口径](../insights/mufy-saved-public-reply-replay.md)。本工具不生成聊天，不读取数据库、凭据或私有角色设定；只消费批次已保存的公开回复和美化规则。

## 使用与证据

1. `scripts/stage-mufy-batch30-saved-reply-preview.ts` 汇集公开回复、完整规则基线及有证据的兼容规则。必须保留原始回复和完整规则的 SHA-256。
2. `scripts/serve-mufy-batch30-saved-replies.ts` 提供临时 loopback 开发预览，使用实际 MessageBubble。CSP 禁止第三方图片、字体、媒体和网络；不是测试服构建或发布。
3. 仅通过授权 CUA 标签页调用 `inspectSavedReplyUI`。逐条检查规则指纹、折叠块、孤立 summary、已知协议泄漏、恢复状态及零发送。逐条断点保存，失败和旧规则记录归档，不覆盖历史。
4. `scripts/checkpoint-mufy-saved-reply-replay.ts` 只认匹配完整指纹的证据；另外核对 390px 的初始收起布局记录。手机布局不能代替展开态、真实媒体或触屏测试。

完整链路必须使用 rules-only 基线和已核实的附加兼容规则，不能只用 source-chain-only。后者曾造成 rank49 的伪回归；相关旧证据保留，但不满足当前验收。

## 2026-11-01 检查结果与限制

- 应有 54 条，已有公开完整样本 52 条；rank38 两条仍缺失，原会话有截断提示，未重试或换模型。
- 52 条均有完整规则指纹绑定的结构检查。rank43 第二条在快速连续点击时仍漏开记忆总栏及其子栏；另存分步实点证据，四项都能打开并恢复。不能用后者覆盖前者或宣布问题已解决。
- rank29 两条使用过正常键盘兜底，不是鼠标/触屏验收。检查汇总显式保留 pointerReviewCases。
- 随后在真实测试服 rank43 第二条同一四个折叠项连续实点成功、恢复全收起：`final-acceptance/43/current-test-reply-folds-20261101.json`。本地快速漏点未在此复现；不能把本地装置异常直接当作产品回退，也不能据此宣布整卡完成。
- 52 条完成 390px 初始收起态布局测量；外层与交互框未测到超出容器的横向溢出，不能泛化为所有展开态通过。
- QA 工具单测独立计数：4 pass / 16 assertions，不冒充产品回归或整卡通过。
- 每条 elapsedMs 为浏览器操作的实际墙钟时间；agentNetMs 为空，不由调度、等待或这些墙钟时间反推净工时。

整批测试服、媒体、字体、来源视觉及候选集成仍由批次主检查点决定。本工具永不自动授权构建、发布或标记整卡通过。

## 最终候选组合检查

`stage-mufy-candidate-composition-preview.ts` 只读取 19 份已核实 owner 美化代码的最终候选，并重新核对 SHA-256，不读取角色设定。`serve-mufy-batch30-saved-replies.ts --candidate-composition` 将真实 OpeningSlot、FloatingSlot、FloatingLayer、前缀、Halo 和快捷控制组件放在同页。此装置没有 ChatRoom 网络传输，也不等同真实测试服。

`mufy-candidate-composition-ui-check.mjs` 经授权 CUA 标签页记录桌面与 390px 挂载、重绘前后 iframe 槽位和零发送。`checkpoint-mufy-candidate-composition.ts` 验证 38 份指纹一致的浏览器记录，并将摘要追加到主检查点。19/19 桌面及19/19手机未发现预期原生节点漏挂、前缀数量不符、槽位变化或初始外层横向溢出；不是全交互或来源美术通过。

另外实际验证：rank49 光环面板展开后重绘仍展开；rank38/41/46 三个前缀面板在手机下展开、不移焦点的定时父级重绘、内容/位置保留及收起通过。前一次把焦点移到外部按钮会触发正常的 focusin-outside 关闭，历史结果作为检查方法失配保留，不作产品缺陷。不要用外部按钮聚焦来证明“纯重绘导致关闭”。

QA 工具目前单独为 7 pass / 19 assertions，产品既有 299 项回归数字不因此增长。组合检查只覆盖有待发布候选的 19 张；不能把它改称 27 张整卡通过。进度在 `candidate-composition-preview/progress.json`。

`audit-mufy-tested-runtime-alignment.ts` 还逐项核对当前实测源代码与待发布28文件：保留测试服三处模型状态通知、只纳入公开 draft relay 修复、排除未授权官方播放器 same-origin 扩权这三类既有例外，其余必须精确相同。当前28/28一致，补丁仍为 `fd4863133633d78f1d4fcf1949d2d66fbd04d1159693a8520c2b01a90b5a0e1d`。它不访问远程，也不证明远程当前运行镜像未变化；发布前仍需只读重核真实目标版本。

后续 `recheck-mufy-test-prebuild-baseline.ts` 已只读复核8091实际容器/运行镜像/8项已审阅基线源码和三路径容量，不读取环境变量、日志、数据库或数据卷，也不覆盖原始发布基线。证据 `test-prebuild-baseline-recheck-20261101.json`。阶段审计 `audit-mufy-batch30-phase-boundary.ts` 将这些已完成检查、外部未通过项、构建后才可验证的真实集成及待用户确认的执行阶段分开；它本身不授予构建许可。

`reconcile-mufy-roster-progress.ts` 现只更新21—50，本批外70行在写前逐字JSON比对，原冻结名单SHA仍核验。已导入的37范围暂缓由独立已存在的scope-review-hold元数据恢复，不读角色正文；计入已导入总数但不计普通可验收或通过。3项13断言另计，不修改既有产品回归总数。

等待阶段授权时另补了原始 Ocean Eyes 媒体身份缺口：`final-acceptance/48/ocean-eyes-current-title-source-progress-20261101.json` 同时记录源/本地标题、原始dlink.host地址、199.6205秒时长及实际进度，本地重绘后未换曲/停止；最终两边暂停、抽屉关闭。`checkpoint-mufy-ocean-followup.ts` 只关闭这一旧证据资格问题，保留其他5曲历史证据及冷资源未确认；不授予TEST/全媒体/整卡通过。组件映射旧reason进reasonHistory，新mediaFollowupEvidence与真实补充JSON的SHA由依赖审计再核验。
