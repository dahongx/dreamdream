# 来源查找导航胶囊

产品取舍见 [insights](../insights/mufy-capsule-navigation.md)。江峙 source1 的公开静态 template、16 条行内样式转换为独立 class，只迁移展示壳。原站整页扫描、父页面注入、全局搜索对象和存储模板均不执行。

`pageControls.navigation='capsule'` 仅在 `scrollButtons=false` 时合法；与该角色 V7 符号共用一份唯一 page-controls 配置，不能重复追加导致唯一性检查失效。`stage-mufy-jiangzhi-capsule.ts` 在已拼入顶部音乐的候选内精确替换快捷配置，反向替换还原基线，其他字符保留。仍需 owner UI 新基线核对后才写入。

原生实现只查询 `nj_chat_messages` 内 `.nj_ai_message_bubble/.nj_user_message_bubble/p[dir=auto]`，跳过气泡内重复段落与显式 hidden/aria-hidden 内容，不跨不透明 iframe、存储或网络读取。每条匹配节点只算一次，滚动只操作聊天容器。跳转数字在 change/blur/Enter 提交并夹在有效范围，已删除结果先移除。高亮保留旧 box-shadow，仅当仍是本组件写入值才恢复；关闭/卸载清理高亮计时器与全部监听。

来源固定胶囊25×86、right1/top50%/translateY70%，面板260px，保留拖动条并限制在视口内。普通指针捕获支持拖动，Esc/外部点击关闭，关闭后面板 inert。ShadowRoot 内复制来源 ui-sans-serif/16px/1.5 继承及按钮、输入零内边距和 SVG block/middle 重置；否则图标被 UA padding 压成8px，面板多出约11px。SVG尺寸白名单保留14/12/14、16、18/18。

实测证据 `final-acceptance/22/capsule-local-ui-check.json`：手机390，面板260×155.333，来源260×156.159（不同页面缩放的亚像素边框差）；三条合成公开消息匹配3，不重复算嵌套段落，99夹到3、上一处2、失焦跳1、无结果0且不篡改查询。普通鼠标拖动后x122/y86.333保持视口内，回底1071.333/max1071后回顶0。父重绘后查询保留，发送0。仅本地夹具，未 TEST 部署，不等于整卡通过。

保留一次单测失败：最初断言任何style属性都不许存在，却命中控制器自己写入的display:none；修正为禁止作者 script/iframe/onclick，并单独验证可信display:none与inert。随后定向3测试/40断言通过。原始超大DOM调试输出不作为账号或站点故障证据。
