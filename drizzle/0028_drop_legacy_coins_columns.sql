-- 删除 0024_currency_system 引入的 gold_coins / silver_coins 列。
--
-- 背景：仓库里曾经存在两套并行的货币列：
--   * users.gold_coins / silver_coins ← 0024 旧 currency 模块（已废弃）
--   * users.gold_balance / silver_balance ← 0025 现役货币系统
--
-- 聊天 / 美化包 / 图片生成都走 *_balance；*_coins 只有早期的 claimDailySilver
-- 在写（导致每日签到的银币其实没有进真正的钱包），现已统一改写 silver_balance。
-- 个人主页"货币消耗"列表已经只读 *_balance + currency_transactions。
--
-- 也就是说现在 *_coins 已经无任何读写者，直接删除。

ALTER TABLE users DROP COLUMN IF EXISTS gold_coins;
ALTER TABLE users DROP COLUMN IF EXISTS silver_coins;
