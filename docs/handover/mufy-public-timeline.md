# 谢闽履历时间轴（本地候选）

产品取舍见 [insights](../insights/mufy-public-timeline.md)。未保存 TEST、未构建发布。

原站 source5 的四段履历和全屏弹层在当前 TEST 完全缺失。`stage-mufy-xiemin-timeline.ts` 仅用惰性 DOM、TypeScript 字面量 AST 和真实公开弹层 DOM 提取：保留原曲线、节点坐标、四个标题和全文、内层行内样式，插回 source6 前；逆向删除新增包必须恢复完整 owner 基线。候选链在 native-heart-navigation 后追加，不覆盖原字段。

`censy-timeline-v10` 严格有限配置经过 OpeningSlot 的既有全屏路由交给 `MufyPublicTimeline`，不执行作者脚本、不创建 iframe、不开放父页面或草稿 RPC。原站 500ms 后起、各节点相隔400ms 的顺序保留；事件和计时器卸载清理。原始样式经过既有 CSS 过滤，弹层正文 DOMPurify，仅惰性文本标签；配置拒绝事件、脚本、嵌套网页、URL 样式和 CSS 转义。

真实桌面四段全文逐字一致，原字体/节点颜色/字号/220px 高度/路径终态一致，关闭、再开、父级重绘已实际检查。第一版回归抓到重绘重写 HTML 导致关闭监听丢失，现使用稳定 markup 对象修复。390手机实测再发现 body 滚动条造成弹层留缝，已明确100vw/100dvh，四段全文和390×844全视口复验通过；是桌面 Chrome 手机尺寸模拟，不声称真实触屏。证据 `final-acceptance/41/timeline-*-20261031.json`。不能视为 TEST 整卡完成。
