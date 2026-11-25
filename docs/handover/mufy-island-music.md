# 顶部动态音乐浮窗

产品取舍见 [insights](../insights/mufy-island-music.md)。仅本地候选，未写入 TEST、未构建发布。

`stage-mufy-jiangzhi-island-music.ts` 仅解析江峙 source2 的公开 template、CSS 与 TypeScript AST 字符串歌单，不执行原站 parent 注入、旧播放器停止、存储模板或轮询程序。保留 6 首原曲与艺人，5 个 music.163.com 的 http 地址仅升级同主机 https，未替换资源。候选在当前快捷符号与 profile clip 基线后追加，owner UI 写入前仍须新基线核对。

`MufyCloudMusic` 按严格 `cloudMusic.layout='island'` 选择独立实现，不改既有 Cloud 外观与生命周期。使用隔离 ShadowRoot + DOMPurify 惰性壳 + 清理后来源 CSS，固定 top65、收起140×35、展开320×340，手机留24px边界。原站直接父页面访问、作者脚本、原站存储均不开放。偏好只访问本平台 `nj_mufy_island_<characterId>_<id>` 的 index/mode，加载时不自动播放。

播放状态以 native playing/pause/error 和 play Promise 为准，不能把 play 事件或 paused=false 当作资源已解码。取消加载、切歌、卸载都递增请求序号，旧 Promise 不能恢复旧播放状态；结束后按列表/单曲/随机模式切换。关闭不停止音乐，父级重绘不重新创建 audio。Esc/外部点击收起，关闭面板 inert，隐藏 mini 不留键盘焦点。

证据 `final-acceptance/22/music-island-local-ui-check.json`：来源320×340/65px、三种模式顺序一致；本地首曲真实33.459→33.822秒跨父级重绘，第二曲ready4/time8.022，第三曲ready4/time0.046，末曲ready4/time17.49。最终 playing 事件版本补验第四曲ready4/time16.178、第五曲ready4/time18.708。六首均至少取得一次实际进度，但没有声称整段完整播放。手机390、面板320/x35、页面无横溢出；刷新保留眼底雾/列表循环、paused=true、time0、收起140×35。早期串联点击未落定的记录保留。截图为本地夹具，不是 TEST 全卡验收。

## 2026-10-31：沈砚 V4 三模块（未发布）

公开来源具有三页而非纯播放器：5 曲、6 组关系全文、26 条可填入指令。`stage-mufy-shenyan-multimodule-island.ts` 用惰性 DOM 与 TypeScript AST 仅取原壳/CSS/字符串数据；不执行作者程序，不读来源存储。严格 `multiModule.kind='v4'` 附加配置复用已有岛播放器，V3/Classic 仍走原分支。

实际浏览器暴露两处边界：通用 CSS 安全过滤去掉了泛类 `display:none`，使三页挤成每页约96px；有限控制器现明确设置非当前模块 display:none/inert，不放松全站过滤。源根行高24px在该 V4 中恢复，指令区由91.7px回到282px（来源281.5px，缩放亚像素差）。另一处是宿主 `onFillComposer` 为追加语义，不可传入计算好的整份草稿。单独 `onReplaceComposer={setInput}` 从 ChatRoom→FloatingSlot→FloatingWidgets 传递，保留原追加接口。光标恢复通过本组件状态提交后的 layout effect，且值仍等于预期时才恢复，取消旧 RAF，避免后续用户选择被延迟覆盖。

26 条在真实受控 textarea 中通过先选中旧草稿再点可见标题全部替换正确，光标到末尾，发送0；关系全文精确一致。即时 DOM 读数偶尔落在 React 提交前，失败样本保留，最终每条先取得实际渲染帧再读取。原型布局失败、早期复制尝试均留档，不混入最终通过数。运行补丁仍未在 TEST 构建/发布；整卡验收仍未完成。其余媒体、手机及刷新结果以 `final-acceptance/43/multimodule-island-*-20261031.*` 最终记录为准。
