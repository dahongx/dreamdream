-- 用 character_id 直接对比 CSS vs LLM class（避免按 name 命中重名）。
-- 默认 8ba51f0a-... 即真李逾寻；改下面 \set 换 ID。
--
-- 用法：
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < scripts/diff-css-vs-llm-by-id.sql

\set target_id '8ba51f0a-2ee4-4abc-ba67-bf7df86707e8'

\echo
\echo '================================================================'
\echo 'Step 1: 该 character 当前订阅状态（关键看 css_enabled）'
\echo '================================================================'

SELECT
  c.id AS character_id,
  c.name,
  bp.name AS pack_name,
  cps.css_enabled,
  cps.order_index,
  COALESCE(LENGTH(bp.global_css), 0) AS pack_css_chars
FROM characters c
INNER JOIN character_pack_subscriptions cps ON cps.character_id = c.id
INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
WHERE c.id = :'target_id'::uuid
ORDER BY cps.order_index;

\echo
\echo '================================================================'
\echo 'Step 2: 该 character 实际注入的 globalCss 是多大（模拟 loadCharacterGlobalCss）'
\echo '================================================================'

SELECT
  COALESCE(SUM(LENGTH(bp.global_css)), 0) AS total_css_chars_injected,
  COUNT(*) AS enabled_subs
FROM character_pack_subscriptions cps
INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
WHERE cps.character_id = :'target_id'::uuid
  AND cps.css_enabled = true
  AND bp.global_css IS NOT NULL
  AND LENGTH(bp.global_css) > 0;

\echo
\echo '================================================================'
\echo 'Step 3: pack.global_css 里定义的 class 选择器（top 60，只看 enabled 的 pack）'
\echo '================================================================'

WITH css_content AS (
  SELECT bp.global_css
  FROM character_pack_subscriptions cps
  INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
  WHERE cps.character_id = :'target_id'::uuid
    AND cps.css_enabled = true
    AND bp.global_css IS NOT NULL
    AND LENGTH(bp.global_css) > 0
),
selectors AS (
  SELECT (regexp_matches(global_css, '\.([a-zA-Z][a-zA-Z0-9_-]+)', 'g'))[1] AS class_name
  FROM css_content
)
SELECT class_name, COUNT(*) AS times_in_css
FROM selectors
GROUP BY class_name
ORDER BY times_in_css DESC, class_name
LIMIT 60;

\echo
\echo '================================================================'
\echo 'Step 4: LLM 在该 character 输出的 class 名（top 60）'
\echo '================================================================'

WITH ai_classes AS (
  SELECT unnest(string_to_array(
    trim((regexp_matches(m.content, 'class\s*=\s*"([^"]+)"', 'g'))[1]),
    ' '
  )) AS class_name
  FROM messages m
  INNER JOIN chat_sessions cs ON m.session_id = cs.id
  WHERE cs.character_id = :'target_id'::uuid
    AND m.role = 'assistant'
    AND m.superseded_at IS NULL
)
SELECT class_name, COUNT(*) AS llm_count
FROM ai_classes
WHERE class_name <> ''
GROUP BY class_name
ORDER BY llm_count DESC, class_name
LIMIT 60;

\echo
\echo '================================================================'
\echo 'Step 5: CSS vs LLM 交集 / 差集（关键判断 —— 在不在）'
\echo '================================================================'

WITH css_classes AS (
  SELECT DISTINCT (regexp_matches(bp.global_css, '\.([a-zA-Z][a-zA-Z0-9_-]+)', 'g'))[1] AS c
  FROM character_pack_subscriptions cps
  INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
  WHERE cps.character_id = :'target_id'::uuid
    AND cps.css_enabled = true
    AND bp.global_css IS NOT NULL
),
llm_classes AS (
  SELECT DISTINCT unnest(string_to_array(
    trim((regexp_matches(m.content, 'class\s*=\s*"([^"]+)"', 'g'))[1]), ' '
  )) AS c
  FROM messages m
  INNER JOIN chat_sessions cs ON m.session_id = cs.id
  WHERE cs.character_id = :'target_id'::uuid
    AND m.role = 'assistant' AND m.superseded_at IS NULL
)
SELECT
  (SELECT COUNT(*) FROM css_classes WHERE c <> '') AS unique_classes_in_css,
  (SELECT COUNT(*) FROM llm_classes WHERE c <> '') AS unique_classes_in_llm,
  (SELECT COUNT(*) FROM css_classes WHERE c IN (SELECT c FROM llm_classes) AND c <> '')
    AS intersection_count,
  (SELECT array_agg(c ORDER BY c)
     FROM (SELECT c FROM llm_classes WHERE c NOT IN (SELECT c FROM css_classes) AND c <> '' LIMIT 25) sub)
    AS llm_NOT_in_css_first25,
  (SELECT array_agg(c ORDER BY c)
     FROM (SELECT c FROM css_classes WHERE c NOT IN (SELECT c FROM llm_classes) AND c <> '' LIMIT 25) sub)
    AS css_NOT_in_llm_first25;

\echo
\echo '================================================================'
\echo 'Step 6: globalCss 前 2000 字符（看是 nj_* 翻译过的还是原外部前缀 / 还是 cyd-* 直接命中）'
\echo '================================================================'

\x on

SELECT
  bp.name AS pack_name,
  cps.css_enabled,
  substr(bp.global_css, 1, 2000) AS css_first_2000
FROM character_pack_subscriptions cps
INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
WHERE cps.character_id = :'target_id'::uuid
  AND bp.global_css IS NOT NULL
  AND LENGTH(bp.global_css) > 0
ORDER BY cps.order_index;

\x off

\echo
\echo '================================================================'
\echo '完毕。'
\echo '================================================================'
