#!/usr/bin/env bun
import { config } from "dotenv";
import postgres from "postgres";

config({ path: "/root/projects/yearn-chat/.env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const charName = process.argv[2] ?? "顾深意";
const sql = postgres(url, { max: 1, prepare: !url.includes("-pooler.") });

const users = await sql`
  SELECT id, email, name FROM users WHERE email = 'zouwuhe@163.com'
`;
if (users.length === 0) {
  console.error("user not found");
  await sql.end();
  process.exit(0);
}
const userId = users[0].id;
console.log(`user=${userId} (${users[0].name})`);

const chars = await sql`
  SELECT id, name, owner_id FROM characters WHERE name LIKE ${`%${charName}%`}
`;
console.log(`\n角色卡 like %${charName}%:`);
for (const c of chars) console.log(`  ${c.id}  ${c.name}  owner=${c.owner_id}`);
if (chars.length === 0) {
  await sql.end();
  process.exit(0);
}

for (const ch of chars) {
  const sessions = await sql`
    SELECT id, title, saved_at, created_at, last_message_at
    FROM chat_sessions
    WHERE user_id = ${userId} AND character_id = ${ch.id}
    ORDER BY created_at DESC
  `;
  console.log(
    `\n========== ${ch.name} (${ch.id}) — ${sessions.length} 会话 ==========`,
  );

  for (const s of sessions) {
    const msgs = await sql`
      SELECT id, role, content, superseded_at, created_at, length(content) AS clen, model
      FROM messages
      WHERE session_id = ${s.id}
      ORDER BY created_at ASC
    `;
    console.log(
      `\n--- Session ${s.id} (${s.title}) — ${msgs.length} 条 saved=${s.saved_at ? "Y" : "N"} ---`,
    );

    // 找孤儿 / 异常模式
    type Row = (typeof msgs)[number];
    const anomalies: Array<{ i: number; m: Row; reason: string }> = [];
    let prevRole: string | null = null;
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      // 孤儿 assistant: 不是开场白 (i>0) + 前一条不是 user
      if (m.role === "assistant" && i > 0 && prevRole !== "user") {
        anomalies.push({ i, m, reason: "AI 回复前面不是 user" });
      }
      // 孤儿 user: 后面跟着另一条 user (没等到 AI 就再发)
      if (
        m.role === "user" &&
        i < msgs.length - 1 &&
        msgs[i + 1].role === "user"
      ) {
        anomalies.push({ i, m, reason: "user 后面又是 user (没收到 AI)" });
      }
      prevRole = m.role;
    }

    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const flag = anomalies.find((a) => a.i === i);
      const preview = (m.content as string).slice(0, 60).replace(/\s+/g, " ");
      console.log(
        `  ${flag ? "⚠ " : "  "}#${i + 1} [${m.created_at?.toISOString?.() ?? m.created_at}] role=${m.role} sup=${m.superseded_at ? "Y" : "N"} model=${m.model ?? "-"} len=${m.clen} ${flag ? `← ${flag.reason}` : ""}`,
      );
      if (flag) console.log(`     id=${m.id}  > ${preview}`);
    }
    if (anomalies.length > 0) {
      console.log(`  >>> 共 ${anomalies.length} 处异常`);
    }
  }
}

await sql.end();
