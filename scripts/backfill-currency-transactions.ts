#!/usr/bin/env bun
/**
 * Dearm 货币流水回填
 *
 * Why this exists:
 *   deduct/refundCurrency 历来只改 users.{gold,silver}_balance，从来不往
 *   currency_transactions 表写流水（详见 fix-currency-transactions-log 分支
 *   的修复 commit）。所以个人主页"货币消耗"列表里看不到任何"对话扣费"
 *   或"美化包/图片生成扣费"记录——尽管余额确实减少了。
 *
 *   修复合并后只对新发生的扣费有效。这个脚本一次性把历史扣费按
 *   messages 表里已记录的 (currency_type, currency_amount, model) 反推
 *   一条 currency_transactions 行补回去，确保历史"货币消耗"也能看见。
 *
 * What this does:
 *   对每条 messages 行（role=assistant、currency_type 非空、currency_amount > 0），
 *   若 currency_transactions 里没有 message_id 等于此 id 的行，则补一条：
 *     transaction_type = 'model_usage'
 *     currency_type    = msg.currency_type
 *     amount           = -msg.currency_amount        （负数 = 扣费）
 *     balance_after    = 0                            （UI 没展示，留 0）
 *     model_id         = msg.model
 *     message_id       = msg.id                       （前端 join 出角色名）
 *     note             = NULL                         （走"聊天 - 角色名"渲染）
 *     created_at       = msg.created_at
 *
 *   美化包 / 图片生成的历史扣费没有 messages 行可以反推，无法补回——
 *   这部分历史数据丢失。新发生的扣费一切正常。
 *
 * Modes:
 *   --dry-run   只算不写，打印 per-user 概览
 *   --limit N   只处理前 N 行（开发用）
 *
 * Safety:
 *   - 幂等：以 message_id 为去重 key，跑多次不会重复插
 *   - 单事务批量插，500 行一批
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing (check .env.local)");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const limit =
  limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1] ?? "0", 10) : 0;

const isNeonPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isNeonPooler });

interface MissingRow {
  message_id: string;
  user_id: string;
  currency_type: "gold" | "silver";
  currency_amount: number;
  model: string;
  created_at: Date;
}

// LEFT JOIN currency_transactions ON message_id ...
// IS NULL = 历史扣费缺流水。messages.role 必须是 assistant（user 行不扣费），
// 且 currency_type 非空、currency_amount > 0 才是真正发生过扣费。
const limitSql = limit > 0 ? sql`LIMIT ${limit}` : sql``;
const missing = await sql<MissingRow[]>`
  SELECT m.id AS message_id,
         cs.user_id,
         m.currency_type,
         m.currency_amount,
         m.model,
         m.created_at
    FROM messages m
    INNER JOIN chat_sessions cs ON cs.id = m.session_id
    LEFT JOIN currency_transactions ct ON ct.message_id = m.id
   WHERE m.role = 'assistant'
     AND m.currency_type IS NOT NULL
     AND m.currency_amount IS NOT NULL
     AND m.currency_amount > 0
     AND m.model IS NOT NULL
     AND ct.id IS NULL
   ORDER BY m.created_at ASC
   ${limitSql}
`;

console.log(`scanned: ${missing.length} 条 messages 缺流水`);

if (missing.length === 0) {
  console.log("\n✓ 没有需要回填的行");
  await sql.end();
  process.exit(0);
}

// per-user 概览
const perUser = new Map<
  string,
  { gold: number; silver: number; count: number }
>();
for (const r of missing) {
  const s = perUser.get(r.user_id) ?? { gold: 0, silver: 0, count: 0 };
  s.count++;
  if (r.currency_type === "gold") s.gold += r.currency_amount;
  else s.silver += r.currency_amount;
  perUser.set(r.user_id, s);
}

console.log("\n=== per-user backfill 概览 ===");
console.log(
  "user_id                                rows   gold_spent  silver_spent",
);
for (const [uid, s] of [...perUser.entries()].sort(
  (a, b) => b[1].count - a[1].count,
)) {
  console.log(
    `${uid}  ${String(s.count).padStart(4)}   ${String(s.gold).padStart(10)}   ${String(s.silver).padStart(11)}`,
  );
}

if (dryRun) {
  console.log("\n--dry-run set; no writes performed");
  await sql.end();
  process.exit(0);
}

console.log(`\n开始回填 ${missing.length} 条流水...`);

const CHUNK = 500;
let written = 0;
for (let i = 0; i < missing.length; i += CHUNK) {
  const batch = missing.slice(i, i + CHUNK);
  await sql.begin(async (tx) => {
    for (const r of batch) {
      await tx`
        INSERT INTO currency_transactions
          (user_id, transaction_type, currency_type, amount, balance_after,
           model_id, message_id, note, created_at)
        VALUES
          (${r.user_id}, 'model_usage', ${r.currency_type},
           ${-r.currency_amount}, 0, ${r.model}, ${r.message_id},
           NULL, ${r.created_at})
      `;
    }
  });
  written += batch.length;
  console.log(`  ${written}/${missing.length}`);
}

console.log(`\n✓ done; ${written} 条流水补录完成`);
await sql.end();
