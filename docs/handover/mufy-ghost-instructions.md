# 静态侧边指令窗

产品记录：[保留作者侧栏的打开方式](../insights/mufy-ghost-instructions.md)。

唐志泽的公开侧栏只有 HTML 与焦点 CSS，没有发送、复制或历史查询功能。旧迁移桥接把它放进普通 iframe，并依赖历史查询显示，导致页面边缘入口不可见。

`ghost-focus-left` 显式信封允许零脚本文档。`MufyGhostInstructions` 在独立 ShadowRoot 中渲染经过清洗的静态列表，沿用公开样式、135px 面板、18×36px 入口与原始列表默认值。React 持有开合状态，父组件更新不重建。仅面板与入口接收指针，关闭后的宿主为18×36px，不设置遮罩。外部点击或焦点关闭，不阻止输入框首击；Escape 关闭。

候选脚本只替换已校验的终端旧侧栏与历史桥接，其他开场字符完整保留。候选尚未保存到测试服，须待整批发布门槛达成后使用新运行时。

回归：`ghost-instructions-lifecycle.test.tsx`；本地生产路由预览使用 `serve-mufy-native-sidebar-preview.ts --ghost-instructions`，不是测试服构建。
