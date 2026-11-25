#!/usr/bin/env bun
/**
 * 二次清:zou × 权时焕 session 残留的 race 孤儿。
 * (cleanup-zouwuhe-orphan-ai.ts 上次只清了用户最初投诉的末两条 #20 #21)
 *
 * 保留判定:相邻 user 间隔 < 60s 才算 race(连点发)。
 *
 * 处理:
 *   #7 #8 #9    重复"你好"(20s 连发,保 #10)
 *   #12         孤儿 sonnet AI(跟 #11 同段)
 *   #17         重复"在吗"(保 #18)
 *
 * #2→#3 间隔 30 分钟 → 不是 race,不动。
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

const SESSION_ID = "76845643-86a1-4407-9012-e5decd4e590b";

const TARGET_IDS = [
  "d5559873-9930-4d02-9db4-c94e03d24556", // #7 user "你好" 07:19:48
  "1444fb1e-e162-453f-8782-76bcabce2fae", // #8 user "你好" 07:20:09
  "5790b5e2-0e83-4754-bcf3-f3ae8956c793", // #9 user "你好" 07:20:29
  "e7144ad6-8bd7-450f-ad98-ef801fae37c1", // #12 assistant sonnet 07:21:12
  "ee0b78c3-6c96-4b07-839e-15623fc2ce98", // #17 user "在吗" 07:22:12
];

const before = await sql`
  SELECT id, role, created_at, model, length(content) AS clen,
         substring(content, 1, 60) AS preview
  FROM messages
  WHERE id IN ${sql(TARGET_IDS)} AND session_id = ${SESSION_ID}
  ORDER BY created_at ASC
`;
console.log(`匹配到 ${before.length} / ${TARGET_IDS.length} 条:`);
for (const r of before) {
  const tag = r.role === "assistant" ? "[孤儿 AI]" : "[重复 user]";
  console.log(
    `  ${tag} [${r.created_at?.toISOString?.() ?? r.created_at}] role=${r.role} model=${r.model ?? "-"} len=${r.clen}`,
  );
  console.log(`     id=${r.id}  > ${r.preview}`);
}
if (before.length !== TARGET_IDS.length) {
  console.error(
    `\nabort: 期望 ${TARGET_IDS.length} 条,匹配 ${before.length} 条`,
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
