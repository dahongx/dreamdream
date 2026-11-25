# 主页原C构图对照 — 2026-11-12

用户最新澄清：主旨是主页整体构图，并主动提到最近对话小横条。以此为主页内的明确增补范围：保留搜索、筛选、大图和既有路由；在hero与现有导航之间增加最多3条真实最近会话。原C的桌面图文列表仍由用户指定大图覆盖。

ExploreRecentChats是服务器组件，仅收到服务器已认证viewerId；复用listRecentSessionsForUser(userId)，过滤不可访问、已删除角色，去重，最多3条。内容开关关闭时，额外仅允许nsfw=false。无用户/无有效会话返回null，不造样例。复用现有本地化、previewSnippet、图片fallback和聊天URL。私有摘要不传入新的客户端数据接口，页面force-dynamic保持。

首页搜索/正向标签/创作者视图下不加入最近区，既有探索行为保留。只有默认角色发现视图增加横条，手机可横滑，桌面3列。

本轮文件：远端explore/page快照补丁、新组件、home.css。未覆盖根脏工作树或其他功能源码。备份backups/home-before-20261112.tsx/.css，镜像before-home-composition-20261112。构建/tmp/reskin-home-20261112.log。

截图before-desktop.png来自本轮部署前真实主页；待补原图与上线后截图同板对照。

## 发布与结果

最终镜像de1171d42e4f8365e3a3791966516c6ffbe1c93c772f0f34f9f400f0d9d48921，容器running，完整构建/TypeScript/manifests通过。实际IAB当前用户出现3条真实最近会话，第一条点击进入对应已有/chat/<id>，没有发送模型消息。390横条clientWidth362/scrollWidth885，内部可滚动、页面无横向溢出；320与1440同样无溢出。匿名HTTP200，HTML最近卡片数0。未更改其他页面业务。

截图before-desktop/after-desktop/after-mobile；原图桌面裁切与实际1440主页合成original-c-vs-current.jpg，before-vs-after.jpg。保留原始像素尺寸并标注尺度，没有伪造会话或图片。视口已恢复。

与原图仍有明确差异：用户指定保留的大图卡代替原C横向图文列表；既有角色/创作者tab、页内搜索与过滤比原图更多，仍保留。这份验收不宣称像素级复刻，也不包含真实支付、模型消耗或物理手机触摸测试。
