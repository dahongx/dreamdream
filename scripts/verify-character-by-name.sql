-- 排查某个 character name 在库里是否有多个实例 + 各自的 pack / 消息状况。
-- 解释 extract-ai-class-frequency.sql（按 name 聚合）跟 diff-css-vs-llm.sql
-- （按单一 character_id）出来结果矛盾的现象。
--
-- 用法：默认李逾寻。
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < scripts/verify-character-by-name.sql

\set character_name '李逾寻'

\echo
\echo '================================================================'
\echo 'Step 1: 同名 character 有几个？'
\echo '================================================================'

SELECT
  c.id AS character_id,
  c.name,
  c.owner_id,
  c.created_at,
  c.visibility,
  (SELECT COUNT(*) FROM chat_sessions cs WHERE cs.character_id = c.id) AS sessions,
  (SELECT COUNT(*) FROM messages m
     INNER JOIN chat_sessions cs ON m.session_id = cs.id
     WHERE cs.character_id = c.id
       AND m.role = 'assistant'
       AND m.superseded_at IS NULL) AS ai_msgs,
  (SELECT COUNT(*) FROM messages m
     INNER JOIN chat_sessions cs ON m.session_id = cs.id
     WHERE cs.character_id = c.id
       AND m.role = 'assistant'
       AND m.superseded_at IS NULL
       AND m.content ~ 'class\s*=') AS ai_msgs_with_class_attr
FROM characters c
WHERE c.name = :'character_name'
ORDER BY c.created_at;

\echo
\echo '================================================================'
\echo 'Step 2: 这些 character 各自订阅了哪些 pack'
\echo '================================================================'

SELECT
  c.id AS character_id,
  c.created_at AS char_created,
  bp.name AS pack_name,
  bp.id AS pack_id,
  cps.css_enabled,
  cps.order_index,
  COALESCE(LENGTH(bp.global_css), 0) AS pack_css_chars,
  (SELECT COUNT(*) FROM regex_rules rr WHERE rr.pack_id = bp.id AND rr.enabled = true)
    AS enabled_rules
FROM characters c
INNER JOIN character_pack_subscriptions cps ON cps.character_id = c.id
INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
WHERE c.name = :'character_name'
ORDER BY c.created_at, cps.order_index;

\echo
\echo '================================================================'
\echo 'Step 3: 「鱼鱼」pack 被谁订阅了？'
\echo '================================================================'

SELECT
  bp.id AS pack_id,
  bp.name AS pack_name,
  bp.owner_user_id AS pack_owner,
  COALESCE(LENGTH(bp.global_css), 0) AS pack_css_chars,
  c.id AS subscriber_id,
  c.name AS subscriber_name,
  cps.css_enabled,
  cps.order_index
FROM beautification_packs bp
LEFT JOIN character_pack_subscriptions cps ON cps.pack_id = bp.id
LEFT JOIN characters c ON c.id = cps.character_id
WHERE bp.name = '鱼鱼'
ORDER BY c.name;

\echo
\echo '================================================================'
\echo '完毕。'
\echo '可能的发现：'
\echo '  - 库里有 2 个同名李逾寻，其中 1 个真正聊过、订了 25KB CSS 的 pack'
\echo '  - 之前 diff SQL 用 LIMIT 1 抓的可能是另一个空壳'
\echo '  - 我们要看「鱼鱼」pack 现在到底挂在哪个 character 身上'
\echo '================================================================'
