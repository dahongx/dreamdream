# 8093 加载状态与显示巡检修复

刷新/跳转出现旧开场文案的根因，是正常页和共享加载页各自维护标题。现共用 ExploreStoryOpening 与四语 story-copy，覆盖根级和 explore 段级两个 loading 入口，并统一加载占位页的视觉范围和大图骨架。

同时修复最近会话/收藏失效头像兜底，以及对话预览暴露 style/代码片段。仅改 8093 隔离目录；没有改聊天原文或数据库。

回归测试与各页面截图见 [验收记录](../../outputs/reskin-8093-loading-fix-20261112/README.md)。回退镜像 yearn-reskin-app:before-loading-fix-20261112。

[产品思考](../insights/reskin-loading-consistency-20261112.md)

最终部署镜像 159f6004b645，完整构建及客户端清单验证通过。根加载/段级加载/正式页四语标题一致，SSR、刷新、站内跳转验证通过。真实失效头像含首次刷新场景复验通过；代码预览残留清零。图片组件增加 hydration 后缓存失败检查，失败状态按 src 记录。验收截图与 audit-results.json 见输出目录。
