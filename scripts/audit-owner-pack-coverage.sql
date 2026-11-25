-- 审计某 owner 名下所有角色的外部美化导入情况：是否每张卡的 pack 都有
-- 非空 globalCss。识别「一键导入了角色但没补 customStyles」的卡。
--
-- 用法：默认 f213fd3d（谢寻 owner）；改下面 \set 换。
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < scripts/audit-owner-pack-coverage.sql

\set target_owner 'f213fd3d-d7ab-4540-a540-f31e2e3a4619'

\echo
\echo '================================================================'
\echo 'Step 1: 该 owner 名下所有 character'
\echo '================================================================'

SELECT
  c.id AS character_id,
  c.name,
  c.visibility,
  c.created_at,
  (SELECT COUNT(*) FROM chat_sessions cs WHERE cs.character_id = c.id) AS sessions,
  (SELECT COUNT(*) FROM messages m
     INNER JOIN chat_sessions cs ON m.session_id = cs.id
     WHERE cs.character_id = c.id AND m.role = 'assistant' AND m.superseded_at IS NULL)
    AS ai_msgs,
  (SELECT COUNT(*) FROM messages m
     INNER JOIN chat_sessions cs ON m.session_id = cs.id
     WHERE cs.character_id = c.id AND m.role = 'assistant' AND m.superseded_at IS NULL
       AND m.content ~ 'class\s*=')
    AS msgs_with_rich_html
FROM characters c
WHERE c.owner_id = :'target_owner'::uuid
ORDER BY c.created_at;

\echo
\echo '================================================================'
\echo 'Step 2: 每张卡的 pack 订阅 + globalCss 覆盖情况'
\echo '================================================================'

SELECT
  c.name AS character_name,
  bp.id AS pack_id,
  bp.name AS pack_name,
  bp.owner_user_id = c.owner_id AS pack_owned_by_char_owner,
  cps.css_enabled,
  COALESCE(LENGTH(bp.global_css), 0) AS pack_css_chars,
  (SELECT COUNT(*) FROM regex_rules rr WHERE rr.pack_id = bp.id AND rr.enabled = true)
    AS enabled_rules,
  bp.created_at = bp.updated_at AS pack_never_edited
FROM characters c
INNER JOIN character_pack_subscriptions cps ON cps.character_id = c.id
INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
WHERE c.owner_id = :'target_owner'::uuid
ORDER BY c.created_at, cps.order_index;

\echo
\echo '================================================================'
\echo 'Step 3: 缺 globalCss 的卡 + LLM 是否在输出富 HTML（决定补 CSS 是否有价值）'
\echo '================================================================'

WITH owned AS (
  SELECT c.id, c.name FROM characters c WHERE c.owner_id = :'target_owner'::uuid
),
sub_info AS (
  SELECT
    o.id AS character_id,
    o.name AS character_name,
    SUM(COALESCE(LENGTH(bp.global_css), 0)) FILTER (WHERE cps.css_enabled = true) AS injected_css_chars,
    COUNT(*) FILTER (WHERE cps.css_enabled = true) AS enabled_subs
  FROM owned o
  LEFT JOIN character_pack_subscriptions cps ON cps.character_id = o.id
  LEFT JOIN beautification_packs bp ON bp.id = cps.pack_id
  GROUP BY o.id, o.name
)
SELECT
  s.character_name,
  s.injected_css_chars,
  (SELECT COUNT(*) FROM messages m
     INNER JOIN chat_sessions cs ON m.session_id = cs.id
     WHERE cs.character_id = s.character_id
       AND m.role = 'assistant'
       AND m.superseded_at IS NULL
       AND m.content ~ 'class\s*=')
    AS msgs_with_rich_html,
  CASE
    WHEN s.injected_css_chars > 0 THEN '✓ 有 CSS'
    WHEN (SELECT COUNT(*) FROM messages m
            INNER JOIN chat_sessions cs ON m.session_id = cs.id
            WHERE cs.character_id = s.character_id
              AND m.role = 'assistant'
              AND m.superseded_at IS NULL
              AND m.content ~ 'class\s*=') > 0
      THEN '⚠️ LLM 输出富 HTML 但没 CSS → 应补'
    ELSE '○ 无需补 (LLM 也不输出富 HTML)'
  END AS diagnosis
FROM sub_info s
ORDER BY msgs_with_rich_html DESC, s.character_name;

\echo
\echo '================================================================'
\echo '完毕。'
\echo '关键看 Step 3 「⚠️」标记的卡 —— 跟谢寻一样需要从来源平台补 customStyles。'
\echo '================================================================'
