# 测试服管理员专用模式

测试服可通过 `TEST_SERVER_ADMIN_ONLY=true` 关闭匿名访问，并用
`TEST_SERVER_ADMIN_EMAILS`（逗号分隔、忽略大小写）限定可进入平台的账号。
生产环境不设置这两个变量，原有公开访问逻辑不变。

完整关闭测试服需要同时满足三层：

1. 应用门禁：匿名请求及不在管理员白名单内的登录态重定向至 `/signin`。
2. Auth 注册：`DISABLE_SIGNUP=true`，GoTrue 拒绝新注册。
3. 存量账号：测试库 `auth.users.banned_until` 冻结非管理员，并清理其
   `auth.sessions` 与 `auth.refresh_tokens`；不删除账号或业务数据。

2026-08-24 已在 `115.29.213.73` 启用。服务端回滚材料位于
`/root/projects/yearn-chat/.codex-backups/admin-only-20260824/`，包括修改前
`.env`、账号冻结前 CSV 和源代码补丁。

产品取舍见 [测试服访问边界](../insights/test-server-admin-only.md)。
