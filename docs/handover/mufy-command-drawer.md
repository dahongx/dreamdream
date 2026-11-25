# 公开指令侧栏原生迁移

产品取舍见 [insights](../insights/mufy-command-drawer.md)。当前仅本地候选，未构建、未部署、未写入测试服角色。

`stage-mufy-fusiyan-command-drawer.ts` 从傅司晏公开组件提取静态 HTML/CSS 与 `defaultCmds` 的十条字面量。不执行作者程序，不读取来源存储，也不迁移来源用户新增的私人指令。候选追加惰性 `command-drawer` 配置；写入前仍须正常 owner UI 验证最新基线。

`MufyCommandDrawer` 使用 ShadowRoot 原生控件，无作者 iframe/脚本、无发送回调、无聊天上下文 API。选择指令只调用填草稿回调并收起。自定义条目仅存本平台角色范围内 `nj_mufy_commands_...`，限制 50 条、标题 200 字、单条 40000 字、总量 250000 字符；删除可撤销，容量不足不会强行恢复超限条目。父重绘保持 DOM 和编辑文本，切角色重新读取各自本地偏好。

## 视觉与交互契约

保留来源 CSS 与实际继承的 16px/1.5 行高。标题必须保留 `.cen-cmd-title` 的 12px、`--cen-ins-text`，不能用通用按钮 font/color shorthand 冲掉。来源 `:root` 变量映射到隔离容器后需让作用域选择器命中真实后代。已知固定定位和 pointer-events 由原生控件恢复，不能因此放宽任意作者 CSS/JS。保留来源实际 `.95` 变换，而非未经实测恢复理想化变换。

证据：`final-acceptance/21/command-drawer-local-ui-check.json` 记录十条草稿逐条相等、发送 0、CRUD/撤销/刷新/键盘/外部收起；手机 390px 页面无横溢出，面板宽 266px、原始 CSS 宽 280px，锚点 30%，触发器 CSS 宽 28px。鼠标 hover 使触发器视觉放大至 30.8px，不误称基础尺寸改变。首轮点击中间帧和修复前定位/低对比截图结果均保留。单测额外验证节点身份、重绘、角色隔离、无脚本/iframe。

来源评论区重写脚本不复制到本平台无对应的评论区。独立回顶/到底控件仍待适配，不能据此宣布傅司晏全卡完成。
