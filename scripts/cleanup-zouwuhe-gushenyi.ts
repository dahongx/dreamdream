#!/usr/bin/env bun
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

// 推荐清理:删 6 条孤儿 AI(同段连发重复响应) + 6 条重复 user(保留每段最后一条
// 即真正得到回复的那条)。
// 详细对应见 query-zouwuhe-character.ts 输出。
const ORPHAN_AI = [
  // 区段 A: #16 #17 在 #15 之后,#18 user 才发起新一轮
  "93d41665-813d-48a8-a58d-65b83f43cbad", // #16 gemini 06-20 09:59:57
  "37dc1d58-9983-4306-b6ce-56c2b99841d7", // #17 gemini 06-20 10:00:32
  // 区段 B: #28 #29 在 #27 之后,#30 user
  "bb41b621-054a-4166-b6f4-021a42f3996a", // #28 sonnet 06-26 02:16:42
  "d970b9ff-923b-42ea-b52f-908be30b0438", // #29 sonnet 06-26 02:17:04
  // 区段 B 续: #34 #35 在 #33 之后(末尾)
  "93d82d21-7056-471a-8c61-91ece82bef60", // #34 sonnet 06-26 02:19:05
  "bf952a06-70d0-4f7c-833c-b7396eca0989", // #35 sonnet 06-26 02:19:13
];

const DUPLICATE_USER = [
  // #10 #11 重复 "我要回家",#12 是真正得到回复的那条
  "ed4b48c9-0955-4eae-8440-3d223869b29c", // #10 06-20 09:58:46
  "742c6ed2-f75d-4d96-b922-58a3b177a010", // #11 06-20 09:59:06
  // #22 #23 重复 "你好",#24 是得到回复的那条
  "597e4fd6-39c7-4da4-bf9e-735212aca884", // #22 06-26 02:15:13
  "d56c6657-887d-4d85-bab2-2a38264f9d78", // #23 06-26 02:15:33
  // #30 #31 重复 "在吗",#32 是得到回复的那条
  "5584c8c9-81df-4cc4-b775-a03d972d67ae", // #30 06-26 02:17:17
  "565244ba-a0b3-4cef-8b35-3209d5f1d188", // #31 06-26 02:17:37
];

const TARGET_IDS = [...ORPHAN_AI, ...DUPLICATE_USER];

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
    `\n期望 ${TARGET_IDS.length} 条,匹配 ${before.length} 条 —— 数据漂移,abort。`,
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
