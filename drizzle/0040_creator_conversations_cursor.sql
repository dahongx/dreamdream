-- 创作收益总览「新增 ▲」增量展示 —— 给对话维度补结算游标。
--
-- 背景：收益总览四格（对话/收藏/点赞/粉丝）对齐同类平台，除总数外要显示「自上次
-- 早 8 点结算以来的净增」（绿色 ▲），让创作者直观感到「今天涨了多少」。
--
-- 点赞/收藏/粉丝的结算快照已有（likes_settled / favorites_settled / fans_settled），
-- 增量 = 当前累计 − 快照。唯独对话数没有对应快照：现有 last_gold_consumed 存的是
-- 「金币消耗」不是「对话条数」。这里补一列 conversations_settled 存对话条数快照。
--
-- 注意：conversations_settled 只用于增量展示的基线，不参与返利发钱（对话返利仍按
-- 金币消耗算）。每次结算把它推进到当前 conversation_count。非破坏性。

ALTER TABLE "creator_character_cursors"
  ADD COLUMN IF NOT EXISTS "conversations_settled" integer DEFAULT 0 NOT NULL;
