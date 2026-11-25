-- 角色「收藏」和「点赞」—— 用户对角色的两种轻交互。
--
-- 业务语义分离（不合一张表）:
--   收藏 (favorites)   语义偏「我会再回来看 / 想留个档」,会聚合进 /sessions
--                      的「我的收藏」tab,是用户私有的角色收纳箱;
--   点赞 (likes)       语义偏「认可这张卡片」,聚合数公开展示在角色详情页
--                      hero 上的小心形右侧,对所有访客可见。
--
-- 都是 (user_id, character_id) 唯一 —— 同一个用户对同一张卡至多收藏一次 /
-- 点赞一次。表结构与 character_comment_likes 同源,主键 = (user, character),
-- 反查角色总数走 (character_id) 索引。
--
-- 计数策略: 不在 characters 表上物化 like_count / favorite_count 字段,
-- 直接 COUNT 子查询。理由:
--   - 写路径(toggle)简单,无需 trigger / Server Action 双写;
--   - 角色详情页 hero 只渲染一次,查询便宜(index lookup + count);
--   - 列表页(/explore)目前不需要这两个数,只在详情页和 /sessions 出现;
--   - 后续真做榜单 / 排序时再补 materialized view 不晚。
--
-- 幂等: IF NOT EXISTS,可重跑。

CREATE TABLE IF NOT EXISTS "character_favorites" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "character_id" uuid NOT NULL REFERENCES "characters"("id") ON DELETE cascade,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "character_favorites_pk" PRIMARY KEY ("user_id", "character_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "character_favorites_character_idx"
  ON "character_favorites" ("character_id");
--> statement-breakpoint

-- 按用户列出收藏角色时按收藏时间倒序(最新收藏的排最前)
CREATE INDEX IF NOT EXISTS "character_favorites_user_created_idx"
  ON "character_favorites" ("user_id", "created_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "character_likes" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "character_id" uuid NOT NULL REFERENCES "characters"("id") ON DELETE cascade,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "character_likes_pk" PRIMARY KEY ("user_id", "character_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "character_likes_character_idx"
  ON "character_likes" ("character_id");
