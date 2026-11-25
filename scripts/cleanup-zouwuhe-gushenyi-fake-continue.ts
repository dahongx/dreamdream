#!/usr/bin/env bun
/**
 * 删 zou × 顾深意 那对旧版「继续」按钮残留:
 *   #16 user "继续" 2026-06-28 09:58:56
 *   #17 assistant claude-sonnet-4-6 3444 chars 2026-06-28 09:59:33
 *
 * 这是真·续写功能上线前的旧实现产物 —— sendMessage({text:"继续"}) 走完整
 * 一轮,语义上不正确;清掉后 session 末条回到 #15 那条被截断的 916 字符
 * gemini-3.1-pro-preview 回复,玩家可以重新用新版「续写」让 AI 接着说完。
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: "/root/projects/yearn-chat/.env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: !url.includes("-pooler.") });

const SESSION_ID = "1f7ca491-7609-44b3-9aaa-aa1c8189308e";
const TARGET_IDS = [
  "ff881611-b9a6-464b-9403-0e300f63e4d7", // #16 user "继续"
  "f49cb6ea-5eb1-4510-a262-548b36ea928f", // #17 assistant 新一轮回复
];

const before = await sql`
  SELECT id, role, created_at, length(content) AS clen,
         substring(content, 1, 60) AS preview
  FROM messages
  WHERE id IN ${sql(TARGET_IDS)} AND session_id = ${SESSION_ID}
  ORDER BY created_at ASC
`;
console.log(`匹配到 ${before.length} / ${TARGET_IDS.length} 条:`);
for (const r of before) {
  console.log(
    `  [${r.created_at?.toISOString?.() ?? r.created_at}] role=${r.role} len=${r.clen}  id=${r.id}`,
  );
  console.log(`    > ${r.preview}`);
}
if (before.length !== TARGET_IDS.length) {
  console.error(`\nabort: 数据漂移`);
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
