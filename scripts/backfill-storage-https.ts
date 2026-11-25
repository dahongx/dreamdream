#!/usr/bin/env bun
/**
 * 把 DB 里所有 http://<IP>:8000/storage/v1/object/public/media/ 前缀换成
 * https://dearm.ai/api/media/。
 *
 * Why:
 *   c9b0e73 (2026-07-05) 的图床迁移把外部 CDN 直链全部改成
 *   http://<IP>:8000/storage/v1/object/public/media/... —— 站点走
 *   https://dearm.ai, iframe CSP img-src 'self' data: https:, 于是小手机背景 /
 *   默认头像被静默拦截。
 *
 *   next.config.ts 加了 /api/media/:path* → SUPABASE_URL/storage/v1/object/public/media/:path*
 *   的反向代理 —— 挂 /api/ 下是因为 Cloudflare 对 /storage/* 有拦截 (推测 R2 /
 *   Transform Rule), 而 /api/* 是 cdn-cloudflare.md §5 明确 bypass 的通路。
 *
 *   现在 https://dearm.ai/api/media/<prefix>/xxx.jpg 就是走同一个上游的 HTTPS 通路。
 *   DB 端一次替换, iframe / 主页面两条通路一起解决。
 *
 * Scope (2026-07-06 扫描):
 *   characters.avatar_url       85 行
 *   characters.cover_image_url  85 行
 *   regex_rules.replacement     40 行
 *   messages.rendered_html       2 行
 *   users.avatar_url             5 行
 *
 * 幂等:
 *   全用 WHERE ... LIKE '%<OLD_PREFIX>%' 过滤, 第二次跑匹配为 0。REPLACE 是
 *   纯字符串替换, 不会破坏其他内容。
 *
 * 跑法:
 *   bun run scripts/backfill-storage-https.ts          # dry-run
 *   bun run scripts/backfill-storage-https.ts --commit # 真跑
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✗ DATABASE_URL 未设置");
  process.exit(1);
}

// 把 http://<IP>:8000/storage/v1/object/public/media/ → https://dearm.ai/api/media/
// 一次前缀替换搞定迁移历史与 users/ 两种子路径。
const OLD = "http://115.29.213.73:8000/storage/v1/object/public/media/";
const NEW = "https://dearm.ai/api/media/";
const COMMIT = process.argv.includes("--commit");

const sql = postgres(DATABASE_URL, { prepare: false });

function log(msg: string) {
  console.log(msg);
}

log(`=== storage URL host swap (${COMMIT ? "COMMIT" : "DRY-RUN"}) ===`);
log(`old: ${OLD}`);
log(`new: ${NEW}`);
log("");

interface TargetSpec {
  table: string;
  column: string;
}

const TARGETS: TargetSpec[] = [
  { table: "characters", column: "avatar_url" },
  { table: "characters", column: "cover_image_url" },
  { table: "regex_rules", column: "replacement" },
  { table: "messages", column: "rendered_html" },
  { table: "users", column: "avatar_url" },
];

let totalMatched = 0;
let totalUpdated = 0;

for (const t of TARGETS) {
  const matchRows = await sql.unsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM ${t.table} WHERE ${t.column} LIKE $1`,
    [`%${OLD}%`],
  );
  const n = matchRows[0]?.n ?? 0;
  log(`${t.table}.${t.column}: ${n} 行匹配`);
  totalMatched += n;

  if (n === 0) continue;

  if (COMMIT) {
    const updated = await sql.unsafe(
      `UPDATE ${t.table}
       SET ${t.column} = REPLACE(${t.column}, $1, $2)
       WHERE ${t.column} LIKE $3`,
      [OLD, NEW, `%${OLD}%`],
    );
    const count = updated.count ?? 0;
    log(`  ✓ 已更新 ${count} 行`);
    totalUpdated += count;
  } else {
    // dry-run: 展示前 3 行 sample
    const sample = await sql.unsafe<Record<string, unknown>[]>(
      `SELECT id, ${t.column} AS val FROM ${t.table} WHERE ${t.column} LIKE $1 LIMIT 3`,
      [`%${OLD}%`],
    );
    for (const row of sample) {
      const val = String(row.val);
      const preview = val.length > 200 ? `${val.slice(0, 200)}…` : val;
      log(`  sample ${String(row.id).slice(0, 8)}: ${preview}`);
    }
  }
  log("");
}

log("=== 总计 ===");
log(`匹配行: ${totalMatched}`);
if (COMMIT) log(`已更新: ${totalUpdated}`);
else log("(dry-run, 未实际修改; 加 --commit 生效)");

await sql.end();
