#!/usr/bin/env bun
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

// Fixed TEST destination, explicit commit, existing test owner. Never exports environment secrets.
if (!process.argv.includes("--commit"))
  throw new Error("Explicit --commit required");
const host = "115.29.213.73";
const dir = resolve("logs/mufy-profiles/full-20261013/pilot-5");
const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const checked = (await read(join(dir, "pilot-check.json"))) as {
  preferLocalAge?: boolean;
  adaptHostCss?: boolean;
  mediaPolicy?: string;
  audioPolicy: string;
  rows: {
    name: string;
    roleId: string;
    sourceKey: string;
    reportPath: string;
    stage: string;
  }[];
};
if (checked.audioPolicy !== "user-authorized-omit-unavailable-audio")
  throw new Error("Audio policy missing");
const remoteRoot = "/tmp/mufy-pilot-20261014-audio-optional";
type WriteRow = {
  name: string;
  roleId: string;
  stage: string;
  databaseWrite?: { characterId: string; packId: string };
};
let previous: WriteRow[] = [];
try {
  previous = (await read(join(dir, "test-write-summary.json"))).rows;
} catch (error) {
  if ((error as { code?: string }).code !== "ENOENT") throw error;
}
const remigrate = process.argv.includes("--remigrate");
async function run(args: string[], capture = false) {
  const started = performance.now();
  const proc = Bun.spawn(args, {
    stdout: capture ? "pipe" : "ignore",
    stderr: "pipe",
  });
  const timeout = setTimeout(() => proc.kill(), 60_000);
  const output = capture ? await new Response(proc.stdout).text() : "";
  const error = await new Response(proc.stderr).text();
  const code = await proc.exited;
  clearTimeout(timeout);
  if (code !== 0)
    throw new Error(`TEST operation failed (${code}): ${error.slice(0, 1200)}`);
  return { output, measuredExecutionMs: performance.now() - started };
}
const ssh = (command: string, capture = false) =>
  run(
    [
      "ssh",
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=10",
      `root@${host}`,
      command,
    ],
    capture,
  );
