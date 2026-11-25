# Mufy 虚拟草稿桥接的增量语义

产品取舍见 [insights](../insights/mufy-draft-relay.md)。当前修复仅在本地验证和待发布补丁中，TEST 尚未部署。

## 复现与根因

江峙公开 Fox 小手机的 `sendToUI` 会先读取虚拟输入框原值，再追加本次指令。平台 `DRAFT_RELAY` 过去将虚拟框全文交给追加型 `onHostFillComposer`，但不清空虚拟框。第一次看似正常；连续点击或清空主框后再点，旧虚拟全文被重复追加。真实 TEST 失败记录保留在 `final-acceptance/22/profile-phone-controls-check.json`，不能把第一次能填入当完整验收。

## 通用修复

`mufy-source-rule-envelope.ts` 的专用隐藏 relay 收到 input 时先取本次值、同步清空自身，再转发一次。空事件不转发；同步异常/异步拒绝保留明确错误标记，不自动重放旧内容。不操作作者其他 textarea，不放开真实父文档、发送、上下文、凭据或沙箱权限。源作者程序无需改写，也无需每张卡重写渲染规则。

公开 DOM 快照另有 `.fox-phone-wrapper.initialized` 残留，会令序列化后重放跳过事件绑定。CLI `normalizePublicFrameReplay` 仅在已识别完整 Fox 手机程序签名下重置该标记，其他同名 initialized 类保持不变。此项为后续迁移 agent 的重放补齐，不是修改来源存储。

## 验证

`phone-draft-relay-local-ui-check.json` 使用原始公开手机、真实不透明 iframe 和与平台一致的追加回调：六项指令累计长度 5/28/45/62/78/109，全相等；清空主框后再次点击只得到“发送消息：”，发送0。原先初始化跳过的无效尝试也保留。手机610px画布约342.67px宽，页面无横向溢出。整页截图服务超时后保存视口截图，不归因为 Mufy 被封。

测试还执行**平台自己的 relay 脚本**模拟同步连续动作、主框清空、空事件、失败反馈及普通 textarea 不受影响；不在 shell 执行捕获的作者代码。旧宠物测试对全文转发实现的断言已更新为增量清空契约。

部署包必须包含 ChatRoom 集成与 source-rule-envelope。精确 TEST 基线补丁仅替换后者的 relay，保留 TEST 原模块导入/导出；ChatRoom 保留 TEST 现有的三处模型状态刷新通知，不带入本地无关删除。`typecheck-mufy-consolidated-patch.ts` 在编译器内覆盖精确补丁文件，并只读使用 TEST 已有事件模块依赖，不改变工作树或发布。
