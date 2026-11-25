-- 开场组件：逐条开关 + 角色槽位填充。
--
-- 背景：开场组件原本只有「整包一键全开」(character_pack_subscriptions.opening_enabled
-- 一个总开关)，而对话组件(regex_rules)是逐条开关。本迁移让开场组件对齐对话组件——
-- 每条单独开关，并支持「角色槽位填充」：创作者在 studio 组件内容里用 {{xxx}} 挖空位，
-- 每个角色在自己的编辑页各自手填这些空(运行时静态替换，不调 AI)。
--
-- 两张表：
--   opening_component_overrides  —— 镜像 subscription_rule_overrides：某角色(订阅)关掉
--     了某个开场组件。无记录 = 开启(随包总闸)，disabled=true = 关。
--   character_opening_slot_values —— 每(角色, 开场组件, 槽位名) 一条手填值。按 character
--     而非 subscription，切换订阅不丢已填值。
--
-- 幂等：IF NOT EXISTS，可在已部署库安全重跑(服务器 migrate 容器会跳过新迁移，需手动 apply)。

CREATE TABLE IF NOT EXISTS "opening_component_overrides" (
  "subscription_id" uuid NOT NULL REFERENCES "character_pack_subscriptions"("id") ON DELETE cascade,
  "opening_component_id" uuid NOT NULL REFERENCES "opening_components"("id") ON DELETE cascade,
  "disabled" boolean NOT NULL,
  CONSTRAINT "opening_component_overrides_pk" PRIMARY KEY ("subscription_id", "opening_component_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "character_opening_slot_values" (
  "character_id" uuid NOT NULL REFERENCES "characters"("id") ON DELETE cascade,
  "opening_component_id" uuid NOT NULL REFERENCES "opening_components"("id") ON DELETE cascade,
  "slot_key" varchar(128) NOT NULL,
  "slot_value" text NOT NULL,
  CONSTRAINT "character_opening_slot_values_pk" PRIMARY KEY ("character_id", "opening_component_id", "slot_key")
);
