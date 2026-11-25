# 公开 OC 档案表单复制

第五族：谢闽六字段mask v7。当前来源实际显示复制成功但独立合成剪贴板标记未变；已清空所有合成字段并恢复收起。有限兼容捕获原始/旧候选的提取按钮，仅从本iframe六个可见表单字段按原格式、trim、五个“未录入”/秘密“无”、完整末尾注释生成公开文本，经同一write-only ACK复制；旧填草稿处理器不执行。94字实际复制、真实Ctrl+V完全一致，重绘保留字段，空表默认值和390窄屏trim复验通过，343/343无溢出、草稿空、发送0、allow-scripts。证据 final-acceptance/41/mask-copy-*-20261031.*，旧 local-mask-form-ui-check.json 的填草稿仅是被纠正的历史结果，不是当前复制验收。

未来暂存只将原始父窗口handler局部绑定为自己的window，保留原始clipboard动作；新第五族同样受“不得变成填草稿”保护。原有rank41候选链文件禁止覆盖，旧候选由运行时向后兼容。原站浏览器连接曾重置，Chrome编号从3变为4，按用户明确指定的Chrome恢复，并实际核实六字段清空；没有读取或搬运凭据。

迁移防回退：`normalizePublicFrameReplay` 对这四种已观测的公开复制组件保留原始clipboard调用，不再在暂存阶段改成聊天草稿。历史 `adaptMufyAvatarDraftCopy` 默认拒绝转换，只有明确的历史审计选项允许复现旧结果；旧rank36生成脚本已退役并硬失败，不能覆盖旧证据。既存旧候选仍由有限运行时拦截恢复复制，哈希历史不变。增加四族原始复制保留/幂等测试及默认拒绝旧转换测试。

产品取舍：[insights](../insights/mufy-oc-profile-copy.md)。

2026-10-31 实际核对卓序生：七个表单区、生成结果在 `{{char}}` 角色绑定后对应，但 TEST 的复制被通用 clipboard pending stub 永久挂起。不得把“复制到面具”的剪贴板动作替换成填入聊天框。

只对同时包含 `oc-generator`、`oc-output-wrap`、`oc-output-text` 和两个已知复制函数的公开表单注入有限兼容。真实点击发出 write-only 请求；RegexIframe 仅接受自身 contentWindow、有限整数请求号、非空且不超过 100000 字符的文本，并在宿主检查浏览器真实 userActivation。复用现有 `copyTextToClipboard`，完成后回复结果。不读剪贴板、不发送消息、不读宿主状态、不扩展 iframe sandbox 或 Permissions Policy。非当前 frame、无手势、超长数据、普通组件均拒绝。卸载移除监听，清空取消 pending 状态。

重要实测：直接在 opaque frame 内 execCommand 返回 true 仍未改变剪贴板，已撤掉该尝试，保留失败证据。最终隔离预览的 522 字实际 clipboard 与真实 Ctrl+V 均一致；清空后七区收起、文本输入全空、结果隐藏；390 CSS 宽度无横向溢出。桌面复制操作和读取验证耗时 1077ms，仅此操作墙钟，不是 Agent 净工时。TEST 尚未发布，HTTP 降级仍须发布后按现有 util 路径真实复验。物理 iOS 未测试。

证据位于 `logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/47/oc-form-copy-*-20261031.*`。本地修复不等于整卡/整批验收，也不触发构建许可。
# 公开开场提取复用（2026-10-31，本地未发布）

简行舟公开指令卡：`cen_cmd_wrap_Sx/cold_tank_item[data-command]/Z_CONFIG_btn/Mm_toast` 加明确 `censyCopyFn_v1` 原始读取/复制表达式构成有限签名。捕获真实COPY点击，仅ACK成功才显示原有toast，不读剪贴板、不填草稿、不发送、不扩权。当前来源和TEST各自独立合成标记均未改变；本地修复后剪贴板和真实Ctrl+V与渲染的公开data-command一致。注意平台已有角色绑定会将两处 `{{char}}` 变为当前角色，本地Fixture对应876字，来源原始878字；只记录“绑定后精确”，不伪称原始占位符逐字未变。已保存初次错误口径及纠正说明。

该已知卡根 `width:100%` 加左右5px padding 曾造成390视口内层10px溢出，有限fallback仅给该根加零特异性border-box，最终内层358/358、外层390/390，草稿空、发送0、allow-scripts。证据 `final-acceptance/26/public-command-copy-*-20261031.*`。尚未TEST发布。

邱石的同族头像库标题为拆分的 AVATAR/LIBRARY，原始提示为 `Copied!`。仅补充这一已观测签名，仍需要 wrapper/content/img 和明确原始复制处理器，不匹配任意按钮。15张原图双方全部解码、本地15次真实复制和末张粘贴一致；首张展开过渡期漏点单独保留，稳定展开后复验通过；390宽度无横溢出、发送0、草稿不变。证据 `final-acceptance/30/avatar-copy-*-20261031.*`。

头像库复用更新：裴宪宇原站33张图片的动作是复制图片链接。历史 `avatar-copy` 候选错误地改为填草稿，保留其哈希作审计历史，不重新生成或伪称已上线。有限运行时同时识别原始库和旧候选，捕获真实图片点击并阻止旧处理器，走相同源窗口/真实手势/ACK的只写剪贴板路径；不填草稿、不发送、不alert、不增加权限。只复制HTTPS且无用户名密码的图片src。33张实际剪贴板全精确、真实Ctrl+V一致，草稿空、发送0；390宽度复制一致无溢出。证据 `final-acceptance/36/avatar-copy-local-20261031.json`、`avatar-copy-local-final-20261031.json`、`avatar-copy-mobile-20261031.*`。尚未TEST发布，不代表整卡完成。

`hasPublicEngravedOpening` 仅识别已观测的 `.mufy-glass-openings/.mufy-glass-content/.mufy-pill-btn/.mufy-engraved-text` 和原始读取/复制表达式，不给普通作者按钮开放通用剪贴板。复用现有历史命名 `nj-oc-profile-copy` 的源窗口、请求号、100000字符上限、宿主真实 userActivation 和 ACK 校验；没有新沙箱权限、剪贴板读取、草稿或发送接口。

宋锦琛公开开场原文1799字，在当前 TEST 和来源 Chrome 的实际按钮测试都留下各自合成剪贴板标记未变，分别留档，不凭来源复制失败就认定角色下架或资源失效。本地修复后真实复制、Ctrl+V粘贴精确一致，草稿测试后清空，发送0；390手机视口复验一致且无横溢出，仍为 allow-scripts。状态文字沿用原按钮计算后的色调，成功反馈在宿主复制完成后出现。证据 `final-acceptance/38/opening-extract-*-20261031.*`。尚未 TEST 发布。
