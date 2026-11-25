-- Run only in supabase-db on the verified test host 115.29.213.73.
-- Preserve the original pack as a server-side CSV before changing its CSS.
\set ON_ERROR_STOP on
BEGIN;
SELECT id FROM beautification_packs
WHERE id = '4ea66ad7-3287-4116-ad34-28c5bdd29e04' FOR UPDATE;
\copy (SELECT * FROM beautification_packs WHERE id = '4ea66ad7-3287-4116-ad34-28c5bdd29e04') TO '/tmp/mufy-emphasis-pack-before-20261012.csv' WITH (FORMAT csv, HEADER true)
UPDATE beautification_packs
SET global_css = replace(replace(replace(global_css,
  '--text-primary', '--mufy-reply-text-primary'),
  '--text-secondary', '--mufy-reply-text-secondary'),
  '--border-color', '--mufy-reply-border-color') || $skin$

/* Mufy inline emphasis parity, 2026-10-12. */
.nj_emphasis_text {
  color: var(--c-main-text) !important;
  font-weight: 500 !important;
  -webkit-text-fill-color: initial !important;
  background-image: linear-gradient(to right, rgba(120,175,210,.15) 0%, rgba(100,165,205,.25) 10%, rgba(100,165,205,.25) 90%, rgba(120,175,210,.15) 100%) !important;
  background-color: transparent !important;
  background-repeat: no-repeat !important;
  background-size: 100% 40% !important;
  background-position: left bottom !important;
  text-shadow: 0 0 3px rgba(120,175,210,.3) !important;
  padding: 0 3px !important;
  margin: 0 1px !important;
  border-radius: 1px !important;
  transition: none !important;
  box-decoration-break: clone !important;
  -webkit-box-decoration-break: clone !important;
}
$skin$, updated_at = now()
WHERE id = '4ea66ad7-3287-4116-ad34-28c5bdd29e04'
AND name = '余斯是 的美化包'
AND global_css NOT LIKE '%Mufy inline emphasis parity, 2026-10-12%';
COMMIT;
