# 公开全屏动效适配（本地候选，未发布）

产品边界见[设计说明](../insights/mufy-fullscreen-story.md)。

`fullscreen-story.ts` 的惰性 JSON template 只接受已观察的 Censy V19 程序签名与有限长度，拒绝嵌套 iframe、旧平台桥和用户占位插值。`OpeningSlot` 显式路由到 `MufyFullscreenStory`。原入口处于原文流；点击后 React portal 提供全视口不透明 `allow-scripts` iframe，原程序的 parent 别名指向自身，不获得真实父页面或 Host RPC。原图、原定时与六次点击顺序保留。

关闭消息必须来自该 iframe 的 contentWindow；原 stage 删除或 Escape 退出，卸载画布后恢复入口焦点。srcdoc 缓存、稳定节点身份及错误来源消息拒绝由 React 生命周期回归覆盖。当前只适配已观察程序，不是任意父文档脚本执行权限。

2026-10-29：来源桌面、本地桌面与 390×844 手机三幕和自然退出已实际检查，重开、Escape、退出后输入正常，发送数 0。追加本地 fixture 延时重绘按钮，实际打开动效后父级更新 1 次，仍有 1 个画布、弹层保持、后续点击显示第一人物；该浏览器检查不单独证明节点身份，稳定节点身份由 React 单测覆盖。未宣称来源手机像素对齐。证据 `logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/43/local-fullscreen-story-ui-check.json`。

定向回归 200 项 / 857 断言与目标类型检查通过。运行补丁 12 文件已按实际 TEST 精确基线本地应用核验；仍无 TEST 构建、发布或候选保存。上线后还须真实卡片验收，不得把本地组件结果当整卡通过。

## 2026-10-31：沈砚其他遗漏文档（未发布）

新公开逐块核对发现 source3“做了关于天使的夢”分隔字景以及 source8 被动装饰图均完全未进 TEST。`stage-mufy-shenyan-missing-divider.ts` 从现有 full-screen 候选继续，分隔字景插在 source2 后、作者折叠4 前，被动图放在全屏入口6 后；删除这两段增量即严格还原上一候选，其他 owner 字节不变。source7 是另一全视口浮窗，由独立有限三模块适配器承接，不把它伪作空助手。

分隔字景实际文字、13 个后代元素的字体/字号/颜色/动画名称与原站相等，高40px；自然动效结束可见。原图 `696890fcc4f15.png` 双侧解码为5567×2013，原滤镜、105%宽和 gentle-pulse 动效保留。第一次纯 fixed 文档被平台 html/body 重要规则压成1px，已保留失败记录，改用实测100px的非交互画布承载，实际 iframe/body 均100px，不更改全站高度规则。两者仍为本地候选，不是 TEST 已修复；证据位于本批43目录。

## 2026-10-31：江之余 V9 人物档案（未发布）

真实 TEST 点验确认来源索引 1 不只是人物图：原站点击 `Mm_anchor_v9` 向整页打开 `Tuan_cover_v9`，TEST 却在 640×380 里打开且原关闭回调无效。新增有限 `censy-profile-v9` 变体，严格检查原函数/关闭签名、受限惰性入口、静态继承参数与大小限制；不是任意全屏代码许可。入口只保留净化过的 div/span/class，原程序仍只在 `allow-scripts` 不透明全视口 iframe 内运行。旧 V19 路径保持。

候选从 rank46 已核验的前缀→Cloud Music 链继续；公开模板、入口与 CSS 必须和当前 owner 字节一致，替换可逆，其他字节不变。源弹层在父页面继承 STSong/SimSun/Noto Serif、深红前景、1.8 行高、border-box 和 thin 滚动条；直接复用小框文档会留下汇文明朝/白字/content-box。只在这一弹层根与内滚动区补回测得样式，不改变全站或作者其他组件。

桌面正文与六组实际样式匹配，原关闭/重开/真实父级重绘/Escape 已操作；源码重绘节点身份另由单测证明。实际 CSS390 下双方均全视口，原站和候选都滚到末条胡大娘资料。高层页滚动未命中内框的尝试保留，随后使用正常 Chrome wheel 事件验证；未用 JS 改滚动位置。不同浏览器缩放下滚动条占位有像素差，不称逐像素相等。来源 emulation 下关闭指针未确认，已恢复桌面关闭；本地手机关闭已确认。所有临时视口恢复，未称物理手机触摸通过。证据在本批 `final-acceptance/46/fullscreen-profile-*-20261031.*`；候选尚未写 owner/发布到 TEST。
