-- 分析某个角色的 AI 输出 pattern 统计
--
-- 用法：默认分析谢寻；改下面 WHERE name = ... 换别的角色。
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < scripts/analyze-character-output.sql

\set character_name '谢寻'

\echo
\echo '================================================================'
\echo 'Step 1: 基础统计'
\echo '================================================================'

WITH target_char AS (
  SELECT id, name FROM characters WHERE name = :'character_name' LIMIT 1
),
target_sessions AS (
  SELECT cs.id
  FROM chat_sessions cs
  INNER JOIN target_char c ON cs.character_id = c.id
),
ai_msgs AS (
  SELECT m.id, m.created_at, m.content, m.role
  FROM messages m
  INNER JOIN target_sessions s ON m.session_id = s.id
  WHERE m.role = 'assistant'
    AND m.superseded_at IS NULL
)
SELECT
  (SELECT name FROM target_char) AS character_name,
  (SELECT COUNT(*) FROM target_sessions) AS session_count,
  COUNT(*) AS ai_message_count,
  AVG(LENGTH(content))::int AS avg_content_chars,
  MAX(LENGTH(content)) AS max_content_chars
FROM ai_msgs;

\echo
\echo '================================================================'
\echo 'Step 2: pattern 计数（消息级 —— 含某 pattern 的消息数）'
\echo '================================================================'

WITH target_char AS (
  SELECT id FROM characters WHERE name = :'character_name' LIMIT 1
),
ai_msgs AS (
  SELECT m.content
  FROM messages m
  INNER JOIN chat_sessions cs ON m.session_id = cs.id
  WHERE cs.character_id = (SELECT id FROM target_char)
    AND m.role = 'assistant'
    AND m.superseded_at IS NULL
)
SELECT
  COUNT(*) AS total_msgs,
  COUNT(*) FILTER (WHERE content ~ '<details') AS has_details,
  COUNT(*) FILTER (WHERE content ~ '<summary') AS has_summary,
  COUNT(*) FILTER (WHERE content ~ '<[A-Z][A-Za-z]+Chat') AS has_chat_widget,
  COUNT(*) FILTER (WHERE content ~ '<message') AS has_message_tag,
  COUNT(*) FILTER (WHERE content ~ '<narration') AS has_narration_tag,
  COUNT(*) FILTER (WHERE content ~ '<system') AS has_system_tag,
  COUNT(*) FILTER (WHERE content ~ '<think') AS has_think_tag,
  COUNT(*) FILTER (WHERE content ~ '\d+(\.\d+)?%') AS has_percent,
  COUNT(*) FILTER (WHERE content ~ '\(\+\d') AS has_delta_up,
  COUNT(*) FILTER (WHERE content ~ '\(-\d') AS has_delta_down,
  COUNT(*) FILTER (WHERE content ~ '\[[^]\n]{1,8}\]') AS has_brackets,
  COUNT(*) FILTER (WHERE content ~ '\*\*[^*]+\*\*') AS has_bold_markdown
FROM ai_msgs;

\echo
\echo '================================================================'
\echo 'Step 3: 高频 marker 字符串 —— 章节头 / 字段名（人工查找）'
\echo '================================================================'

WITH target_char AS (
  SELECT id FROM characters WHERE name = :'character_name' LIMIT 1
),
ai_msgs AS (
  SELECT m.content
  FROM messages m
  INNER JOIN chat_sessions cs ON m.session_id = cs.id
  WHERE cs.character_id = (SELECT id FROM target_char)
    AND m.role = 'assistant'
    AND m.superseded_at IS NULL
)
SELECT
  COUNT(*) FILTER (WHERE content ~ '关系系数') AS 关系系数,
  COUNT(*) FILTER (WHERE content ~ '好感度') AS 好感度,
  COUNT(*) FILTER (WHERE content ~ '仇恨值') AS 仇恨值,
  COUNT(*) FILTER (WHERE content ~ '亲密度') AS 亲密度,
  COUNT(*) FILTER (WHERE content ~ '依赖度') AS 依赖度,
  COUNT(*) FILTER (WHERE content ~ '紧张度') AS 紧张度,
  COUNT(*) FILTER (WHERE content ~ '时间[：:]') AS 时间字段,
  COUNT(*) FILTER (WHERE content ~ '地点[：:]') AS 地点字段,
  COUNT(*) FILTER (WHERE content ~ '衣着[：:]') AS 衣着字段,
  COUNT(*) FILTER (WHERE content ~ '配饰[：:]') AS 配饰字段,
  COUNT(*) FILTER (WHERE content ~ '表情[：:]') AS 表情字段,
  COUNT(*) FILTER (WHERE content ~ '动作[：:]') AS 动作字段,
  COUNT(*) FILTER (WHERE content ~ '内心独白[：:]') AS 内心独白字段,
  COUNT(*) FILTER (WHERE content ~ '分析[：:]') AS 分析字段,
  COUNT(*) FILTER (WHERE content ~ '动机[：:]') AS 动机字段,
  COUNT(*) FILTER (WHERE content ~ '[\[【]锁定[\]】]') AS 锁定标签,
  COUNT(*) FILTER (WHERE content ~ '[\[【]开启[\]】]') AS 开启标签,
  COUNT(*) FILTER (WHERE content ~ '[\[【]隐藏[\]】]') AS 隐藏标签
FROM ai_msgs;

\echo
\echo '================================================================'
\echo 'Step 4: 最新 1 条完整 AI 输出（实物样本）'
\echo '================================================================'

\x on

WITH target_char AS (
  SELECT id FROM characters WHERE name = :'character_name' LIMIT 1
)
SELECT
  m.id, m.created_at,
  LENGTH(m.content) AS content_chars,
  m.content
FROM messages m
INNER JOIN chat_sessions cs ON m.session_id = cs.id
WHERE cs.character_id = (SELECT id FROM target_char)
  AND m.role = 'assistant'
  AND m.superseded_at IS NULL
ORDER BY m.created_at DESC
LIMIT 1;

\x off

\echo
\echo '================================================================'
\echo '完毕。把以上输出整段贴回来分析。'
\echo '================================================================'
