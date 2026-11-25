# 执行入口与输入

候选版强制门禁：init 只接受一张待迁移或待验卡；doctor 的 ok 仅表示包完整，distributedReady:false 表示未获多人批量认证。真实样本未通过前不能解除门禁，也不能拿旧版绕过。

全部已打包命令只需要 Bun，转换核心及依赖已内嵌，不必安装整个平台。只有修改源码并重新打包时，才在 reference-source 按记录的 package.json、bun.lock 安装锁定开发依赖（`bun install --frozen-lockfile --ignore-scripts`）；这是接收方自行配置的开发环境，不读取本机账号配置。不要运行 reference-source/package.json 的旧平台写库命令，也不要把旧仓库 `mufy:agent --commit` 当作本包入口。

设 `PKG` 为解压目录；所有命令是 `bun PKG/dist/agent.mjs ...`，命令中的路径用自己的绝对路径，不必放在原作者 E 盘。

1. `doctor`：校验所有冻结代码/文档哈希，输出 packageId 和 Git 基准；不读取账号、联网或执行部署。
2. `init --roster roster.json --out job-folder --runtime 64位运行代码指纹`：创建新批次。runtime 应由协调者从已审发布指纹或公开版本标记取得，不能猜测；它不是 token。已有批次拒绝覆盖。
3. `assign --job job-folder --workers alice,bob`：一次分配互不重叠的本地档案；同来源角色归同执行者。已迁移卡可以分配验收，held 和之前 accepted 不重新分配。
4. `claim --job job-folder --worker alice --rank 51`：独占领取；已有 claim 拒绝覆盖，协调者人工处理冲突，不能靠过期猜测删除别人的工作。
   领取后运行 `scaffold --job job-folder --worker alice --rank 51`，生成全部19项默认 blocked 的验收模板；复制到自己的工作报告后填写实际观察。时间空值/0表示未检查，不可拿模板提交通过。
5. `prepare --job job-folder --worker alice --rank 51 --input inputs/51/input.json`：仅输出本地 XML 与指纹审计。必须位于本批次、绑定角色名/roleId/本地原文指纹/完整公开来源证明。已导入则拒绝二次准备，转 owner UI 修复。
6. 网页正常导入后 `receipt --job job-folder --worker alice --rank 51 --url http://115.29.213.73:8091/chat/实际ID`。receipt 不是验收通过；不能重复登记导入。
7. `review --job job-folder --worker alice --rank 51 --report workers/alice/51/card-report.json`：不通过返回错误队列，退出码2；通过才生成批次 reports/51.json。已接受报告不会默默覆盖。
8. `merge --job job-folder --runtime 刚确认的当前目标运行指纹`：重新检查所有报告及原始证据，并拒绝运行版本变化，输出 passed、held、pending、previouslyAccepted。只有本批全部应验项通过才 readyForHumanReview；以前 accepted 不冒充本次重验通过。

退出码1是输入、版本或操作错误；2是验收不完整；0不是所有场景的整卡通过，须读命令输出。

## Roster

```json
{"version":1,"targetBaseUrl":"http://115.29.213.73:8091","cards":[{"rank":51,"sourceKey":"local_51","name":"已核实角色名","sourceUrl":"https://chat.mufy.ai/chat?roleId=完整UUID","status":"pending"}]}
```

status 为 pending/imported/held/accepted。imported/accepted 必须有 targetUrl；held 必须有 holdReason。rank/sourceKey 不重复；多个本地档案可以对应同一线上角色，不能把线上角色数当本地基数。

## Prepare 输入

input.json 保存相对 job-folder 的路径：

```json
{"detail":"inputs/51/public-detail.json","prompt":"inputs/51/authorized-local-original.txt","promptSha256":"原文SHA256","rules":"inputs/51/public-rules.json","sourceProof":"inputs/51/source-proof.json","appearance":"inputs/51/public-appearance.json"}
```

public-detail 使用冻结 `reference-source/src/lib/import/mufy-migration.ts` 中 MufyRoleDetail：至少 characterId、name、sourceUrl、publicDomDerived:true；greeting 来自授权本地原文/明确公开内容，codeRenderContent 是完整公开组件，optimizationCode 是公开作者CSS。不要凭名字相同绑定身份，不自动添加台词头像或猜测缺失样式。未覆盖的特殊组件交 Codex 比对修复，不由准备成功代替完整性判断。

public-appearance 必须为 `{version:1,roleId,sourceUrl,observedAt,captureScope:"normal-page-public-dom",sourceStyles:string[],contentClasses:string[],speechAvatar:boolean,semantic?:MufyPublicSemanticAppearance}`。数组与头像开关必须来自实际公开DOM；不能因为缺少采集就填空。semantic 的格式见冻结源码 mufy-public-semantic-skin.ts。此入口还执行原批次的渲染协议缺失检查、侧栏边界、公开内容样式、语义色彩、来源台词头像及装饰宽度、窄范围结束约定适配。原始档案保持不变。codeRenderContent 须包含所有公开组件全文及完整嵌套 srcdoc；不得只交空 iframe 或丢失的 frame token。

source-proof 至少包含 sourceUrl、roleName、bodyLoaded:true、lengthVerified:true、真实 observedAt，以及 detailLengths.greeting/codeRenderContent/optimizationCode 的实际完整字符数，并在同目录保留支持它的公开 DOM/长度观测；长度不符拒绝准备。public-rules 使用现有 MufySourceRuleCapture：version:1、roleId、capturedAt、captureScope:"normal-page-public-render-rules"、responseCode:200、responseDataWasNull、rules。只能记录正常网站公开设置/渲染得到的规则；禁止据此调用隐藏接口。没有真实规则采集时必须停在缺证据状态；不能伪造空列表。

prepare 保留原文文件，只在 XML 传输副本正规化换行；不自动更改作者的模型输出约定。XML 逐字段回读及组件一致才输出；特殊协议、头像、源规则、媒体和视觉仍须实际验收。准备产物含用户提供的角色原文，勿放进代码分享包或公开文档。

修复输入的公开组件HTML旁必须有同名 `.binding.json`：`{rank,sourceKey,sourceUrl,sha256}`，绑定当前分配卡和HTML原件。不允许把另一张卡的组件误标成当前卡修复。
