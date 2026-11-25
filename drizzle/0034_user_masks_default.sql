-- Migration: 0034_user_masks_default
-- 给 user_masks 加 is_default 列,支持「默认面具」功能:用户可设置一个面具为默认,
-- 新会话自动绑它,换角色不用再手动选面具。
--
-- 约束:每用户至多一个 is_default=true 的面具(由应用层保证,不用 partial unique)。
-- 非破坏:已有面具默认 false,不影响现有数据。

ALTER TABLE user_masks ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN user_masks.is_default IS '是否为该用户的默认面具(新会话自动绑定)。每用户至多一个 true,由应用层 setDefaultMask 保证互斥。';
