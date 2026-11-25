# 来源快捷符号与滚动控件

产品取舍见 [insights](../insights/mufy-source-controls.md)。当前仅本地候选，未写入 TEST、未构建部署。

江峙 source0 使用相同公开 V7 快捷符号，但 source1 是另一套查找导航，不能套用傅司晏的 Fox 滚动按钮。`pageControls.scrollButtons=false` 明确仅启用快捷符号；省略时保持既有 Fox 行为，其他类型拒绝。`stage-mufy-jiangzhi-quick-symbols.ts` 保留当前 profile clip 修复基线全部字节，只追加符号配置。独立导航、音乐仍待适配，不能将此项记为全卡通过。

`stage-mufy-fusiyan-page-controls.ts` 从来源公开 source7/9 提取两个静态样式字面量，确认三个已知符号动作，不执行来源脚本。追加 `page-controls` 惰性配置；不迁移来源 setInterval、父页面扫描或注入程序。候选串接指令侧栏候选，仍需新 owner UI 基线核对。

`MufySourceControls` 只接受严格校验后唯一一份配置。三个快捷按钮在当前选区插入 `（）`、`$`、`$线上聊天：`，括号光标留在中间；已有正文不丢失，不提供发送、上下文、存储访问。完成 React 更新后在 layout effect 内、绘制前恢复焦点光标，不再等待 rAF，防止连续动作看见临时的末尾选区。滚动按钮只操作 `nj_chat_messages`，不会扫描其他滚动容器或控制整个网页。

江峙真实连续操作复现旧 rAF 时机：第一次读取 caret4，后续前缀落入错误位置。保留失败证据后，同一套动作修复复测得到 caret2、`a（$）c$线上聊天：`、caret11；手机390无溢出，发送0，不渲染 Fox 按钮。见 `final-acceptance/22/quick-symbols-local-ui-check.json`，尚未 TEST 部署。

来源按钮的裸 `button` 选择器必须先锚定 `.symbol-panel` 再经过样式清理，否则会被平台全局按钮映射改写，丢失来源 32px、15px 与深灰配色。保留原始按钮样式，布局采用独立右对齐行置于平台四个操作钮和输入框之间，避免来源绝对定位与平台额外控件重叠。滚动按钮保留来源 36px、top100px 与响应式右距公式。

证据 `final-acceptance/21/page-controls-local-ui-check.json`：真实选区 1..2 将 abc 变为 a（）c，caret2；继续插入指令符、末端线上前缀均正确，发送0。聊天区 scrollTop1071.333/max1071（小数像素）到0，网页 scrollY0；父级重绘后草稿保留，页面390无横溢出，无作者 iframe。来源 quick buttons 实测31.992px、候选32px，背景 rgba(40,40,45,.95)、文字 rgb234一致。单测另核对节点身份和重复配置拒绝。截图为组件夹具，不是 TEST 全卡上线验收。

## 谢闽公开组件补齐（2026-10-31，本地候选）

来源 source0 为另一种 `censy-heart-elevator-v4` 爱心工具，而不是 Fox 或胶囊。`stage-mufy-xiemin-heart-navigation.ts` 只取静态模板与唯一已知 COMPONENT_ID 插值，保留 4 个原始 SVG 和样式。`pageControls.navigation=heart` 严格要求空 quickCss、禁用 Fox，有限原生控制器只滚动 `nj_chat_messages`。真实浏览器发现样式清理会移除 fixed/pointer-events，首轮因此点击未展开；已仅对已知几何补信任定位，复验 44px 触发器、right20/bottom90、滚动到1072并回0、重绘保留展开。失败和修复证据均保留，未写 TEST。

source1 是六条默认固定指令，复用现有 `MufyPrefixPanel`，不复制源站存储。`stage-mufy-xiemin-prefix.ts` 接续已修面具候选，保留全部既有字节；手机390前后缀精确拼接经无模型夹具验证，见 `prefix-local-ui-20261031.json`。

source2 的 V21 播放器原本只有隐藏 template，现增加显式 `static-music` 原生外壳：60px 原图左侧入口、75px 间距、280px 原面板，手机最大宽度收敛；首次打开才挂载唯一 opaque iframe，沙箱仍只有 allow-scripts。模板内原标记/程序原样保留，不运行外层源站持久化注入器；只补 iframe 内几何，inlineParentShim 始终指向自身隔离文档。浏览器已实际播放七首原始资源，记录可见进度/时长；暂停、进度定位、三种模式和重绘/重开保持状态已查，见 `static-music-local-ui-20261031.json`。仍不是 TEST 或整卡通过。

简行舟独立局部复验已补：连续三个快捷插入得到 `（$$线上聊天：）甲乙`、光标8，父级重绘不丢失；滚动到底1071.333/max1071并回0，390宽按钮不溢出，发送0。原站快捷键位于公开 open ShadowRoot，不能只查询主文档后误报没有按钮。进一步发现原站继承字体栈而候选继承平台字体，已在 `SourceShadow` 的角色局部根节点固定实测来源字体栈，浏览器颜色/背景/字体/字号/行高逐项一致。证据 `final-acceptance/26/local-controls-ui-20261031.json`、`source-quick-style-font-check-20261031.json`；仍未 TEST 部署。
