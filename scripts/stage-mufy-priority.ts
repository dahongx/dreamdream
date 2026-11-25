#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import {
  parseMufyPrompt,
  prepareMufyMigration,
} from "../src/lib/import/mufy-migration";
const dir = resolve(process.argv[2] ?? "logs/mufy-profiles/full-20261013");
const startedAt = new Date().toISOString();
type Priority = {
  roleId: string;
  name: string;
  sourceKey: string;
  promptSha256: string;
  publicOpeningSyncNeeded: boolean;
};
const plan = JSON.parse(
  await readFile(join(dir, "local-baseline-plan.json"), "utf8"),
) as { priority: Priority[]; policy: unknown };
const job = JSON.parse(await readFile(join(dir, "job.json"), "utf8")) as {
  archive: string;
};
const live = JSON.parse(
  await readFile(join(dir, "selection-live-evidence.json"), "utf8"),
) as {
  records: {
    roleId: string;
    status: string;
    name: string;
    description?: string;
    age?: number;
    gender?: string | number;
    avatarUrl?: string | null;
    backgroundUrl?: string | null;
    greeting?: string;
    codeRenderContent?: string;
    optimizationCode?: string;
    tags?: string[];
    observedAt: string;
  }[];
};
const wanted = new Map(plan.priority.map((r) => [r.sourceKey, r]));
const rows: unknown[] = [];
const child = spawn("D:/program/anaconda3/Library/bin/zstd.exe", [
  "-dc",
  job.archive,
]);
child.stderr.resume();
const exited = new Promise<void>((ok, fail) => {
  child.once("error", fail);
  child.once("close", (code) =>
    code === 0 ? ok() : fail(new Error(`Archive read failed (${code})`)),
  );
});
for await (const line of createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
})) {
  const record = JSON.parse(line) as {
    character_key: string;
    character_name: string;
    text: string;
  };
  const row = wanted.get(record.character_key);
  if (!row) continue;
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(row.sourceKey))
    throw new Error("Invalid source key");
  const hash = createHash("sha256").update(record.text).digest("hex");
  if (hash !== row.promptSha256)
    throw new Error("Source Prompt fingerprint changed");
  const evidence = live.records.find(
    (r) => r.roleId === row.roleId && r.status === "found",
  );
  if (!evidence) throw new Error("Missing live source evidence");
  const fields = parseMufyPrompt(record.text);
  const stageDir = join(dir, "preflight-sources", row.sourceKey);
  await mkdir(stageDir, { recursive: true });
  await writeFile(join(stageDir, "prompt.txt"), record.text, { mode: 0o600 });
  const detail = {
    characterId: row.roleId,
    name: evidence.name,
    description: evidence.description,
    age: evidence.age,
    gender: evidence.gender,
    tags: evidence.tags,
    avatarUrl: evidence.avatarUrl,
    backgroundUrl: evidence.backgroundUrl,
    greeting: evidence.greeting,
    codeRenderContent: evidence.codeRenderContent,
    optimizationCode: evidence.optimizationCode,
  };
  await writeFile(
    join(stageDir, "public-detail.json"),
    JSON.stringify(detail, null, 2),
    { mode: 0o600 },
  );
  let prepared: ReturnType<typeof prepareMufyMigration> | null = null;
  let issues: ReturnType<typeof prepareMufyMigration>["issues"];
  try {
    prepared = prepareMufyMigration({
      detail,
      promptRecord: {
        characterName: record.character_name,
        prompt: record.text,
        source: { profileKey: row.sourceKey, promptSha256: hash },
      },
    });
    issues = prepared.issues;
  } catch (error) {
    issues = [
      {
        level: "error",
        code: "PREPARATION_EXCEPTION",
        message: error instanceof Error ? error.message : "Preparation failed",
      },
    ];
  }
  if (prepared)
    await writeFile(
      join(stageDir, "prepared-local-preview.json"),
      JSON.stringify(prepared, null, 2),
      { mode: 0o600 },
    );
  await writeFile(
    join(stageDir, "dry-run-issues.json"),
    JSON.stringify(
      {
        roleId: row.roleId,
        name: row.name,
        issues,
        audit: prepared?.audit ?? null,
        noServerWrites: true,
        itemsNotCollected: true,
      },
      null,
      2,
    ),
  );
  rows.push({
    ...row,
    promptFingerprintVerified: true,
    textSections: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        typeof value === "string" ? value.length : 0,
      ]),
    ),
    requiredTextPresent: !!fields.persona.trim() && !!fields.opening?.trim(),
    sourceObservedAt: evidence.observedAt,
    promptPath: join(stageDir, "prompt.txt"),
    publicDetailPath: join(stageDir, "public-detail.json"),
    status: "staged-not-runtime-accepted",
    publicSync: row.publicOpeningSyncNeeded
      ? "greeting-markup-sync-planned"
      : "none-required-for-opening",
    dryRunNoBlockingErrors: !issues.some((issue) => issue.level === "error"),
    preparedPreviewPath: prepared
      ? join(stageDir, "prepared-local-preview.json")
      : null,
    blockingIssues: issues.filter((issue) => issue.level === "error"),
    warnings: issues.filter((issue) => issue.level === "warning"),
    dryRunIssuesPath: join(stageDir, "dry-run-issues.json"),
    pending: [
      "fresh-target-provenance-and-duplicate-check",
      "complete-public-media-and-items",
      "runtime-capture",
      "mobile-desktop-acceptance",
    ],
  });
}
await exited;
if (rows.length !== plan.priority.length)
  throw new Error("Not all priority sources were found in the archive");
const result = {
  version: 1,
  startedAt,
  finishedAt: new Date().toISOString(),
  elapsedMs: Date.now() - Date.parse(startedAt),
  staged: rows.length,
  migrationCompleted: 0,
  serverWrites: 0,
  policy: plan.policy,
  rows,
};
await writeFile(
  join(dir, "priority-source-preflight.json"),
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({
    staged: rows.length,
    elapsedMs: result.elapsedMs,
    serverWrites: 0,
  }),
);
