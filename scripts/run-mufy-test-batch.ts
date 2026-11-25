#!/usr/bin/env bun
/** Runs inside the existing TEST app. One process, existing IDs, never PROD. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
type Row = {
  name: string;
  roleId: string;
  sourceKey: string;
  characterId: string;
  packId: string;
  promptHash: string;
  runtimeHash: string;
};
async function main() {
  const root = process.argv[2];
  const config = JSON.parse(
    await readFile(join(root, "batch-config.json"), "utf8"),
  ) as { scope: string; rows: Row[] };
  if (config.scope !== "TEST") throw Error("TEST only");
  const results = [];
  for (const row of config.rows) {
    if (
      ![row.roleId, row.characterId, row.packId].every((v) =>
        /^[a-f0-9-]{36}$/.test(v),
      ) ||
      !/^[a-zA-Z0-9_-]+$/.test(row.sourceKey)
    )
      throw Error("Invalid mapped IDs");
    const base = join(root, row.sourceKey),
      reportPath = join(base, "migration-report.json");
    for (const [file, hash] of [
      ["prompt.txt", row.promptHash],
      ["mufy-runtime.json", row.runtimeHash],
    ]) {
      if (
        createHash("sha256")
          .update(await readFile(join(base, file)))
          .digest("hex") !== hash
      )
        throw Error("Source hash mismatch");
    }
    const start = Date.now(),
      startedAt = new Date().toISOString();
    const child = spawnSync(
      process.execPath,
      [
        join(root, "migrate.cjs"),
        "--role",
        row.roleId,
        "--prompt-json",
        join(base, "prompt.txt"),
        "--runtime-json",
        join(base, "mufy-runtime.json"),
        "--report",
        reportPath,
        "--allow-missing-media",
        "--use-local-age",
        "--adapt-host-css",
        "--scope",
        "TEST",
        "--expected-db-host",
        "db",
        "--owner-email",
        "test@test.com",
        "--visibility",
        "private",
        "--update-character-id",
        row.characterId,
        "--pack-id",
        row.packId,
        "--commit",
      ],
      { encoding: "utf8", timeout: 120000, maxBuffer: 4096 * 1024 },
    );
    let report: { databaseWrite?: unknown } | null = null;
    if (child.status === 0)
      report = JSON.parse(await readFile(reportPath, "utf8"));
    const result = {
      name: row.name,
      roleId: row.roleId,
      startedAt,
      finishedAt: new Date().toISOString(),
      measuredExecutionMs: Date.now() - start,
      stage: report?.databaseWrite
        ? "written-test-awaiting-browser-acceptance"
        : "test-write-failed-or-needs-reconciliation",
      databaseWrite: report?.databaseWrite,
      targetUrl: "http://115.29.213.73:8091/chat/" + row.characterId,
      error: child.status === 0 ? undefined : child.stderr.length <= 2000 ? child.stderr : child.stderr.slice(0, 1000) + "\n[stack middle omitted]\n" + child.stderr.slice(-1000),
    };
    results.push(result);
    await writeFile(
      join(root, "batch-results.json"),
      JSON.stringify(
        { scope: "TEST", updatedAt: new Date().toISOString(), rows: results },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        name: row.name,
        status: child.status,
        stage: result.stage,
      }),
    );
    if (child.status !== 0) {
      process.exitCode = 2;
      break;
    }
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
