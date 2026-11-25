#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

// Preparation only: original Prompt is private; no database writes or approval overrides.
const dir = resolve(process.argv[2] ?? "logs/mufy-profiles/full-20261013");
const count = Number(process.argv[3] ?? 5);
if (!Number.isSafeInteger(count) || count < 1 || count > 100)
  throw new Error("Invalid pilot size");
const startedAt = new Date().toISOString();
const started = performance.now();
const selected = JSON.parse(
  await readFile(join(dir, "confirmed-role-identities.json"), "utf8"),
) as {
  complete: boolean;
  policy: string;
  rows: {
    roleId: string;
    name: string;
    sourceKey: string;
    promptSha256: string;
    evidence: string;
    ageMetadataConflict?: boolean;
  }[];
};
if (!selected.complete) throw new Error("Identity selection incomplete");
const job = JSON.parse(await readFile(join(dir, "job.json"), "utf8")) as {
  archive: string;
};
const rows = selected.rows.slice(0, count);
const pilotDir = join(dir, "pilot-5");
await mkdir(pilotDir, { recursive: true });
const wanted = new Map(rows.map((row) => [row.sourceKey, row]));
const found = new Set<string>();
const child = spawn("D:/program/anaconda3/Library/bin/zstd.exe", [
  "-dc",
  job.archive,
]);
child.stderr.resume();
const completion = new Promise<void>((ok, fail) => {
  child.once("error", fail);
  child.once("close", (code) =>
    code === 0 ? ok() : fail(new Error(`Archive exit ${code}`)),
  );
});
for await (const line of createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
})) {
  const record = JSON.parse(line) as { character_key: string; text: string };
  const row = wanted.get(record.character_key);
  if (!row) continue;
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(row.sourceKey))
    throw new Error("Unsafe source key");
  if (
    createHash("sha256").update(record.text).digest("hex") !== row.promptSha256
  )
    throw new Error("Original Prompt fingerprint changed");
  const out = join(pilotDir, row.sourceKey);
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "prompt.txt"), record.text, { mode: 0o600 });
  found.add(row.sourceKey);
}
await completion;
if (found.size !== rows.length)
  throw new Error("Pilot archive coverage incomplete");
const manifest = {
  version: 1,
  startedAt,
  finishedAt: new Date().toISOString(),
  measuredExecutionMs: performance.now() - started,
  policy: selected.policy,
  scope: "TEST",
  serverWrites: 0,
  rows: rows.map((row) => ({
    ...row,
    stage: "awaiting-source-runtime",
    repairs: 0,
    humanInterventions: [],
    promptPath: join(pilotDir, row.sourceKey, "prompt.txt"),
    runtimePath: join(pilotDir, row.sourceKey, "mufy-runtime.json"),
  })),
};
await writeFile(
  join(pilotDir, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
console.log(
  JSON.stringify({
    prepared: rows.length,
    measuredExecutionMs: manifest.measuredExecutionMs,
    serverWrites: 0,
  }),
);
