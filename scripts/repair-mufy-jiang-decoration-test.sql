-- Test server only. Preserve the original row before the first application.
\set ON_ERROR_STOP on
BEGIN;
SELECT id FROM opening_components WHERE id='4e0d8b2f-6cde-4df3-a67e-666efb4e7f5f' AND pack_id='f375261c-d983-459e-a39a-18a34d542e63' FOR UPDATE;
\copy (SELECT * FROM opening_components WHERE id='4e0d8b2f-6cde-4df3-a67e-666efb4e7f5f') TO '/tmp/jiang-decoration-before-20261012.csv' WITH CSV HEADER
UPDATE opening_components
SET content=replace(replace(replace(content,'width: 120%; /* 线条比文字略长 */','width: 100%; /* Keep decorative line within mobile content */'),'right: -10px;','right: 0px;'),'padding: 15px 5px;','padding: 15px 5px; box-sizing: border-box;'), updated_at=now()
WHERE id='4e0d8b2f-6cde-4df3-a67e-666efb4e7f5f' AND pack_id='f375261c-d983-459e-a39a-18a34d542e63';
COMMIT;
