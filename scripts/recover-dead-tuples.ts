#!/usr/bin/env bun
/**
 * 死马当活马医：用 pageinspect 扫 regex_rules 的 heap pages，看 6/21 02:59
 * 那次手动 SQL 删的状态栏规则是否还有 dead tuples 没被 autovacuum 回收。
 *
 * 流程：
 *   1. 打印 pg_stat_user_tables 的 last_vacuum / last_autovacuum / n_dead_tup
 *      —— 如果 autovacuum 1+ 小时前就跑过且 n_dead_tup=0，基本可以放弃了
 *   2. CREATE EXTENSION pageinspect (需要 superuser)
 *   3. 扫 regex_rules 全部 heap pages 的 heap_page_items
 *   4. 把 t_xmax > 0（被删除标记）的 tuple 用 tuple_data_split 解码
 *   5. 字符串匹配 6 张点名卡的 pack_id，如果 hit 就 dump 出来
 *
 * 只读，不写库。
 *
 * Usage:
 *   bun scripts/recover-dead-tuples.ts
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const isNeonPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isNeonPooler });

// 7b5e3b7 commit 点名的 6 张卡对应的 pack_id（从前面 --all 输出抓的）
const TARGET_PACK_NAMES = [
  "Sitthikorn（西提空） 的美化包",
  "江澈 的美化包",
  "谢寻 的美化包",
  "顾深意 的美化包",
  "姜淮聿 的美化包",
  "萧予夺 的美化包",
];

// ============================================================
// Step 1: 表统计 —— 看 autovacuum 是否已经清过
// ============================================================
console.log("=".repeat(80));
console.log("Step 1: regex_rules 表统计");
console.log("=".repeat(80));

interface StatRow {
  relname: string;
  n_live_tup: number;
  n_dead_tup: number;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  vacuum_count: number;
  autovacuum_count: number;
  n_tup_del: number;
  n_tup_upd: number;
  table_size_kb: number;
}
const [stats] = await sql<StatRow[]>`
  SELECT
    s.relname,
    s.n_live_tup,
    s.n_dead_tup,
    s.last_vacuum,
    s.last_autovacuum,
    s.vacuum_count,
    s.autovacuum_count,
    s.n_tup_del,
    s.n_tup_upd,
    pg_total_relation_size('regex_rules') / 1024 AS table_size_kb
  FROM pg_stat_user_tables s
  WHERE s.relname = 'regex_rules'
`;

if (!stats) {
  console.log("找不到 regex_rules 表统计");
  await sql.end();
  process.exit(1);
}

console.log(`  live tuples:           ${stats.n_live_tup}`);
console.log(`  dead tuples (现存):    ${stats.n_dead_tup}`);
console.log(`  累计 DELETE 次数:      ${stats.n_tup_del}`);
console.log(`  累计 UPDATE 次数:      ${stats.n_tup_upd}`);
console.log(`  last_vacuum (手动):    ${stats.last_vacuum ?? "(从未)"}`);
console.log(`  last_autovacuum:       ${stats.last_autovacuum ?? "(从未)"}`);
console.log(
  `  vacuum 次数 / autovac 次数: ${stats.vacuum_count} / ${stats.autovacuum_count}`,
);
console.log(`  表总大小 (含 toast):   ${stats.table_size_kb} KB`);

if (stats.n_dead_tup === 0 && stats.autovacuum_count > 0) {
  console.log(
    `\n  ⚠️  n_dead_tup=0 且 autovacuum 跑过 ${stats.autovacuum_count} 次。`,
  );
  console.log(
    "      被删的 tuple 几乎肯定已经被回收，pageinspect 不太可能找到。",
  );
  console.log("      继续扫一下看运气。");
}

// ============================================================
// Step 2: 检查 pageinspect 是否可用（不自己 CREATE，supabase 的 postgres
// role 没 superuser 权限装不上，要 supabase_admin 提前一次性装好）
// ============================================================
console.log(`\n${"=".repeat(80)}`);
console.log("Step 2: 检查 pageinspect 是否可用");
console.log("=".repeat(80));
const [{ installed }] = await sql<{ installed: boolean }[]>`
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pageinspect'
  ) AS installed
`;
if (!installed) {
  console.log("  ✗ pageinspect 未安装。需要 supabase_admin 一次性装上：");
  console.log("");
  console.log(
    "    docker compose exec supabase-db psql -U supabase_admin -d postgres -c 'CREATE EXTENSION IF NOT EXISTS pageinspect;'",
  );
  console.log("");
  console.log("    装好后再跑本脚本。");
  await sql.end();
  process.exit(1);
}
console.log("  ✓ pageinspect 已安装");

// ============================================================
// Step 3: 扫所有 heap pages，找带 deleted 标记的 tuple
// ============================================================
console.log(`\n${"=".repeat(80)}`);
console.log("Step 3: 扫 regex_rules 所有 heap pages");
console.log("=".repeat(80));

interface PageInfo {
  pages: number;
}
const [pageInfo] = await sql<PageInfo[]>`
  SELECT pg_relation_size('regex_rules') / 8192 AS pages
`;
console.log(`  regex_rules 主 heap 共 ${pageInfo.pages} 页`);

if (pageInfo.pages === 0) {
  console.log("  表空，无法扫");
  await sql.end();
  process.exit(0);
}

// 注意：被 vacuum 回收的 tuple 即便 lp 还在，t_data 会被清成 NULL
// 死马当活马医：先找 t_xmax > 0（标记删除）AND lp_len > 0（数据还在）
interface DeadTuple {
  page_no: number;
  lp: number;
  t_xmin: string | null;
  t_xmax: string | null;
  lp_len: number;
  t_data: string; // hex
}

const deadTuples: DeadTuple[] = [];
const recyclableLps: number[] = [];
for (let pno = 0; pno < pageInfo.pages; pno++) {
  const items = await sql<
    {
      lp: number;
      t_xmin: string | null;
      t_xmax: string | null;
      lp_len: number;
      t_data: Buffer | null;
    }[]
  >`
    SELECT lp, t_xmin, t_xmax, lp_len, t_data
    FROM heap_page_items(get_raw_page('regex_rules', ${pno}))
  `;
  for (const it of items) {
    const xmaxNum = it.t_xmax ? Number(it.t_xmax) : 0;
    if (xmaxNum > 0 && it.t_data && it.lp_len > 0) {
      deadTuples.push({
        page_no: pno,
        lp: it.lp,
        t_xmin: it.t_xmin,
        t_xmax: it.t_xmax,
        lp_len: it.lp_len,
        t_data: it.t_data.toString("hex"),
      });
    } else if (xmaxNum > 0 && (!it.t_data || it.lp_len === 0)) {
      recyclableLps.push(it.lp);
    }
  }
}

console.log(
  `  找到 ${deadTuples.length} 个带 t_xmax 标记且 t_data 还在的 tuple`,
);
console.log(
  `  另有 ${recyclableLps.length} 个 lp 已被 vacuum 回收（t_data=NULL）`,
);

// ============================================================
// Step 4: 解码 dead tuples，字符串匹配目标 pack
// ============================================================
console.log(`\n${"=".repeat(80)}`);
console.log("Step 4: 解码 dead tuples");
console.log("=".repeat(80));

if (deadTuples.length === 0) {
  console.log("  ⚠️  没有任何带数据的 dead tuple，pageinspect 死活不能恢复。");
  console.log(
    "\n  → 只能回到来源平台现场，用浏览器开发者工具把角色卡 / 美化原文重新导出一份。",
  );
  await sql.end();
  process.exit(0);
}

// regex_rules 表的字段顺序 (id uuid, pack_id uuid, name varchar, target_text text,
// pattern text, replacement text, variable_mapping jsonb, output_guidance text,
// enabled bool, visible bool, order_index int4, created_at timestamptz, updated_at timestamptz)
// 用 tuple_data_split 反编码出 binary 字段
// 这步比较折腾，先简单字符串匹配 hex 看有没有目标特征字
const TARGET_BYTES = TARGET_PACK_NAMES.flatMap((n) => [
  Buffer.from(n, "utf8").toString("hex"),
]);
const STATUS_BAR_HINTS = [
  Buffer.from("状态栏", "utf8").toString("hex"),
  Buffer.from("好感度", "utf8").toString("hex"),
  Buffer.from("affection", "utf8").toString("hex"),
];

let hits = 0;
for (const dt of deadTuples) {
  const hex = dt.t_data;
  const nameHit = TARGET_BYTES.some((tb) => hex.includes(tb));
  const statusHit = STATUS_BAR_HINTS.some((sb) => hex.includes(sb));
  if (nameHit || statusHit) {
    hits++;
    console.log(
      `\n  HIT #${hits}: page=${dt.page_no} lp=${dt.lp} xmin=${dt.t_xmin} xmax=${dt.t_xmax} lp_len=${dt.lp_len}`,
    );
    console.log(`    hits: name=${nameHit} status=${statusHit}`);
    // 试解 utf8 看看里面到底是啥
    const buf = Buffer.from(hex, "hex");
    let preview = "";
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c >= 0x20 && c < 0x7f) preview += String.fromCharCode(c);
      else if (c >= 0xe0) {
        // multi-byte UTF-8 start, try to read 3 bytes
        try {
          preview += buf
            .subarray(i, Math.min(i + 3, buf.length))
            .toString("utf8");
          i += 2;
        } catch {
          preview += ".";
        }
      } else preview += ".";
    }
    console.log(`    preview: ${preview.slice(0, 400)}`);
  }
}

console.log(`\n  HIT 总数: ${hits} / ${deadTuples.length} dead tuples`);
if (hits === 0) {
  console.log("\n  ⚠️  没有任何 dead tuple 命中目标 pack 名 / 状态栏关键词。");
  console.log("     pageinspect 路确实死了。走 F12 路径恢复。");
} else {
  console.log(
    "\n  ✓ 有命中！把 preview 内容拼起来人工识别出 rule 字段，再 INSERT 回 regex_rules。",
  );
  console.log("    需要手工组装，告诉我命中内容我帮你写恢复 SQL。");
}

await sql.end();
