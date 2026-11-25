#!/usr/bin/env bun
/**
 * Dearm 货币流水 session_id 回填
 *
 * Why this exists:
 *   currency_transactions 表新增 session_id 列后（migration 0029），新发生的聊天/
 *   续写扣费会直接写 session_id，账本 UI 不再依赖 message_id 链路。但是历史数据：
 *
 *   1. messageId 已挂的行：通过 messages.session_id 反查能直接补 session_id。
 *   2. messageId 为 NULL 的「聊天」/「续写」流水：这是历史 bug —— 流式 onError
 *      路径既没退币也没 linkTransactionToMessage，留下了一批裸的「聊天 -1」记录。
 *      改不回这些币（用户已经知道扣了），但可以按 user_id + created_at 邻近时间窗
 *      去匹配同一用户那个时刻在哪个 session 里活动，把 session_id 补上，UI 至少
 *      能显示「聊天 - 角色名」让账本可读。
 *
 * What this does:
 *   阶段一（确定性）：
 *     UPDATE currency_transactions
 *       SET session_id = m.session_id
 *       FROM messages m
 *       WHERE m.id = currency_transactions.message_id
 *         AND currency_transactions.session_id IS NULL
 *         AND currency_transactions.message_id IS NOT NULL;
 *
 *   阶段二（启发式，仅 note IN ('聊天','续写','退款 - …') 且 session_id 仍 NULL）：
 *     按 (user_id, created_at) 在 chat_sessions 表找 lastMessageAt 距交易时间最近
 *     且差距 ≤ 10 分钟、且当时归属该 user 的 session。匹配成功就回填。匹配不到就
 *     跳过（保持 NULL，UI 仍显示「聊天」无角色名 —— 比错猜一个 session 安全）。
 *
 * Modes:
 *   --dry-run  只算不写，打印 per-stage 概览
 *
 * Safety:
 *   - 幂等：每次跑都只动 session_id 仍为 NULL 的行
 *   - 阶段二走时间窗启发，宁可少补也不错补
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

const isNeonPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isNeonPooler });

// 阶段一：通过 message_id 反查
console.log("─ Stage 1: backfill via message_id → messages.session_id");
const stage1Sample = await sql<{ count: number }[]>`
  SELECT COUNT(*)::int AS count
  FROM currency_transactions ct
  JOIN messages m ON m.id = ct.message_id
  WHERE ct.session_id IS NULL
    AND ct.message_id IS NOT NULL
`;
const stage1Total = stage1Sample[0]?.count ?? 0;
console.log(`  candidates: ${stage1Total}`);

if (!dryRun && stage1Total > 0) {
  const stage1Done = await sql`
    UPDATE currency_transactions ct
    SET session_id = m.session_id
    FROM messages m
    WHERE m.id = ct.message_id
      AND ct.session_id IS NULL
      AND ct.message_id IS NOT NULL
  `;
  console.log(`  updated: ${stage1Done.count}`);
}

// 阶段二：messageId 为 NULL 的「聊天」/「续写」/退款流水，按时间窗匹配 session
console.log(
  "\n─ Stage 2: heuristic backfill via user_id + nearby session activity",
);

const TIME_WINDOW_MS = 10 * 60 * 1000; // 10 分钟

interface Orphan {
  id: string;
  user_id: string;
  created_at: Date;
  note: string | null;
}

const orphans = await sql<Orphan[]>`
  SELECT id, user_id, created_at, note
  FROM currency_transactions
  WHERE session_id IS NULL
    AND message_id IS NULL
    AND transaction_type = 'model_usage'
    AND (
      note = '聊天'
      OR note = '续写'
      OR note LIKE '退款 - 续写%'
      OR note LIKE '退款 - 流式%'
      OR note LIKE '退款 - 安全%'
    )
  ORDER BY created_at
`;
console.log(`  orphans: ${orphans.length}`);

let matched = 0;
let ambiguous = 0;
let nohit = 0;

for (const o of orphans) {
  const lo = new Date(o.created_at.getTime() - TIME_WINDOW_MS);
  const hi = new Date(o.created_at.getTime() + TIME_WINDOW_MS);

  // 找时间窗内 lastMessageAt 离交易时间最近的 session
  const hits = await sql<{ id: string; gap_ms: number }[]>`
    SELECT id,
           ABS(EXTRACT(EPOCH FROM (last_message_at - ${o.created_at})) * 1000)::bigint AS gap_ms
    FROM chat_sessions
    WHERE user_id = ${o.user_id}
      AND last_message_at IS NOT NULL
      AND last_message_at BETWEEN ${lo} AND ${hi}
    ORDER BY gap_ms
    LIMIT 2
  `;

  if (hits.length === 0) {
    nohit++;
    continue;
  }
  // 两个候选差距都很小（< 30s）就判模糊，避免错挂
  if (
    hits.length === 2 &&
    hits[1] &&
    hits[0] &&
    hits[1].gap_ms - hits[0].gap_ms < 30_000
  ) {
    ambiguous++;
    continue;
  }

  const winner = hits[0];
  if (!winner) {
    nohit++;
    continue;
  }
  matched++;
  if (!dryRun) {
    await sql`
      UPDATE currency_transactions
      SET session_id = ${winner.id}::uuid
      WHERE id = ${o.id}
    `;
  }
}

console.log(`  matched: ${matched}`);
console.log(`  ambiguous (skipped): ${ambiguous}`);
console.log(`  no hit (skipped): ${nohit}`);

if (dryRun) {
  console.log("\n(dry-run; no rows written)");
} else {
  console.log("\n✓ done");
}

await sql.end();
