-- 角色卡新增「作者的话」（creator_note）。
--
-- 创作者对玩家说的话（外部角色卡的「作者的话」板块，给玩家看的展示文字，
-- 不进 LLM prompt）。外部导入时接住这段；编辑页可填；详情页展示。
-- 可空（老角色没有）。属访客可见字段（见 CLAUDE.md 白名单）。
--
-- 幂等：IF NOT EXISTS，可在已部署库安全重跑（服务器 migrate 容器会跳过新迁移，
-- 须手动核对建列）。

ALTER TABLE "characters"
  ADD COLUMN IF NOT EXISTS "creator_note" text;
