-- users 新增 bio 字段 —— 用户在「个人主页」展示的一句简介。
--
-- 谁能看:
--   - 设置页 /settings: owner 自己编辑
--   - 个人主页 /me: owner 自己浏览（v1 没有 /u/:id 公开主页路由,先只服务自己）
--
-- 为什么独立加列(不复用 characters.bio):
--   characters.bio 是角色卡的访客可见描述(白名单字段,见 CLAUDE.md);
--   users.bio 是用户本人的自介,语义完全无关,不能混用。
--
-- 与 displayName / username 的区别:
--   displayName 是 LLM prompt 里 {{user}} 的填充值,语义敏感;
--   username 是 @handle 展示名;
--   bio 是纯展示自介,不进任何 prompt,不参与登录/索引。
--
-- 可空:老用户没有自介,允许 NULL,UI 端给空状态提示。
-- 不加长度上限到列约束,留给 application 层 Zod(暂订 280 字符,推特长度感觉)。
--
-- 幂等: IF NOT EXISTS,可重跑。

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "bio" text;
