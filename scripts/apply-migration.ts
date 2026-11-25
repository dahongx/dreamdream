import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("usage: bun scripts/apply-migration.ts <path-to-sql>");
  process.exit(1);
}

const body = readFileSync(sqlPath, "utf-8");
const stmts = body
  .split(/--> statement-breakpoint/)
  .map((s) => s.trim())
  .filter(
    (s) =>
      s.length > 0 && !s.split("\n").every((l) => l.trim().startsWith("--")),
  );

const sql = postgres(url, { max: 1 });
for (const stmt of stmts) {
  console.log(`→ ${stmt.split("\n")[0].slice(0, 80)}...`);
  await sql.unsafe(stmt);
}
await sql.end();
console.log("✓ applied");
