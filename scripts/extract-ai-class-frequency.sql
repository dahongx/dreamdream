-- 扫全库 assistant messages，抽 class="..." 属性值做频次统计
--
-- 用法：
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < scripts/extract-ai-class-frequency.sql
--
-- 输出三段：
--   1 数据范围：扫了多少消息、多少角色
--   2 全部唯一 class 名 + 出现次数（top 80），含外部风格 / 创作者自定义都在
--   3 按角色分组的 top class（前 N 个角色），看分布

\echo
\echo '================================================================'
\echo 'Step 1: 扫描范围'
\echo '================================================================'

WITH ai_msgs AS (
  SELECT m.content, cs.character_id
  FROM messages m
  INNER JOIN chat_sessions cs ON m.session_id = cs.id
  WHERE m.role = 'assistant'
    AND m.superseded_at IS NULL
    AND m.content ~ 'class\s*='
)
SELECT
  COUNT(*) AS msgs_with_class,
  COUNT(DISTINCT character_id) AS characters_with_rich_html
FROM ai_msgs;

\echo
\echo '================================================================'
\echo 'Step 2: 全部 class 名 top 80（含单 class 和组合 class）'
\echo '================================================================'

WITH ai_msgs AS (
  SELECT m.content
  FROM messages m
  WHERE m.role = 'assistant'
    AND m.superseded_at IS NULL
    AND m.content ~ 'class\s*='
),
all_class_attrs AS (
  -- 每个 class="..." 出现位置抽出引号内的内容
  SELECT (regexp_matches(content, 'class\s*=\s*"([^"]+)"', 'g'))[1] AS class_value
  FROM ai_msgs
),
individual_classes AS (
  -- 把 class_value（可能多 class 用空格分隔）按空格拆开
  SELECT unnest(string_to_array(trim(class_value), ' ')) AS class_name
  FROM all_class_attrs
)
SELECT
  class_name,
  COUNT(*) AS occurrences
FROM individual_classes
WHERE class_name <> ''
GROUP BY class_name
ORDER BY occurrences DESC, class_name
LIMIT 80;

\echo
\echo '================================================================'
\echo 'Step 3: 按角色分组 —— 看 class 命名是否外部体系统一还是创作者各自为政'
\echo '================================================================'

WITH ai_msgs AS (
  SELECT m.content, c.name AS character_name
  FROM messages m
  INNER JOIN chat_sessions cs ON m.session_id = cs.id
  INNER JOIN characters c ON c.id = cs.character_id
  WHERE m.role = 'assistant'
    AND m.superseded_at IS NULL
    AND m.content ~ 'class\s*='
),
class_per_char AS (
  SELECT
    character_name,
    unnest(string_to_array(
      trim((regexp_matches(content, 'class\s*=\s*"([^"]+)"', 'g'))[1]),
      ' '
    )) AS class_name
  FROM ai_msgs
)
SELECT
  character_name,
  COUNT(DISTINCT class_name) AS unique_classes,
  array_agg(DISTINCT class_name ORDER BY class_name) FILTER (WHERE class_name <> '') AS sample_classes
FROM class_per_char
WHERE class_name <> ''
GROUP BY character_name
ORDER BY unique_classes DESC
LIMIT 15;

\echo
\echo '================================================================'
\echo '完毕。'
\echo '关键判断：'
\echo '  - Step 2 头部几十个 class 名 → 设计 CSS 覆盖范围'
\echo '  - Step 3 看不同角色 class 是否有交集 → 决定写一套通用 CSS'
\echo '    还是按角色分组写'
\echo '================================================================'
