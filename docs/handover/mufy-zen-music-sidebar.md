# Zen 音乐与指令浮窗

产品记录：[保留原浮窗，不带入父页权限](../insights/mufy-zen-music-sidebar.md)。

宋锦琛来源公开 DOM 的 `censy-permanent-ins-container` 在 TEST 没有对应浮窗入口。`stage-mufy-songjinchen-zen-music.ts` 惰性解析公开文档，完全丢弃 storage/payload/父文档注入引导，只提取已验证 V13 程序中 playlist 至 copyText 前的自包含音乐和头像控制，重绑到自身不透明 iframe。六首原歌曲、十个头像、六个指令保留。指令原文 JSON 字符串编码，修复其中两项字面换行导致的无效单引号 JS 字符串；复制仅通过 Host API 填草稿。

`zen-music` 显式信封：ShadowRoot 中只保留无脚本触发器、关闭入口及文档挂载点；作者程序留在 `allow-scripts` iframe，无父页访问、storage 或剪贴板读取。React 接管原生 details 开合；首次打开才加载，关闭和父级更新不销毁子实例。键盘 Enter/Space 和指针都可关闭。不开放嵌套 iframe，不扩大播放器沙箱。

原始 340px 面板缩放至85%，可见宽289px、46px固定侧边入口；源站 unitless 1.5 行高与 SVG block reset 显式恢复，避免继承平台色调与行高。手机最大面板高度采用原80vh×85%=68dvh，仅外层滚动。来源收起347.581px，本地347.344px，亚像素误差保留；不声称完整像素一致。

平台旧音频 src setter 会自动播放，因此初始挂载不重复赋值已经捕获的首曲地址，只渲染列表。真实浏览器最终候选初始暂停；同程序播放从0推进至17秒以上，随后暂停。六项指令文本逐项精确匹配，发送0；十个头像选择已逐项测试，首项初次定位未成功后已补验。父级更新、关闭重开保留状态，React单测另核对 iframe 节点身份，不能把浏览器 frameCount 1 说成节点身份验证。

候选与证据在 `next-batch-30-20261028/rule-repairs/38/native-zen-music` 和 `final-acceptance/38/zen-sidebar-local-ui-check.json`。未写入 TEST，整卡未通过；来源另一个固定前缀组件（source8）仅存公开源文件，尚未适配，禁止读取其 storage 草稿或运行父页发送拦截。原图床资源缺失不擅自替换。
