-- 死马当活马医 v2：扫 regex_rules 的 dead tuples，把每条对应到 pack/character
--
-- v1 后置问题修：
--   - convert_from UTF8 解码遇到 varlena 长头不对齐时挂 → 改用 encode('escape')
--     不验证 UTF8，非 ASCII 字符显示为八进制 escape，识别足够
--   - ORDER BY xid 类型挂 → 移除该排序
--   - Step 4 用 hex 关联 pack 名字 + 订阅角色，一眼看出 dead tuple 属于谁
--
-- 用法：
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < scripts/recover-dead-tuples.sql

\echo
\echo '================================================================'
\echo 'Step 1: 表统计'
\echo '================================================================'

SELECT
  n_live_tup,
  n_dead_tup,
  n_tup_del,
  n_tup_upd,
  last_autovacuum,
  vacuum_count,
  autovacuum_count
FROM pg_stat_user_tables
WHERE relname = 'regex_rules';

\echo
\echo '================================================================'
\echo 'Step 2: dead tuples 元数据 + 关联当前活着的 pack/character'
\echo '================================================================'

\x on

WITH pages AS (
  SELECT generate_series(0, GREATEST(pg_relation_size('regex_rules') / 8192 - 1, 0))::int AS pno
),
items AS (
  SELECT
    pno,
    items.*
  FROM pages,
  LATERAL heap_page_items(get_raw_page('regex_rules', pno)) items
),
dead AS (
  SELECT
    pno, lp, t_xmin, t_xmax, lp_len,
    tuple_data_split('regex_rules'::regclass,
      t_data, t_infomask, t_infomask2, t_bits) AS arr
  FROM items
  WHERE t_xmax IS NOT NULL
    AND t_xmax::text NOT IN ('0', '')
    AND t_data IS NOT NULL
    AND lp_len > 0
),
dead_with_uuids AS (
  SELECT
    pno, lp, t_xmin, t_xmax,
    encode(arr[1], 'hex') AS id_hex,
    encode(arr[2], 'hex') AS pack_id_hex,
    arr
  FROM dead
)
SELECT
  d.pno, d.lp,
  d.t_xmin AS xmin,
  d.t_xmax AS xmax,
  -- pack 名字 + 当前订阅它的角色
  bp.name AS pack_name,
  COALESCE(
    (SELECT string_agg(c.name, ', ')
     FROM character_pack_subscriptions cps
     INNER JOIN characters c ON c.id = cps.character_id
     WHERE cps.pack_id = bp.id),
    '(无角色订阅)'
  ) AS subscribers,
  -- name 字段（varchar 128，1-byte 头跳 1 字节）
  encode(substring(d.arr[3] FROM 2), 'escape') AS name_raw,
  length(d.arr[5]) AS pattern_bytes,
  length(d.arr[6]) AS replacement_bytes,
  -- replacement ≤ 18 字节 → 大概率 TOAST 指针
  CASE
    WHEN d.arr[6] IS NULL THEN '(NULL)'
    WHEN length(d.arr[6]) <= 18 THEN '!!! 疑似 TOAST 指针, 内容不在 dead tuple 内 !!!'
    ELSE encode(substring(d.arr[6] FROM 5 FOR 300), 'escape')
  END AS replacement_preview_raw
FROM dead_with_uuids d
LEFT JOIN beautification_packs bp
  ON bp.id::text = (
    substring(d.pack_id_hex FROM 1 FOR 8) || '-' ||
    substring(d.pack_id_hex FROM 9 FOR 4) || '-' ||
    substring(d.pack_id_hex FROM 13 FOR 4) || '-' ||
    substring(d.pack_id_hex FROM 17 FOR 4) || '-' ||
    substring(d.pack_id_hex FROM 21 FOR 12)
  )
ORDER BY d.pno, d.lp;

\x off

\echo
\echo '================================================================'
\echo '结束。看上面 pack_name + subscribers + replacement_preview_raw 判断价值。'
\echo '关键问题：有没有 dead tuple 属于谢寻/顾深意/西提空/江澈/姜淮聿/萧予夺'
\echo '         的 pack？replacement_preview 里有没有 <style> / 状态 / 好感度 关键词？'
\echo '================================================================'
