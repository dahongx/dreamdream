#!/usr/bin/env bun
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("Usage: bun scripts/query-session-stats.ts <session-id>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(url);

const result = await sql`
  SELECT
    COUNT(*) as message_count,
    SUM(COALESCE((debug_info->>'input_tokens')::int, 0)) as total_input_tokens,
    SUM(COALESCE((debug_info->>'output_tokens')::int, 0)) as total_output_tokens,
    SUM(COALESCE((debug_info->>'input_tokens')::int, 0) + COALESCE((debug_info->>'output_tokens')::int, 0)) as total_tokens,
    SUM(LENGTH(content)) as total_content_length
  FROM messages
  WHERE session_id = ${sessionId}
`;

console.log(JSON.stringify(result[0], null, 2));
await sql.end();
