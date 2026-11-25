#!/usr/bin/env bun
/**
 * Dearm characters.conversation_count 回填(新口径)
 *
 * 口径变更(2026-07-07):
 *   旧: 「有过 user message 的 session 数」——「一次对话 = 一段 session」。
 *       但用户视角"聊了这么多轮"跟"开了几个 session"不匹配,单个用户在一个
 *       session 里发 200 条也只算 1,数字看起来虚低。
 *   新: 「累计所有 user message 条数(所有用户、所有 session 加总)」。含
 *       fork 前被 superseded 掉的旧分叉尾巴——那也是用户真发过的字。
 *       api/chat/route.ts 侧改为每条 user 消息插入成功后 +1。
 *
 * What this does:
 *   c.conversation_count = COUNT(m.*) 满足 m.role = 'user'
 *                          AND m.session_id ∈ (chat_sessions where character_id = c.id)
 *
 *   不加 superseded_at 过滤——被 fork 截断的历史消息也算用户曾经的对话量。
 *   跟 api/chat +1 逻辑对齐(那边也不判 supersededAt,新写入必然为 NULL)。
 *
 * Modes:
 *   --dry-run   只 SELECT 算 diff,不写库(推荐先跑一次)
 *
 * Safety:
 *   - 幂等:跑多次结果一样,以 messages 表为唯一真源。
 *   - 不修改 messages / sessions,只覆盖 characters.conversation_count。
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing (check .env / .env.local)");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const isNeonPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isNeonPooler });

interface DiffRow {
  id: string;
  name: string;
  current_count: number;
  real_count: number;
}

const diffs = await sql<DiffRow[]>`
  WITH real_counts AS (
    SELECT
      c.id,
      c.name,
      c.conversation_count AS current_count,
      COALESCE(subq.cnt, 0)::int AS real_count
    FROM characters c
    LEFT JOIN (
      SELECT s.character_id, COUNT(*) AS cnt
      FROM messages m
      JOIN chat_sessions s ON s.id = m.session_id
      WHERE m.role = 'user'
      GROUP BY s.character_id
    ) subq ON subq.character_id = c.id
  )
  SELECT id, name, current_count, real_count
  FROM real_counts
  WHERE current_count IS DISTINCT FROM real_count
  ORDER BY (real_count - current_count) DESC, name ASC
`;

console.log(`scanned characters with drift: ${diffs.length}`);

if (diffs.length === 0) {
  console.log("nothing to backfill, conversation_count already aligned");
  await sql.end();
  process.exit(0);
}

const totalCurrent = diffs.reduce((a, r) => a + r.current_count, 0);
const totalReal = diffs.reduce((a, r) => a + r.real_count, 0);
console.log(
  `total drift: ${totalCurrent} → ${totalReal} (delta ${totalReal - totalCurrent})`,
);

const previewCount = Math.min(20, diffs.length);
console.log(`\ntop ${previewCount} largest drifts:`);
for (const r of diffs.slice(0, previewCount)) {
  console.log(
    `  ${r.name.padEnd(20)}  ${String(r.current_count).padStart(5)} → ${String(r.real_count).padStart(5)}  (${r.id})`,
  );
}

if (dryRun) {
  console.log("\n[dry-run] no writes. re-run without --dry-run to apply.");
  await sql.end();
  process.exit(0);
}

console.log(`\napplying updates to ${diffs.length} characters...`);

let applied = 0;
for (const r of diffs) {
  await sql`
    UPDATE characters
    SET conversation_count = ${r.real_count}
    WHERE id = ${r.id}
  `;
  applied++;
}

console.log(`done: ${applied} rows updated`);
await sql.end();
