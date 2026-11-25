# 产品/设计思考:为什么这样接 Supabase Auth

> 技术细节见 [../handover/supabase-auth.md](../handover/supabase-auth.md)。决策对比见 [../research/supabase-auth-integration-report.md](../research/supabase-auth-integration-report.md)。

## 为什么换 Supabase Auth

- 原 Auth.js v5 还是 beta(`^5.0.0-beta.31`),API 不稳定;且只有自管的用户名+密码,后续要加 OAuth / 邮箱找回 / magic-link 都得自己造。
- Supabase 提供托管的账号体系(注册/登录/找回/OAuth/MFA),以及与 Postgres 同库的 `auth.uid()` + RLS 能力,长期省事。

## 为什么选「桥接到现有 users」而不是新建 profiles

产品上 yearn-chat 是**单用户拥有角色卡**的简单模型,不需要 MakerKit 那种多租户 `accounts`/团队账号。把 `auth.users` 直接镜像到现有 `users` 表,改动最小、风险最低,创作者数据(角色卡/会话/评论)归属关系一行不动。代价是 `users` 表留了几个 Auth.js 时代的冗余字段,属于可接受的技术债。

## 为什么登录身份从「用户名」改「邮箱」

Supabase Auth 以 email/phone 为主键身份,不支持纯用户名登录。改 email 登录最干净,也为「忘记密码自助找回」铺路(用户名做不到)。用户名保留为展示用 `@handle`(落在 `users.username`,仍唯一)。

## 刻意没做的

- **内容审核**:平台核心立场是零审核,认证改造不引入任何内容检测。
- **RLS 兜底后端**:后端超级用户直连本就绕过 RLS,没有制造「上了 Supabase 就自动安全」的错觉 —— 越权防护仍靠应用层 79 处 owner 过滤,这一事实在交接文档里如实写明。
- **强制邮箱验证**:本地关确认以降低体验摩擦;是否在生产开启留给产品决策。
