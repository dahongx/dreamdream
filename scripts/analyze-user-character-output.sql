-- 分析某个用户跟某个角色的对话，AI 输出 pattern 详查
--
-- 用法：默认 zouwuhe@163.com x 谢寻；改下面 \set 变量换别的。
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < scripts/analyze-user-character-output.sql

\set user_email 'zouwuhe@163.com'
\set character_name '谢寻'

\echo
\echo '================================================================'
\echo 'Step 1: 找用户和角色'
\echo '================================================================'

SELECT
  u.id AS user_id,
  u.email,
  u.display_name,
  c.id AS character_id,
  c.name AS character_name
FROM users u, characters c
WHERE u.email = :'user_email'
  AND c.name = :'character_name';

\echo
\echo '================================================================'
\echo 'Step 2: 该用户跟该角色的 session 与 AI 消息总数'
\echo '================================================================'

WITH target AS (
  SELECT u.id AS user_id, c.id AS character_id
  FROM users u, characters c
  WHERE u.email = :'user_email' AND c.name = :'character_name'
),
sess AS (
  SELECT cs.id FROM chat_sessions cs, target t
  WHERE cs.user_id = t.user_id AND cs.character_id = t.character_id
)
SELECT
  (SELECT COUNT(*) FROM sess) AS session_count,
  COUNT(*) AS assistant_msg_count,
  AVG(LENGTH(content))::int AS avg_chars,
  MAX(LENGTH(content)) AS max_chars,
  MIN(created_at) AS earliest_msg,
  MAX(created_at) AS latest_msg
FROM messages m
WHERE m.session_id IN (SELECT id FROM sess)
  AND m.role = 'assistant'
  AND m.superseded_at IS NULL;

\echo
\echo '================================================================'
\echo 'Step 3: 「记忆区」/ 状态栏专属 marker 命中数'
\echo '================================================================'

WITH target AS (
  SELECT u.id AS user_id, c.id AS character_id
  FROM users u, characters c
  WHERE u.email = :'user_email' AND c.name = :'character_name'
),
ai_msgs AS (
  SELECT m.content
  FROM messages m
  INNER JOIN chat_sessions cs ON m.session_id = cs.id
  WHERE cs.user_id = (SELECT user_id FROM target)
    AND cs.character_id = (SELECT character_id FROM target)
    AND m.role = 'assistant'
    AND m.superseded_at IS NULL
)
SELECT
  COUNT(*) AS total_msgs,
  -- 结构 marker
  COUNT(*) FILTER (WHERE content ~ '<details') AS has_details,
  COUNT(*) FILTER (WHERE content ~ '<summary') AS has_summary,
  -- 「记忆区」专门关键词
  COUNT(*) FILTER (WHERE content ~ '记忆区') AS has_memory_area,
  COUNT(*) FILTER (WHERE content ~ '记忆') AS has_memory_word,
  COUNT(*) FILTER (WHERE content ~ '短期记忆') AS has_short_memory,
  COUNT(*) FILTER (WHERE content ~ '长期记忆') AS has_long_memory,
  -- 状态栏字段
  COUNT(*) FILTER (WHERE content ~ '关系系数|关系指数') AS has_relation_index,
  COUNT(*) FILTER (WHERE content ~ '好感度') AS has_affection,
  COUNT(*) FILTER (WHERE content ~ '仇恨值') AS has_hatred,
  -- 富 HTML 提示（说明 LLM 在输出 HTML 标记，不是朴素 markdown）
  COUNT(*) FILTER (WHERE content ~ '<div\s') AS has_div_tag,
  COUNT(*) FILTER (WHERE content ~ '<span\s') AS has_span_tag,
  COUNT(*) FILTER (WHERE content ~ 'class\s*=') AS has_class_attr,
  COUNT(*) FILTER (WHERE content ~ 'style\s*=') AS has_style_attr,
  COUNT(*) FILTER (WHERE content ~ '<style') AS has_inline_style_block,
  -- 数字 / chip
  COUNT(*) FILTER (WHERE content ~ '\d+(\.\d+)?%') AS has_percent,
  COUNT(*) FILTER (WHERE content ~ '\(\+\d') AS has_delta_up,
  COUNT(*) FILTER (WHERE content ~ '\[[^]\n]{1,8}\]') AS has_brackets
FROM ai_msgs;

\echo
\echo '================================================================'
\echo 'Step 4: 最近 1 条完整 AI 输出（看 LLM 实际产物）'
\echo '================================================================'

\x on

WITH target AS (
  SELECT u.id AS user_id, c.id AS character_id
  FROM users u, characters c
  WHERE u.email = :'user_email' AND c.name = :'character_name'
)
SELECT
  m.id, m.created_at,
  LENGTH(m.content) AS chars,
  m.content
FROM messages m
INNER JOIN chat_sessions cs ON m.session_id = cs.id
WHERE cs.user_id = (SELECT user_id FROM target)
  AND cs.character_id = (SELECT character_id FROM target)
  AND m.role = 'assistant'
  AND m.superseded_at IS NULL
ORDER BY m.created_at DESC
LIMIT 1;

\x off

\echo
\echo '================================================================'
\echo 'Step 5: 含「记忆区」的最近 1 条（如果有的话）'
\echo '================================================================'

\x on

WITH target AS (
  SELECT u.id AS user_id, c.id AS character_id
  FROM users u, characters c
  WHERE u.email = :'user_email' AND c.name = :'character_name'
)
SELECT
  m.id, m.created_at,
  LENGTH(m.content) AS chars,
  m.content
FROM messages m
INNER JOIN chat_sessions cs ON m.session_id = cs.id
WHERE cs.user_id = (SELECT user_id FROM target)
  AND cs.character_id = (SELECT character_id FROM target)
  AND m.role = 'assistant'
  AND m.superseded_at IS NULL
  AND m.content ~ '记忆区'
ORDER BY m.created_at DESC
LIMIT 1;

\x off

\echo
\echo '================================================================'
\echo '完毕。'
\echo '关键判断：'
\echo '  has_inline_style_block / has_class_attr / has_style_attr 都 ≈ 0'
\echo '   → LLM 输出的是朴素 markdown，没有富 HTML，所以即便 CSS 加进来'
\echo '      也没东西可命中。说明问题在「LLM 不输出」而不是「CSS 缺」。'
\echo '  反之这几个 > 0 → LLM 在输出 HTML 标记，CSS 端缺样式才导致塌'
\echo '================================================================'
