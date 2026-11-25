# INS 三标签侧栏

产品记录：[独立侧栏不是普通内容块](../insights/mufy-ins-music-sidebar.md)。

祁述的公开原件通过 template 将音乐／指令／表情侧栏注入 Mufy 宿主。普通 iframe 导入没有显示这个原件。`stage-mufy-qishu-ins-sidebar.ts` 只解析公开 template，不执行捕获脚本。

`ins-music` 使用已有 `MufyNativeImageSidebar` 的惰性挂载与单实例生命周期。宿主外壳只保留安全 details/summary/img，原作者程序在普通 opaque `allow-scripts` iframe 内运行。精确的 `const p = window.parent` 局部别名重绑为自身 window；其余父引用残留会使候选生成失败。原写入函数仅改为 `window.host.fillComposer`，不调用发送、不查历史、不访问真实宿主 DOM。

保留六首歌、20个指令标签、表情原数据和样式；未知内容不以替代资源遮掩。作者程序中的原始复制交互统一落到聊天草稿，必须由用户确认发送。

来源宿主实测 box-sizing:border-box。隔离画布补齐此默认值后为260×380，折叠入口70×70，固定右侧20vh。关闭不销毁画布，回复父更新保留原标签和播放状态。原图外链不可用的记录仍保留，不能因侧栏可用就写成媒体全通过。

回归覆盖信封拒绝错误外壳／空文档、单实例保留、sandbox 不扩大。公开 UI 已实测三标签、原列表、切歌、循环、表情草稿、父重绘和手机尺寸。候选尚未保存测试服，等待整批发布门槛。
