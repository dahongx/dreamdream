# Platform Notifications Insights

> 技术交接见 [../handover/platform-notifications.md](../handover/platform-notifications.md)。

## Product Shape

通知先从“全平台公告”开始，而不是一次性做复杂的站内信系统。管理员最常见的需求是告诉所有用户：功能上线、规则说明、维护提醒。这个场景不需要收件箱归档，也不需要社交化互动；它需要的是清楚、可靠、别打扰沉浸体验。

## Read Semantics

打开铃铛和阅读单条消息分成两步：

- 黄点立即消失。
- 消息列表仍保留未读内容，避免用户只是打开弹层就丢失信息。
- 点开某条消息后才写入用户读状态，下次刷新或切换页面后不再显示这条消息。

这个语义更贴近顶部导航的小弹层：黄点不持续打扰，但真正的消息消失仍由用户逐条确认。

## Boundaries

本功能不进入聊天页消息流，不影响角色详情小剧场，也不触碰创作者自定义 CSS。平台公告属于外层产品 chrome，应该停留在 Shell / Explore hero 的铃铛入口里。

## Future

`reminder` 和 `target_user_id` 已预留，后续可以接：

- 充值或会员到期提醒。
- 创作者收益结算提醒。
- 管理员给单个用户的客服通知。

接入前应明确每类提醒的生成来源和幂等键，避免重复刷屏。
