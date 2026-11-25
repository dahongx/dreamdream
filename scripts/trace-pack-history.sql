-- 追查某个 pack 的历史：现状 + dead tuples（已经被 UPDATE/DELETE 但还没 vacuum 的旧版本）
--
-- 用法：默认追谢寻 的美化包；改下面 \set 换。
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < scripts/trace-pack-history.sql

\set target_pack '391ef991-88f4-4340-905f-51cd2d410dac'

\echo
\echo '================================================================'
\echo 'Step 1: pack 当前状态 + 时间戳'
\echo '================================================================'

SELECT
  id,
  name,
  owner_user_id,
  COALESCE(LENGTH(global_css), 0) AS global_css_chars,
  is_public,
  subscriber_count,
  created_at,
  updated_at,
  (updated_at > created_at + interval '1 minute') AS edited_after_creation
FROM beautification_packs
WHERE id = :'target_pack'::uuid;

\echo
\echo '================================================================'
\echo 'Step 2: beautification_packs 表的 vacuum 统计'
\echo '================================================================'

SELECT
  relname,
  n_live_tup,
  n_dead_tup,
  n_tup_upd,
  n_tup_del,
  last_autovacuum,
  autovacuum_count
FROM pg_stat_user_tables
WHERE relname = 'beautification_packs';

\echo
\echo '================================================================'
\echo 'Step 3: pageinspect 扫 dead tuples，找该 pack 的历史版本'
\echo '================================================================'

WITH pages AS (
  SELECT generate_series(0, GREATEST(pg_relation_size('beautification_packs') / 8192 - 1, 0))::int AS pno
),
items AS (
  SELECT pno, items.*
  FROM pages,
  LATERAL heap_page_items(get_raw_page('beautification_packs', pno)) items
),
dead AS (
  SELECT
    pno, lp, t_xmin, t_xmax, lp_len,
    tuple_data_split('beautification_packs'::regclass,
      t_data, t_infomask, t_infomask2, t_bits) AS arr
  FROM items
  WHERE t_xmax IS NOT NULL
    AND t_xmax::text NOT IN ('0', '')
    AND t_data IS NOT NULL
    AND lp_len > 0
)
SELECT
  pno, lp,
  t_xmin AS xmin,
  t_xmax AS xmax,
  encode(arr[1], 'hex') AS id_hex,
  -- beautification_packs 列顺序：id(uuid) owner_user_id(uuid) name(varchar)
  -- description(text) global_css(text) is_public(bool) subscriber_count(int4)
  -- created_at(timestamptz) updated_at(timestamptz)
  encode(substring(arr[3] FROM 2), 'escape') AS name_raw,
  COALESCE(length(arr[5]), 0) AS global_css_bytes,
  CASE
    WHEN arr[5] IS NULL THEN '(NULL)'
    WHEN length(arr[5]) <= 18 THEN '(TOAST 指针, 完整内容不在 dead tuple)'
    ELSE substr(encode(substring(arr[5] FROM 5), 'escape'), 1, 300)
  END AS global_css_preview
FROM dead
WHERE encode(arr[1], 'hex') = REPLACE(:'target_pack', '-', '')
ORDER BY pno, lp;

\echo
\echo '================================================================'
\echo 'Step 4: 该 pack 当前订阅状态（谁还在用、css 开关开没开）'
\echo '================================================================'

SELECT
  cps.character_id,
  c.name AS character_name,
  cps.css_enabled,
  cps.order_index,
  cps.created_at
FROM character_pack_subscriptions cps
INNER JOIN characters c ON c.id = cps.character_id
WHERE cps.pack_id = :'target_pack'::uuid
ORDER BY cps.created_at;

\echo
\echo '================================================================'
\echo '完毕。'
\echo '关键判断：'
\echo '  Step 1 edited_after_creation:'
\echo '    true  → pack 被改过；如果当前 global_css_chars=0，说明历史上被清空'
\echo '    false → pack 创建后就没改过，从一开始就是空的'
\echo '  Step 3 dead tuples 含 global_css 内容 → 历史版本捞回来即可恢复'
\echo '================================================================'
