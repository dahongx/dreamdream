# 实际验收清单与证据

完成对象是一份本地档案一行；来源角色数、导入成功、DOM数量或单项测试不能当成整卡完成。

固定检查：identity、source-completeness、import-roundtrip、opening-mobile、opening-desktop、reply1-mobile、reply1-desktop、reply2-mobile、reply2-desktop、controls-mobile、controls-desktop、author-style-isolation、player-name、fold-lifecycle、streaming-stability、fixed-widgets、speech-avatars、media、custom-interactions。

在 opening/reply 检查中对照场景头、地点/年月日/时间/在场人物/摘要、正文、台词头像、状态栏、记忆/完成标记的原始与显示规则。折叠验初始、展开、收起、重开，统一几何；流式验标题不消失、组件不反复重挂、展开状态保留；固定组件验不同真实滚动位置和生成中。按钮验重说、面具、模型、币种的实际功能/皮肤，不用作者装饰伪造平台功能标签。名称验真实玩家及面具切换。组件按源清单逐项覆盖，不漏播放器、指令、关系页、拖拽导航、图片和视频。

源站没有某项时只能通过已采集 inventory.features 的 false 使用 not-applicable，且保留原因。折叠/fixedWidgets/speechAvatars/media/customInteractions 支持该处理；流式稳定与两条实际回复不能因未测试而写不适用。旧消息允许复用，但须绑定当前渲染版本；不要重复付费生成已有足够回复的卡。

## card-report.json

顶层：version:1、packageId、rank、sourceKey、sourceUrl、targetUrl、runtimeFingerprint、inventory、components、checks、replies、unresolved。

- inventory：真实 observedAt、每个公开组件唯一 componentIds、features。features 使用 folds/fixedWidgets/speechAvatars/media/customInteractions 布尔值。
- components：每个源组件一行 `{id,status,evidence}`，所有状态必须 passed。存在空清单不代表来源没有组件，需源完整采集证明。
- checks：固定19项每项恰好一次，`{id,status,reason,observedAt,elapsedMs,artifacts,visualReviewed}`。status 可 passed/failed/blocked/not-applicable。elapsedMs 是真实测量，不能用调度间隔或编造的1填充。
- artifacts：相对批次目录的文件 `{path,sha256,kind,side,viewport}`。kind 是 dom/screenshot/reply/report。视觉项需要来源、目标两张 PNG（side:source/target），记录 viewport.width/height；校验器核对文件头尺寸，不能拿旧画面或缩略图宣称完整视觉通过。
- 每个 passed 检查需要 dom 证据，JSON 至少包含 sourceUrl、targetUrl、roleName、bodyLoaded:true、sourceText、targetText、observedAt、runtimeFingerprint。必须来自正常公开DOM，含加载后真实角色正文，而非脚本或骨架。截图必须由 Codex 实际看过，才 visualReviewed:true。不同源/目标文案由审阅者记录原因，脚本不替代语义判断。
- replies：至少两条不同实际消息 `{id,artifact,complete:true,origin:"normal-chat-ui"}`，原始公开回复文件哈希不同。模型未按约定完整输出时保持未通过，不人工补尾标冒充实际生成。
- unresolved：具体未解决项。只要非空，不通过。

时间、加载态和截图内容最终仍靠执行者真实观察；哈希防止事后改证据，不能证明虚构报告为真。对 pending 原因须明确缺哪项行为/资源/证据；不把作者更新、年龄、排版标点直接当失败。

浏览器每个有界步骤保存后再进入下一项，避免长循环超时后丢掉已做工作。默认一次2–4条跨页交互，逐条落盘。重连后先读当前页/草稿/组件状态，禁止盲目重发、回退或重复导入。临时视口最终恢复。手动审批队列不等于验收通过。
