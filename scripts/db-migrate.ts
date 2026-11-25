#!/usr/bin/env bun
/**
 * Dearm DB migration runner ── independent of drizzle-kit migrate.
 *
 * Why this exists:
 *   drizzle-kit's migrate command only applies entries listed in
 *   drizzle/meta/_journal.json. Our 0001-0005 migrations were hand-written
 *   directly as .sql files (because they were the cleanest way to capture
 *   irreversible structural intent + the "why" comments) and never went
 *   through drizzle-kit generate, so the journal never knew about them.
 *   Result: `bun run db:migrate` cheerfully reported "✓ applied" while
 *   silently skipping 5/6 of our migrations. Found this the hard way when
 *   the 0005 css_enabled column was missing in dev DB.
 *
 * What this does instead:
 *   1. Maintain our own table __nimir_migrations(file_name PK, applied_at).
 *   2. Scan drizzle/*.sql in lexical order.
 *   3. For each file not in __nimir_migrations: split on
 *      `--> statement-breakpoint`, run each statement, then INSERT the
 *      file_name into __nimir_migrations.
 *   4. Idempotent: re-running does nothing once everything is applied.
 *
 * Modes:
 *   --backfill   mark every existing SQL file as already-applied without
 *                executing it. Use this exactly once on a DB whose schema
 *                is already in the target state (e.g. our current dev DB
 *                where 0000-0005 were already manually applied through
 *                various ad-hoc paths).
 *
 *   --dry-run    print what would happen, don't write.
 *
 * Future work: keep writing migrations as plain .sql under drizzle/.
 * drizzle-kit generate is fine for *authoring* the file (use the diff to
 * scaffold the SQL), but ignore its journal — the runner ignores it too.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing (check .env.local)");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const backfill = args.includes("--backfill");

// Neon's pooler endpoint runs PgBouncer in transaction mode and
// rejects named prepared statements; detect and disable them.
// Direct Neon endpoints and plain Postgres are unaffected.
const isNeonPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isNeonPooler });

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS "__nimir_migrations" (
    "file_name" text PRIMARY KEY,
    "applied_at" timestamptz NOT NULL DEFAULT now()
  )
`);

const dir = "drizzle";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const appliedRows = await sql<{ file_name: string }[]>`
  SELECT file_name FROM __nimir_migrations
`;
const applied = new Set(appliedRows.map((r) => r.file_name));

let touched = 0;
for (const f of files) {
  if (applied.has(f)) {
    continue;
  }

  if (backfill) {
    console.log(`◦ backfill mark ${f}`);
    if (!dryRun) {
      await sql`INSERT INTO __nimir_migrations (file_name) VALUES (${f})`;
    }
    touched++;
    continue;
  }

  const body = readFileSync(join(dir, f), "utf-8");
  const stmts = body
    .split(/--> statement-breakpoint/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 && !s.split("\n").every((l) => l.trim().startsWith("--")),
    );

  console.log(`→ apply ${f} (${stmts.length} statement(s))`);
  for (const stmt of stmts) {
    const first = stmt.split("\n").find((l) => !l.trim().startsWith("--"));
    console.log(`    ${(first ?? stmt).slice(0, 80)}`);
    if (!dryRun) await sql.unsafe(stmt);
  }
  if (!dryRun) {
    await sql`INSERT INTO __nimir_migrations (file_name) VALUES (${f})`;
  }
  touched++;
}

if (touched === 0) {
  console.log("✓ nothing to do; DB up to date");
} else if (dryRun) {
  console.log(`✓ dry-run: ${touched} file(s) would be processed`);
} else {
  console.log(`✓ done (${touched} file(s) ${backfill ? "marked" : "applied"})`);
}

await sql.end();
