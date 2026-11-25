#!/usr/bin/env bun
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
if (!process.argv.includes("--commit"))
  throw Error("Explicit --commit required");
const attempt = new Date().toISOString().replace(/\D/g, "");
const dir = resolve("logs/mufy-profiles/full-20261013/pilot-5"),
  root = join(dir, "batch-" + attempt);
const remote = "/root/mufy-transfer-archive-20261015/mufy-batch-" + attempt,
  host = "root@115.29.213.73";
const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
const manifest = await read(join(dir, "manifest.json")),
  summary = await read(join(dir, "test-write-summary.json")),
  check = await read(join(dir, "pilot-check.json"));
await mkdir(root, { recursive: true });
// Recover only previously verified IDs, never infer that an interrupted write succeeded.
const checkpoints = (
  await readFile(join(dir, "write-attempt-history.jsonl"), "utf8")
)
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));
const rows = [];
for (const source of manifest.rows) {
  const target =
    summary.rows.find((r: { roleId: string }) => r.roleId === source.roleId)
      ?.databaseWrite ??
    [...checkpoints]
      .reverse()
      .flatMap((value) => value.rows ?? [])
      .find(
        (r: { roleId: string; databaseWrite?: unknown }) =>
          r.roleId === source.roleId && r.databaseWrite,
      )?.databaseWrite;
  if (
    !target ||
    ![target.characterId, target.packId, source.roleId].every((v) =>
      /^[a-f0-9-]{36}$/.test(v),
    )
  )
    throw Error("Must reconcile exact existing TEST targets first");
  const approved = check.rows.find(
    (r: { roleId: string }) => r.roleId === source.roleId,
  );
  if (!approved || approved.stage !== "ready-to-write-test-not-written")
    throw Error("Preflight required");
  const report = await read(approved.reportPath);
  if (
    report.prepared.issues.some((i: { level: string }) => i.level === "error")
  )
    throw Error("Blocking preflight issue");
  const base = join(root, source.sourceKey);
  await mkdir(base, { recursive: true });
  for (const file of ["prompt.txt", "mufy-runtime.json"]) {
    const buffer = await readFile(file === "mufy-runtime.json" ? source.runtimePath : source.promptPath);
    await writeFile(join(base, file), buffer);
  }
  const promptHash = createHash("sha256")
      .update(await readFile(join(base, "prompt.txt")))
      .digest("hex"),
    runtimeHash = createHash("sha256")
      .update(await readFile(join(base, "mufy-runtime.json")))
      .digest("hex");
  if (
    promptHash !== source.promptSha256 ||
    report.prepared.roleId !== source.roleId ||
    report.source.promptFileSha256 !== promptHash ||
    report.source.runtimeSnapshotSha256 !== runtimeHash
  )
    throw Error("Approved source changed");
  rows.push({
    name: source.name,
    sourceKey: source.sourceKey,
    roleId: source.roleId,
    characterId: target.characterId,
    packId: target.packId,
    promptHash,
    runtimeHash,
  });
}
await writeFile(
  join(root, "batch-config.json"),
  JSON.stringify({ scope: "TEST", rows }),
);
for (const [from, to] of [
  [join(dir, "migrate-mufy-card.cjs"), "migrate.cjs"],
  [join(dir, "run-mufy-test-batch.cjs"), "runner.cjs"],
])
  await writeFile(join(root, to), await readFile(from));
async function command(args: string[]) {
  const p = Bun.spawn(args, { stdout: "inherit", stderr: "inherit" });
  if (await p.exited)
    throw Error("Batch transfer/execution failed; reconcile before retry");
}
await command(["tar", "-cf", root + "-upload.tar", "-C", root, "."]);
await command([
  "scp",
  "-q",
  root + "-upload.tar",
  host + ":" + remote + ".tar",
]);
await command([
  "ssh",
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=10",
  host,
  `set -e; umask 077; mkdir -p ${remote}; tar -xf ${remote}.tar -C ${remote}; cd /root/projects/yearn-chat; docker compose exec -T -u root app mkdir -p /root/mufy-transfer-archive-20261015; docker compose cp ${remote} app:/root/mufy-transfer-archive-20261015/; set +e; docker compose exec -T -u root app node ${remote}/runner.cjs ${remote}; code=$?; set -e; docker compose cp app:${remote}/. ${remote}/; tar -cf ${remote}-results.tar -C ${remote} .; exit $code`,
]);
await command([
  "scp",
  "-q",
  host + ":" + remote + "-results.tar",
  root + "-results.tar",
]);
await command(["tar", "-xf", root + "-results.tar", "-C", root]);
const results = await read(join(root, "batch-results.json"));
await appendFile(
  join(dir, "write-attempt-history.jsonl"),
  JSON.stringify(summary) + "\n",
);
for (const row of rows)
  await writeFile(
    join(dir, row.sourceKey, "test-write-report.json"),
    await readFile(join(root, row.sourceKey, "migration-report.json")),
  );
await writeFile(
  join(dir, "test-write-summary.json"),
  JSON.stringify(
    {
      version: 1,
      scope: "TEST",
      host: "115.29.213.73",
      updatedAt: new Date().toISOString(),
      visualAccepted: 0,
      rows: results.rows,
    },
    null,
    2,
  ),
);
