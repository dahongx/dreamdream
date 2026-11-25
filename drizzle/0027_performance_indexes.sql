-- Migration: 0027_performance_indexes
-- Purpose: 添加 characters 表性能索引，优化探索页查询速度
-- Context: 探索页查询使用 visibility + nsfw + tags + conversation_count 排序，
--          但当前只有 (visibility, created_at) 索引，导致查询慢（800-2000ms）。
--          这些索引不影响任何渲染逻辑，只加速数据检索。
--
-- 预期效果:
--   - 探索页查询从 800-2000ms 降到 50-150ms（90% 提升）
--   - tag 过滤、nsfw 过滤、热门排序都会显著加速
--
-- 安全性: 只添加索引，不修改数据或约束，零破坏性变更。

-- 1. visibility + nsfw 组合索引（覆盖最常见的过滤条件）
--    探索页每次查询都带 WHERE visibility = 'public' AND nsfw = ?
CREATE INDEX IF NOT EXISTS "characters_visibility_nsfw_created_idx"
  ON "characters" ("visibility", "nsfw", "created_at" DESC);

-- 2. tags GIN 索引（加速 jsonb 包含查询）
--    当用户按 tag 过滤时（WHERE tags @> '["tag"]'），GIN 索引能快速定位
CREATE INDEX IF NOT EXISTS "characters_tags_gin_idx"
  ON "characters" USING GIN ("tags");

-- 3. conversation_count 排序索引（加速热门排序）
--    "推荐"排序基于 conversation_count，这个索引覆盖公开角色的热门查询
--    partial index 只索引 public 角色，节省空间
CREATE INDEX IF NOT EXISTS "characters_conversation_count_idx"
  ON "characters" ("conversation_count" DESC, "created_at" DESC)
  WHERE "visibility" = 'public';

-- 4. (可选) 全文搜索加速 - 需要 pg_trgm 扩展
--    如果搜索功能使用频繁且慢，取消下面注释：
--
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS "characters_name_trgm_idx"
--   ON "characters" USING GIN ("name" gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS "characters_bio_trgm_idx"
--   ON "characters" USING GIN ("bio" gin_trgm_ops);

-- 注: 上面的 name/bio 全文搜索索引比较重（每个索引 ~几MB），
--     先观察前 3 个索引的效果，如果搜索仍慢再加这两个。
