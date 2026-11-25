-- 对比某角色 pack.globalCss 里定义的 class 跟 LLM 输出里出现的 class，
-- 看是否对得上（如果不对得上 → 即便 globalCss 非空也渲染不出来）
--
-- 用法：默认李逾寻；改下面 \set 换。
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < scripts/diff-css-vs-llm.sql

\set character_name '李逾寻'

\echo
\echo '================================================================'
\echo 'Step 1: 角色 + 订阅 pack + css_enabled 状态'
\echo '================================================================'

WITH target AS (
  SELECT id FROM characters WHERE name = :'character_name' LIMIT 1
)
SELECT
  c.id AS character_id,
  c.name AS character_name,
  bp.id AS pack_id,
  bp.name AS pack_name,
  cps.css_enabled,
  cps.order_index,
  COALESCE(LENGTH(bp.global_css), 0) AS global_css_chars
FROM characters c
INNER JOIN character_pack_subscriptions cps ON cps.character_id = c.id
INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
WHERE c.id = (SELECT id FROM target)
ORDER BY cps.order_index;

\echo
\echo '================================================================'
\echo 'Step 2: pack.global_css 里定义了哪些 class 选择器（top 60）'
\echo '================================================================'

WITH target AS (
  SELECT id FROM characters WHERE name = :'character_name' LIMIT 1
),
css_content AS (
  SELECT bp.global_css
  FROM character_pack_subscriptions cps
  INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
  WHERE cps.character_id = (SELECT id FROM target)
    AND cps.css_enabled = true
    AND bp.global_css IS NOT NULL
    AND LENGTH(bp.global_css) > 0
),
selectors AS (
  -- 从 CSS 文本里抽 .className 选择器（不含 _ 开头的 nj_ 或别的特殊命名）
  SELECT
    (regexp_matches(global_css, '\.([a-zA-Z][a-zA-Z0-9_-]+)', 'g'))[1] AS class_name
  FROM css_content
)
SELECT
  class_name,
  COUNT(*) AS times_referenced_in_css
FROM selectors
GROUP BY class_name
ORDER BY times_referenced_in_css DESC, class_name
LIMIT 60;

\echo
\echo '================================================================'
\echo 'Step 3: LLM 在该角色对话里实际输出的 class 名（top 60）'
\echo '================================================================'

WITH target AS (
  SELECT id FROM characters WHERE name = :'character_name' LIMIT 1
),
ai_classes AS (
  SELECT unnest(string_to_array(
    trim((regexp_matches(m.content, 'class\s*=\s*"([^"]+)"', 'g'))[1]),
    ' '
  )) AS class_name
  FROM messages m
  INNER JOIN chat_sessions cs ON m.session_id = cs.id
  WHERE cs.character_id = (SELECT id FROM target)
    AND m.role = 'assistant'
    AND m.superseded_at IS NULL
)
SELECT
  class_name,
  COUNT(*) AS llm_output_count
FROM ai_classes
WHERE class_name <> ''
GROUP BY class_name
ORDER BY llm_output_count DESC, class_name
LIMIT 60;

\echo
\echo '================================================================'
\echo 'Step 4: 交集 vs 差集'
\echo '================================================================'

WITH target AS (
  SELECT id FROM characters WHERE name = :'character_name' LIMIT 1
),
css_classes AS (
  SELECT DISTINCT (regexp_matches(bp.global_css, '\.([a-zA-Z][a-zA-Z0-9_-]+)', 'g'))[1] AS c
  FROM character_pack_subscriptions cps
  INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
  WHERE cps.character_id = (SELECT id FROM target)
    AND cps.css_enabled = true AND bp.global_css IS NOT NULL
),
llm_classes AS (
  SELECT DISTINCT unnest(string_to_array(
    trim((regexp_matches(m.content, 'class\s*=\s*"([^"]+)"', 'g'))[1]), ' '
  )) AS c
  FROM messages m
  INNER JOIN chat_sessions cs ON m.session_id = cs.id
  WHERE cs.character_id = (SELECT id FROM target)
    AND m.role = 'assistant' AND m.superseded_at IS NULL
)
SELECT
  (SELECT COUNT(*) FROM css_classes WHERE c <> '') AS unique_classes_in_css,
  (SELECT COUNT(*) FROM llm_classes WHERE c <> '') AS unique_classes_in_llm,
  (SELECT COUNT(*) FROM css_classes WHERE c IN (SELECT c FROM llm_classes) AND c <> '')
    AS intersection_count,
  (SELECT array_agg(c ORDER BY c) FROM llm_classes WHERE c NOT IN (SELECT c FROM css_classes) AND c <> '')
    AS llm_classes_NOT_in_css,
  (SELECT array_agg(c ORDER BY c) FROM (SELECT c FROM css_classes WHERE c NOT IN (SELECT c FROM llm_classes) AND c <> '' LIMIT 30) sub)
    AS css_classes_NOT_in_llm_first30;

\echo
\echo '================================================================'
\echo 'Step 5: pack.global_css 前 2500 字符（人眼扫一下结构）'
\echo '================================================================'

\x on

WITH target AS (
  SELECT id FROM characters WHERE name = :'character_name' LIMIT 1
)
SELECT
  bp.name AS pack_name,
  substr(bp.global_css, 1, 2500) AS css_first_2500
FROM character_pack_subscriptions cps
INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
WHERE cps.character_id = (SELECT id FROM target)
  AND cps.css_enabled = true
  AND bp.global_css IS NOT NULL
  AND LENGTH(bp.global_css) > 0
LIMIT 1;

\x off

\echo
\echo '================================================================'
\echo '完毕。'
\echo '关键判断：'
\echo '  intersection_count > 0 且 llm_classes_NOT_in_css 短 → CSS 覆盖到位'
\echo '  intersection_count = 0  → CSS 命名跟 LLM 输出完全不匹配，渲染必然塌'
\echo '  llm_classes_NOT_in_css 长 → 缺一大块 class 的 CSS'
\echo '================================================================'
