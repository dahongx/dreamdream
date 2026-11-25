#!/usr/bin/env bun
import { config } from "dotenv";
import postgres from "postgres";

// Load env from main repo since worktree doesn't have its own .env
config({ path: "/root/projects/yearn-chat/.env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const isNeonPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isNeonPooler });

const users = await sql`
  SELECT id, email, name FROM users WHERE email = 'zouwuhe@163.com'
`;
console.log("用户:", users);

if (users.length === 0) {
  await sql.end();
  process.exit(0);
}
const userId = users[0].id;

const chars = await sql`
  SELECT id, name, owner_id FROM characters WHERE name LIKE '%权时焕%'
`;
console.log("\n角色卡:", chars);

if (chars.length === 0) {
  await sql.end();
  process.exit(0);
}
const charId = chars[0].id;

const sessions = await sql`
  SELECT id, user_id, character_id, title, saved_at, created_at
  FROM chat_sessions
  WHERE user_id = ${userId} AND character_id = ${charId}
  ORDER BY created_at DESC
`;
console.log(`\n会话(${sessions.length}):`, sessions);

for (const s of sessions) {
  const msgs = await sql`
    SELECT id, role, content, superseded_at, created_at, length(content) AS clen, model
    FROM messages
    WHERE session_id = ${s.id}
    ORDER BY created_at ASC
  `;
  console.log(`\n=== Session ${s.id} (${s.title}) — ${msgs.length} 条 ===`);
  for (const m of msgs) {
    const preview =
      typeof m.content === "string"
        ? m.content.slice(0, 120).replace(/\s+/g, " ")
        : String(m.content).slice(0, 120);
    console.log(
      `  [${m.created_at?.toISOString?.() ?? m.created_at}] role=${m.role} sup=${m.superseded_at ? "Y" : "N"} model=${m.model ?? "-"} len=${m.clen} id=${m.id}`,
    );
    console.log(`    > ${preview}`);
  }
}

await sql.end();
