-- 全库审计：所有角色卡的外部美化覆盖情况。
-- 把 audit-owner-pack-coverage.sql 拓到全库范围，找出每个 owner 名下哪些卡
-- 是「LLM 输出富 HTML 但 pack.globalCss = 0」（跟谢寻同病，需要补外部
-- customStyles）。按 owner 分组，方便用户跟各创作者沟通。
--
-- 用法：
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < scripts/audit-global-pack-coverage.sql

\echo
\echo '================================================================'
\echo 'Step 1: 全库 character 数 + 大致富 HTML 分布'
\echo '================================================================'

WITH char_stats AS (
  SELECT
    c.id AS character_id,
    c.owner_id,
    (SELECT COUNT(*) FROM messages m
       INNER JOIN chat_sessions cs ON m.session_id = cs.id
       WHERE cs.character_id = c.id
         AND m.role = 'assistant'
         AND m.superseded_at IS NULL
         AND m.content ~ 'class\s*=')
      AS msgs_rich
  FROM characters c
)
SELECT
  COUNT(*) AS total_characters,
  COUNT(*) FILTER (WHERE msgs_rich > 0) AS chars_with_rich_html,
  COUNT(DISTINCT owner_id) AS distinct_owners,
  COUNT(DISTINCT owner_id) FILTER (WHERE msgs_rich > 0) AS owners_with_rich_html_chars
FROM char_stats;

\echo
\echo '================================================================'
\echo 'Step 2: 每张卡的 diagnosis（按 owner_id 分组，缺 CSS 的排前面）'
\echo '================================================================'

WITH sub_info AS (
  SELECT
    c.id AS character_id,
    c.name AS character_name,
    c.owner_id,
    SUM(COALESCE(LENGTH(bp.global_css), 0)) FILTER (WHERE cps.css_enabled = true)
      AS injected_css_chars,
    COUNT(*) FILTER (WHERE cps.css_enabled = true) AS enabled_subs
  FROM characters c
  LEFT JOIN character_pack_subscriptions cps ON cps.character_id = c.id
  LEFT JOIN beautification_packs bp ON bp.id = cps.pack_id
  GROUP BY c.id, c.name, c.owner_id
),
diag AS (
  SELECT
    s.character_id,
    s.character_name,
    s.owner_id,
    COALESCE(s.injected_css_chars, 0) AS injected_css_chars,
    (SELECT COUNT(*) FROM messages m
       INNER JOIN chat_sessions cs ON m.session_id = cs.id
       WHERE cs.character_id = s.character_id
         AND m.role = 'assistant'
         AND m.superseded_at IS NULL
         AND m.content ~ 'class\s*=')
      AS msgs_with_rich_html
  FROM sub_info s
)
SELECT
  owner_id,
  character_name,
  injected_css_chars,
  msgs_with_rich_html,
  CASE
    WHEN msgs_with_rich_html = 0 THEN '○ skip (no rich html)'
    WHEN injected_css_chars > 0 THEN '✓ ok'
    ELSE '⚠️ needs fix'
  END AS diagnosis
FROM diag
WHERE msgs_with_rich_html > 0   -- 只列输出富 HTML 的卡（其他无须补 CSS）
ORDER BY
  CASE WHEN injected_css_chars = 0 THEN 0 ELSE 1 END,  -- ⚠️ 排前面
  msgs_with_rich_html DESC,
  character_name;

\echo
\echo '================================================================'
\echo 'Step 3: 缺 CSS 的卡按 owner 汇总（看谁影响最多卡）'
\echo '================================================================'

WITH sub_info AS (
  SELECT
    c.id AS character_id, c.owner_id,
    SUM(COALESCE(LENGTH(bp.global_css), 0)) FILTER (WHERE cps.css_enabled = true)
      AS injected
  FROM characters c
  LEFT JOIN character_pack_subscriptions cps ON cps.character_id = c.id
  LEFT JOIN beautification_packs bp ON bp.id = cps.pack_id
  GROUP BY c.id, c.owner_id
),
diag AS (
  SELECT
    s.character_id, s.owner_id,
    COALESCE(s.injected, 0) AS injected,
    (SELECT COUNT(*) FROM messages m
       INNER JOIN chat_sessions cs ON m.session_id = cs.id
       WHERE cs.character_id = s.character_id
         AND m.role = 'assistant' AND m.superseded_at IS NULL
         AND m.content ~ 'class\s*=')
      AS msgs_rich
  FROM sub_info s
)
SELECT
  d.owner_id,
  u.email,
  u.display_name,
  COUNT(*) FILTER (WHERE msgs_rich > 0 AND injected = 0) AS needs_fix,
  COUNT(*) FILTER (WHERE msgs_rich > 0 AND injected > 0) AS ok,
  COUNT(*) FILTER (WHERE msgs_rich = 0) AS skip
FROM diag d
LEFT JOIN users u ON u.id = d.owner_id
GROUP BY d.owner_id, u.email, u.display_name
HAVING COUNT(*) FILTER (WHERE msgs_rich > 0 AND injected = 0) > 0
ORDER BY needs_fix DESC;

\echo
\echo '================================================================'
\echo '完毕。'
\echo 'Step 2 ⚠️ 行 = 该卡作者需要从来源平台拉 customStyles 粘进 dearm pack。'
\echo 'Step 3 = 按作者汇总，方便针对性 outreach。'
\echo '================================================================'
