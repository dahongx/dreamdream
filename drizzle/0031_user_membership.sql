-- 会员等级 + 到期日
--
-- 商城页（/shop）使用，记录用户当前订阅了哪一档月卡及到期时间。
--
-- 半结构化方案：tier 三档枚举字符串 + expires_at 时间戳。
--   - 未购买 / 已过期 → tier = NULL，expires_at = NULL（应用层把过期当未订阅处理）
--   - 已购买（in trial period 内）→ tier 三选一，expires_at = 到期时间（UTC）
--
-- 升级 / 续费策略：直接覆写 tier + expires_at（不保留历史），需要审计就走
-- currency_transactions（后续可加 transaction_type='membership_purchase'）。
-- v1 没有自动续费，到期后字段不清零，应用层用 expires_at < now() 判活。
--
-- tier 三档：gold / platinum / diamond，对应黄金 / 铂金 / 钻石。

ALTER TABLE users
  ADD COLUMN membership_tier TEXT,
  ADD COLUMN membership_expires_at TIMESTAMP WITH TIME ZONE;
