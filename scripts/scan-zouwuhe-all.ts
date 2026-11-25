#!/usr/bin/env bun
/**
 * 扫 zou (zouwuhe@163.com) 名下全部会话,找孤儿 AI / 重复 user。
 * --detail <sessionId>  仅 dump 指定 session 的逐条详情
 * 默认只列每条 session 的异常计数 + 角色卡名 + 总条数,便于决定要不要清。
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

const detailIdx = process.argv.indexOf("--detail");
const detailSessionId = detailIdx >= 0 ? process.argv[detailIdx + 1] : null;

const [user] = await sql`
  SELECT id, email FROM users WHERE email = 'zouwuhe@163.com'
`;
if (!user) {
  console.error("user not found");
  await sql.end();
  process.exit(0);
}
console.log(`user=${user.id}`);

const sessions = await sql`
  SELECT s.id, s.character_id, s.title, s.saved_at, s.created_at,
         s.last_message_at, c.name AS char_name
  FROM chat_sessions s
  LEFT JOIN characters c ON c.id = s.character_id
  WHERE s.user_id = ${user.id}
  ORDER BY s.last_message_at DESC NULLS LAST, s.created_at DESC
`;
console.log(`\n共 ${sessions.length} 会话\n`);

type Anomaly = {
  i: number;
  id: string;
  role: string;
  reason: "orphan_ai" | "dup_user";
  preview: string;
};

let totalSessionsWithAnomalies = 0;
let totalOrphanAi = 0;
let totalDupUser = 0;

for (const s of sessions) {
  const msgs = await sql`
    SELECT id, role, content, superseded_at, created_at, length(content) AS clen, model
    FROM messages
    WHERE session_id = ${s.id} AND superseded_at IS NULL
    ORDER BY created_at ASC
  `;

  const anomalies: Anomaly[] = [];
  let prevRole: string | null = null;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === "assistant" && i > 0 && prevRole !== "user") {
      anomalies.push({
        i: i + 1,
        id: m.id as string,
        role: m.role as string,
        reason: "orphan_ai",
        preview: (m.content as string).slice(0, 50).replace(/\s+/g, " "),
      });
    }
    if (
      m.role === "user" &&
      i < msgs.length - 1 &&
      msgs[i + 1].role === "user"
    ) {
      anomalies.push({
        i: i + 1,
        id: m.id as string,
        role: m.role as string,
        reason: "dup_user",
        preview: (m.content as string).slice(0, 50).replace(/\s+/g, " "),
      });
    }
    prevRole = m.role as string;
  }

  if (anomalies.length === 0 && !detailSessionId) continue;
  if (detailSessionId && s.id !== detailSessionId) continue;

  const orphanAi = anomalies.filter((a) => a.reason === "orphan_ai").length;
  const dupUser = anomalies.filter((a) => a.reason === "dup_user").length;
  totalOrphanAi += orphanAi;
  totalDupUser += dupUser;
  if (anomalies.length > 0) totalSessionsWithAnomalies++;

  console.log(
    `── ${s.char_name ?? "??"} · session=${s.id} · title="${s.title}" · ${msgs.length}条 · 孤儿AI=${orphanAi} 重复user=${dupUser}`,
  );

  if (detailSessionId === s.id) {
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const flag = anomalies.find((a) => a.i === i + 1);
      const tag = flag
        ? flag.reason === "orphan_ai"
          ? "⚠AI "
          : "⚠U  "
        : "    ";
      console.log(
        `  ${tag}#${i + 1} [${m.created_at?.toISOString?.() ?? m.created_at}] role=${m.role} model=${m.model ?? "-"} len=${m.clen}`,
      );
      if (flag) console.log(`      id=${m.id}  > ${flag.preview}`);
    }
  } else {
    for (const a of anomalies) {
      const tag = a.reason === "orphan_ai" ? "孤儿AI" : "重复user";
      console.log(`     [${tag}] #${a.i} id=${a.id}  > ${a.preview}`);
    }
  }
}

if (!detailSessionId) {
  console.log(
    `\n=== 汇总 ===\n含异常会话: ${totalSessionsWithAnomalies}\n孤儿 AI 总数: ${totalOrphanAi}\n重复 user 总数: ${totalDupUser}`,
  );
}

await sql.end();
