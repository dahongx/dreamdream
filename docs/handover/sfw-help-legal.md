# SFW 帮助与协议

产品说明见 [insights](../insights/sfw-help-legal.md)。

- 仅 NEXT_PUBLIC_SFW_MODE=1 启用；主站原文书与功能保留。
- /agreement/user、privacy 使用 SFW 文书；guide、billing、refund、content、contact 为新增公开页面，未登录也可访问。
- 四语言数据集中在 src/lib/legal/sfw-documents.ts；沿用既有 user/privacy 章节锚点。
- Shell 页脚提供七个入口，聊天、角色、分享及订阅包页面不插入；商店在购买区前另提供付费/退款/联系入口。
- 退款为人工核查说明，没有新增自动退款接口或自动承诺处理时限。PayProo 目前为测试环境，未切换实收款。
- 2026-11-19 运营方提供主体：StarEcho Technologies Limited，商业登记号码 80678055，已补入四语言用户协议、隐私政策与联系页面。地址及注册地未提供，不推断。
- 用户指定客服邮箱 support@dearm.ai，回复目标参照 Rubii 设为 10 个工作日；明确该目标不等于银行退款到账期限。
- 待运营确认：support@dearm.ai 能否实际接收并处理邮件；支付渠道若要求披露地址则需补充真实地址。不得复制竞品主体或编造承诺。
- 文书根据现有部署描述跨境处理及自架 Supabase；以后更换数据存放地、支付商、AI 服务商时应同步复核。
- 验证：bun test src/lib/__tests__/sfw-help-documents.test.ts；主站原协议测试在非 SFW 环境执行；构建、匿名多语言页面与商店入口检查。
- 部署仅限 yearn-sfw-app / dearm_sfw / 8094；不迁移或写入角色数据，不变更 chat.dearm.ai。

文本完善不等于获得支付机构或监管批准，实际主体及可用联系渠道应在提交支付审核前落实。

## 2026-11-19 部署验收

- 已部署 yearn-sfw-app:help-legal-20261119；上一容器保留为 yearn-sfw-before-help-legal-20261119，可回滚。
- 四种语言共 28 个匿名公开文书页面通过；探索页仍有 20 张角色卡。公网指南/退款均返回 200。
- 登录后商店三个规则入口均存在，位于商店操作区域之前；临时验收账号已删除，auth 与业务库残留均为 0。
- SFW 专项 3 个测试、743 项断言通过；原协议相关测试 248 个通过；Next.js 构建和角色客户端 manifest 检查通过。
- NEXT_PUBLIC_APP_URL、SITE_URL 从旧示例/IP 地址改为 https://play.dearm.ai；PayProo 保持 test，未实际付款。
- 浏览器工具连续超时，未完成截图与窄屏视觉验收；不得将此项报告为已通过。
- 原主站仍展示 2026-07-01 用户协议及原有说明；本次没有部署或修改主站运行配置。

## 最后一轮核对与完善

- 已发布 yearn-sfw-app:help-final-20261119，保留前一容器以便回滚。
- 注册新增主动勾选的 18 岁及两份协议确认；后端也检查 sfwConsent=accepted，未提供时拒绝进入注册逻辑。仅 SFW 生效，既有邀请码分支未覆盖。
- 注销页原来绝对的“不退款”说明与新退款政策冲突，SFW 已改为先处理未结算问题、注销不自动退款、法定权利保留。
- 商店明确显示当前为测试支付，防止把支付审核准备误解为已正式收款。
- 发信：复用现有阿里云发信账号到测试 Auth，SMTP SSL 认证成功；仅重建 supabase-auth，未重建 dearm-prod-auth。原配置保存在服务器 help-final-20261119/before-mail.private.env，权限 600。play.dearm.ai 的恢复跳转已加入允许列表。
- 测试 Auth 同时服务测试站与 SFW，邮件配置是共享基础服务变化；主站正式 Auth 保持不变。邮箱发送配置与 support@dearm.ai 接收邮箱为两条独立链路。
- 已验证：四种语言 28 个文书页面、20 张公开角色卡均有头像、注册确认服务端拦截、登录后的购买说明入口、测试付款提示、密码恢复链接目标域名；临时验收账号已删除。没有发测试邮件或执行实际支付。
- 仍需邮件管理员确认 support@dearm.ai 的收件能力：查询未见 MX，不能把 SMTP 发件认证成功当成客服已能收信。
- IAB 与 Chrome 浏览器控制均连续超时，因此手机实际显示与截图验收仍未完成，不能对外称“全项验收通过”。
- 最终检查：SFW 专项 4 个测试、760 项断言通过；生产源码 TypeScript 检查通过（tsconfig.delivery.json 排除测试夹具和脚本）。仓库原 typecheck 脚本引用缺失的 tsconfig.typecheck.json；直接全仓检查会命中既有迁移测试夹具缺失/类型错误，未将这些检查报告为通过。
- 发信连接仅验证 SSL/账号认证及恢复链接生成，未发实际测试信，因此未验证邮件送达。测试账号在 auth、postgres.public.users、dearm_sfw.public.users 的残留均为 0。

参考原文：[Rubii退款](https://rubii.ai/refund-policy)、[Rubii联系](https://rubii.ai/contact-us)、[Rubii内容规则](https://rubii.ai/content-rules)、[Mufy协议](https://chat.mufy.ai/more/user-agreement)、[Mufy隐私](https://chat.mufy.ai/more/privacy-policy)。Mufy 页面存在门户跳转，部分核对来自官方页面的搜索索引；未把无法确认的退款规则当作已核实事实。

## 正式条款结构

sfw-detailed-clauses.ts 为额外细则数据；由 sfw-documents.ts 合并为条款，并生成章节及子条编号。仅用户协议、隐私、付费、退款、内容规则采用编号，指南与联系页面保持易读布局。原有章节 ID 保留，所有上线语言同步。

| 文书 | 章数 | 条数 |
| --- | ---: | ---: |
| 用户协议 | 15 | 37 |
| 隐私政策 | 12 | 28 |
| 付费说明 | 5 | 10 |
| 退款说明 | 6 | 12 |
| 内容规则 | 4 | 9 |

每章补足可实际适用的细则，包括投诉证据、数据处理范围、身份核实、退款阶段等。没有以增加字数代替事实核对，没有使用其他平台的主体、金额上限、仲裁条款或尚未具备的审核承诺。此前的邮箱送达与手机视觉验收限制仍保留。

已发布 yearn-sfw-app:legal-detailed-20261119。5 个专项测试、1952 项断言、文书模块 TypeScript、构建及 28 个多语言页面检查通过；公网 HTML 实际解析得到用户协议 15 章 37 段、隐私 12 章 28 段，主体和登记号码均在页面中。保留上一容器 yearn-sfw-before-legal-detailed-20261119；主站、角色数据及支付模式未变更。
