#!/usr/bin/env bun
/**
 * 清理 Gemini SAFETY 掐流留在 messages 里的污染 history。
 *
 * 背景：12e040e 前，Gemini finishReason=content-filter 时 6-7K chars 的
 * 半成品会入库（debug_info.truncatedBySafety=true）。这些半成品结尾
 * 通常处于 mode collapse (同一个词大量重复) 状态，会被 truncateHistory
 * 塞回下一轮 prompt，Gemini mirror 出来越滚越糟 —— 2026-07-05 婉清
 * × 谢寻会话「极其」复读根因。
 *
 * 12e040e 部署后 SAFETY 命中不再入库，但旧数据不会自愈。此脚本一次性
 * 清扫，之后不需要常态化跑。
 *
 * 安全：messages 是叶子表；currency_transactions.message_id 的 FK
 * delete_rule=SET NULL，账本记录保留，只把 message_id 断链。
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: "/root/projects/yearn-chat/.env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const isNeonPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isNeonPooler });

// dry-run: 打印范围
const rows = await sql<
  Array<{
    session_id: string;
    n: number;
    first_at: Date;
    last_at: Date;
  }>
>`
  SELECT session_id, count(*)::int AS n, min(created_at) AS first_at, max(created_at) AS last_at
  FROM messages
  WHERE role = 'assistant' AND debug_info->>'truncatedBySafety' = 'true'
  GROUP BY session_id
  ORDER BY n DESC
`;

const total = rows.reduce((acc, r) => acc + r.n, 0);
console.log(
  `即将清理 ${total} 条 truncatedBySafety=true 的 assistant 消息，分布在 ${rows.length} 个会话：`,
);
for (const r of rows) {
  console.log(
    `  session ${r.session_id}: ${r.n} 条 (${r.first_at.toISOString()} → ${r.last_at.toISOString()})`,
  );
}

if (total === 0) {
  console.log("\n无污染消息，无需清理。");
  await sql.end();
  process.exit(0);
}

if (process.argv.includes("--execute")) {
  const deleted = await sql`
    DELETE FROM messages
    WHERE role = 'assistant' AND debug_info->>'truncatedBySafety' = 'true'
    RETURNING id, session_id
  `;
  console.log(`\n已删除 ${deleted.length} 条。`);
} else {
  console.log("\n(dry-run, 加 --execute 才真删)");
}

await sql.end();