await ssh(`mkdir -p ${remoteRoot} && chmod 700 ${remoteRoot}`);
await run([
  "scp",
  "-q",
  join(dir, "migrate-mufy-card.cjs"),
  `root@${host}:${remoteRoot}/migrate.cjs`,
]);
await ssh(
  `cd /root/projects/yearn-chat && docker compose exec -T -u root app mkdir -p ${remoteRoot} && docker compose exec -T -u root app chmod 700 ${remoteRoot} && docker compose cp ${remoteRoot}/migrate.cjs app:${remoteRoot}/migrate.cjs`,
);
const rows: unknown[] = [];
await appendFile(join(dir,"write-attempt-history.jsonl"),JSON.stringify({updatedAt:new Date().toISOString(),rows:previous})+"\n");
for (const row of checked.rows.filter(
  (row) => row.stage === "ready-to-write-test-not-written",
).sort((a,b)=>Number(previous.some(value=>value.roleId===b.roleId&&value.databaseWrite))-Number(previous.some(value=>value.roleId===a.roleId&&value.databaseWrite)))) {
  const existing = previous.find((value) => value.roleId === row.roleId);
  if (existing && !existing.databaseWrite)
    throw new Error("Previous commit needs target reconciliation before retry");
  if (existing?.databaseWrite && !remigrate) {
    rows.push(existing);
    continue;
  }
  const update = existing?.databaseWrite;
  if (
    update &&
    (!/^[a-f0-9-]{36}$/.test(update.characterId) ||
      !/^[a-f0-9-]{36}$/.test(update.packId))
  )
    throw new Error("Invalid saved TEST target identifiers");
  if (
    !/^[a-zA-Z0-9_-]+$/.test(row.sourceKey) ||
    !/^[a-f0-9-]{36}$/.test(row.roleId)
  )
    throw new Error("Unsafe source identifiers");
  const local = join(dir, row.sourceKey);
  const approved = await read(row.reportPath);
  const promptHash = createHash("sha256")
    .update(await readFile(join(local, "prompt.txt")))
    .digest("hex");
  const runtimeHash = createHash("sha256")
    .update(await readFile(join(local, "mufy-runtime.json")))
    .digest("hex");
  if (
    approved.prepared.roleId !== row.roleId ||
    approved.source.promptFileSha256 !== promptHash ||
    approved.source.runtimeSnapshotSha256 !== runtimeHash ||
    approved.prepared.issues.some(
      (issue: { level: string }) => issue.level === "error",
    )
  )
    throw new Error(
      "TEST write source changed or did not pass migration checks",
    );
  const remote = `${remoteRoot}/${row.sourceKey}`;
  await ssh(`mkdir -p ${remote} && chmod 700 ${remote}`);
  for (const name of ["prompt.txt", "mufy-runtime.json"])
    await run([
      "scp",
      "-q",
      join(local, name),
      `root@${host}:${remote}/${name}`,
    ]);
  await ssh(
    `chmod 600 ${remote}/prompt.txt ${remote}/mufy-runtime.json && cd /root/projects/yearn-chat && docker compose cp ${remote} app:${remoteRoot}/`,
  );
  const startedAt = new Date().toISOString();
  try {
    const execution = await ssh(
      `cd /root/projects/yearn-chat && docker compose exec -T -u root app node ${remoteRoot}/migrate.cjs --role ${row.roleId} --prompt-json ${remote}/prompt.txt --runtime-json ${remote}/mufy-runtime.json --report ${remote}/migration-report.json --allow-missing-audio${checked.mediaPolicy === "user-authorized-omit-unavailable-media" ? " --allow-missing-media" : ""}${checked.preferLocalAge ? " --use-local-age" : ""}${checked.adaptHostCss ? " --adapt-host-css" : ""} --scope TEST --expected-db-host db --owner-email test@test.com --visibility private --commit${update ? ` --update-character-id ${update.characterId} --pack-id ${update.packId}` : ""}`,
    );
    // The report contains private Prompt fields: copy locally, expose only IDs and warnings in the summary.
    await ssh(
      `cd /root/projects/yearn-chat && docker compose cp app:${remote}/migration-report.json ${remote}/migration-report.json`,
    );
    await run([
      "scp",
      "-q",
      `root@${host}:${remote}/migration-report.json`,
      join(local, "test-write-report.json"),
    ]);
    const report = await read(join(local, "test-write-report.json"));
    rows.push({
      name: row.name,
      roleId: row.roleId,
      startedAt,
      finishedAt: new Date().toISOString(),
      measuredExecutionMs: execution.measuredExecutionMs,
      databaseWrite: report.databaseWrite,
      targetUrl: `http://${host}:8091/chat/${report.databaseWrite.characterId}`,
      stage: "written-test-awaiting-browser-acceptance",
      missingAudio: report.prepared.issues.filter(
        (issue: { code: string }) =>
          issue.code === "MISSING_AUDIO_OMITTED_WITH_APPROVAL",
      ),
    });
    console.log(
      JSON.stringify({
        name: row.name,
        stage: "written-test-awaiting-browser-acceptance",
        characterId: report.databaseWrite.characterId,
      }),
    );
  } catch (error) {
    rows.push({
      name: row.name,
      roleId: row.roleId,
      startedAt,
      finishedAt: new Date().toISOString(),
      stage: "test-write-failed-or-needs-reconciliation",
      error: error instanceof Error ? error.message : String(error),
    });
    // Never retry an ambiguous commit: reconcile the target before running again.
    break;
  }
}
await writeFile(
  join(dir, "test-write-summary.json"),
  JSON.stringify(
    {
      version: 1,
      scope: "TEST",
      host,
      updatedAt: new Date().toISOString(),
      visualAccepted: 0,
      rows: [...new Map([...previous,...rows].map(value => [(value as {roleId:string}).roleId,value])).values()],
    },
    null,
    2,
  ),
);
if (rows.some(value => (value as {stage:string}).stage === "test-write-failed-or-needs-reconciliation")) process.exitCode = 2;
