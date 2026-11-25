#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { decideIdentity } from "../src/lib/import/mufy-identity-decision";
import { validateTestInventory } from "../src/lib/import/mufy-profile-selection";

// Runs the real Agent without --commit. Fresh source identity remains mandatory.
const dir = resolve(process.argv[2] ?? "logs/mufy-profiles/full-20261013");
const allowMissingMedia = process.argv.includes("--allow-missing-media");
const allowMissingAudio = process.argv.includes("--allow-missing-audio") || allowMissingMedia;
const preferLocalAge = process.argv.includes("--use-local-age");
const adaptHostCss = process.argv.includes("--adapt-host-css");
const remigrate = process.argv.includes("--remigrate");
const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const pilotDir = join(dir, "pilot-5");
const manifest = (await read(join(pilotDir, "manifest.json"))) as {
  measuredExecutionMs: number;
  rows: {
    sourceKey: string;
    roleId: string;
    name: string;
    promptSha256: string;
    promptPath: string;
    runtimePath: string;
  }[];
};
const cache = (await read(join(dir, "identity-source-cache.json"))) as {
  rows: {
    sourceKey: string;
    primaryName: string | null;
    persona: string;
    opening: string;
    age: number | null;
  }[];
};
const pool = (await read(join(dir, "identity-pool.json"))) as {
  rows: {
    source: { key: string; name: string };
    candidate: { roleId: string };
  }[];
};
const inventory = validateTestInventory(
  await read(join(dir, "test-inventory.json")),
);
const startedAt = new Date().toISOString();
let priorWrites: {roleId:string; databaseWrite?: {characterId:string}}[] = [];
try { priorWrites = (await read(join(pilotDir,"test-write-summary.json"))).rows; }
catch(error) { if((error as {code?:string}).code!=="ENOENT") throw error; }
const rows = [];
for (const row of manifest.rows) {
  const started = performance.now();
  const runtime = await read(row.runtimePath);
  const prompt = await readFile(row.promptPath, "utf8");
  if (createHash("sha256").update(prompt).digest("hex") !== row.promptSha256)
    throw new Error("Pilot Prompt fingerprint changed");
  if (runtime.characterId !== row.roleId)
    throw new Error("Pilot runtime role mismatch");
  const local = cache.rows.find((x) => x.sourceKey === row.sourceKey);
  const source = pool.rows.find(
    (x) => x.source.key === row.sourceKey && x.candidate.roleId === row.roleId,
  );
  if (!local || !source) throw new Error("Pilot identity evidence missing");
  const identity = decideIdentity(
    source.source.name,
    local,
    { ...runtime.detail.data, roleId: row.roleId, status: "found" },
    inventory.characters.filter(target => !(remigrate && priorWrites.some(previous => previous.roleId === row.roleId && previous.databaseWrite?.characterId === target.id))),
  );
  if (identity.status !== "confirmed") {
    rows.push({
      name: row.name,
      roleId: row.roleId,
      stage: "fresh-identity-blocked",
      reason: identity.reason,
      measuredExecutionMs: performance.now() - started,
      serverWrites: 0,
    });
    continue;
  }
  const runtimeFingerprint = createHash("sha256")
    .update(await readFile(row.runtimePath))
    .digest("hex");
  // A repaired snapshot gets its own run; never overwrite another source contract.
  const attemptDir = join(
    pilotDir,
    row.sourceKey,
    `agent-${runtimeFingerprint.slice(0, 12)}${allowMissingAudio ? "-audio-optional" : ""}${preferLocalAge ? "-local-age" : ""}${adaptHostCss ? "-css-adapted" : ""}${allowMissingMedia ? "-media-optional" : ""}`,
  );
  const child = Bun.spawn(
    [
      "bun",
      "scripts/run-mufy-migration-agent.ts",
      "--mufy-runtime",
      row.runtimePath,
      "--prompt-json",
      row.promptPath,
      "--job-dir",
      attemptDir,
      ...(allowMissingAudio ? ["--allow-missing-audio"] : []),
      ...(allowMissingMedia ? ["--allow-missing-media"] : []),
      ...(preferLocalAge ? ["--use-local-age"] : []),
      ...(adaptHostCss ? ["--adapt-host-css"] : []),
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  const timeout = setTimeout(() => child.kill(), 30_000);
  const exitCode = await child.exited;
  clearTimeout(timeout);
  let issues: { level: string; code: string; message: string }[] = [];
  try {
    issues = (await read(join(attemptDir, "migration-report.json"))).prepared
      .issues;
  } catch {
    issues = [
      {
        level: "error",
        code: "AGENT_REPORT_MISSING",
        message: "Agent did not produce a report",
      },
    ];
  }
  rows.push({
    name: row.name,
    roleId: row.roleId,
    sourceKey: row.sourceKey,
    identity: identity.status,
    sourceCaptureExecutionMs: runtime.captureExecutionMs,
    sourceAssets: runtime.assetSummary,
    agentExitCode: exitCode,
    measuredExecutionMs: performance.now() - started,
    stage:
      exitCode === 0 ? "ready-to-write-test-not-written" : "preflight-blocked",
    issues,
    reportPath: join(attemptDir, "migration-report.json"),
    serverWrites: 0,
  });
  console.log(
    JSON.stringify({
      name: row.name,
      exitCode,
      blocking: issues.filter((x) => x.level === "error").map((x) => x.code),
    }),
  );
}
await writeFile(
  join(pilotDir, "pilot-check.json"),
  JSON.stringify(
    {
      version: 1,
      startedAt,
      finishedAt: new Date().toISOString(),
      scope: "TEST",
      audioPolicy: allowMissingAudio
        ? "user-authorized-omit-unavailable-audio"
        : "strict",
      mediaPolicy: allowMissingMedia ? "user-authorized-omit-unavailable-media" : "strict-images",
      preferLocalAge,
      adaptHostCss,
      serverWrites: 0,
      migrated: 0,
      visuallyAccepted: 0,
      preparationExecutionMs: manifest.measuredExecutionMs,
      recordedExecutionMs:
        manifest.measuredExecutionMs +
        rows.reduce(
          (n, row) =>
            n +
            row.measuredExecutionMs +
            ("sourceCaptureExecutionMs" in row
              ? (row.sourceCaptureExecutionMs ?? 0)
              : 0),
          0,
        ),
      timingExcludes: [
        "user pauses",
        "agent reasoning",
        "development",
        "earlier failed capture and repair attempts",
      ],
      rows,
    },
    null,
    2,
  ),
);
