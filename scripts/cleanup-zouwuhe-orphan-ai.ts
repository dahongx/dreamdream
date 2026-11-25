#!/usr/bin/env bun
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

const SESSION_ID = "76845643-86a1-4407-9012-e5decd4e590b";
const TARGET_IDS = [
  "2c0e85ed-ec3d-40f0-b904-18c876d531be", // #20 sonnet 2026-06-26T07:23:00
  "4484cb09-2600-4e5c-aaa9-35c6567dfea2", // #21 gemini-3.1-pro-preview 2026-06-26T07:23:19
];

// 先 dry-run 确认要删的是我们以为的那两条
const before = await sql`
  SELECT id, role, created_at, model, length(content) AS clen
  FROM messages
  WHERE id IN ${sql(TARGET_IDS)} AND session_id = ${SESSION_ID}
`;
console.log("将要删除：");
for (const r of before) {
  console.log(
    `  [${r.created_at?.toISOString?.() ?? r.created_at}] role=${r.role} model=${r.model ?? "-"} len=${r.clen} id=${r.id}`,
  );
}
if (before.length !== TARGET_IDS.length) {
  console.error(
    `期望删 ${TARGET_IDS.length} 条，匹配到 ${before.length} 条；abort。`,
  );
  await sql.end();
  process.exit(1);
}

if (process.argv.includes("--execute")) {
  const deleted = await sql`
    DELETE FROM messages
    WHERE id IN ${sql(TARGET_IDS)} AND session_id = ${SESSION_ID}
    RETURNING id
  `;
  console.log(`\n已删除 ${deleted.length} 条。`);
} else {
  console.log("\n(dry-run, 加 --execute 才真删)");
}

await sql.end();
