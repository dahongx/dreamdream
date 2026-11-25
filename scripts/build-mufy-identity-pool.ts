#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import {
  rankProfileCandidates,
  type ProfileSource,
  type ProfileObservation,
} from "../src/lib/import/mufy-profiles";
import {
  selectNewTestProfiles,
  validateTestInventory,
} from "../src/lib/import/mufy-profile-selection";
import { localIdentityFacts } from "../src/lib/import/mufy-local-identity";
const dir = resolve(process.argv[2] ?? "logs/mufy-profiles/full-20261013");
const limit = Number(process.argv[3] ?? 500);
if (!Number.isSafeInteger(limit) || limit < 100)
  throw new Error("Identity pool must contain at least 100 candidates");
const startedAt = new Date().toISOString();
const read = async (name: string) =>
  JSON.parse(await readFile(join(dir, name), "utf8"));
const sources = (await read("sources.json")) as ProfileSource[];
const observations = (await read("observations.json")) as ProfileObservation[];
const inventory = validateTestInventory(await read("test-inventory.json"));
const rejected = (await read("audited-rejections.json")) as {
  rows: { roleId: string; sourceKey: string; promptSha256: string }[];
};
const ranked = rankProfileCandidates(
  sources,
  observations,
  [],
  "favorites",
  false,
).filter(
  (r) =>
    !rejected.rows.some(
      (x) =>
        x.roleId === r.candidate.roleId &&
        x.sourceKey === r.source.key &&
        x.promptSha256 === r.source.promptSha256,
    ),
);
const pool = selectNewTestProfiles(ranked, inventory, limit);
const wanted = new Set(pool.rows.map((r) => r.source.key));
type Local = {
  sourceKey: string;
  promptSha256: string;
  persona: string;
  opening: string;
  primaryName: string | null;
  age: number | null;
  ageDescription: string | null;
};
const cache: Local[] = [];
const job = (await read("job.json")) as {
  archive: string;
  sourceDigest: string;
};
const child = spawn("D:/program/anaconda3/Library/bin/zstd.exe", [
  "-dc",
  job.archive,
]);
child.stderr.resume();
const exited = new Promise<void>((ok, fail) => {
  child.once("error", fail);
  child.once("close", (code) =>
    code === 0 ? ok() : fail(new Error(`Archive failed (${code})`)),
  );
});
for await (const line of createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
})) {
  const value = JSON.parse(line) as { character_key: string; text: string };
  if (!wanted.has(value.character_key)) continue;
  const source = sources.find((r) => r.key === value.character_key);
  const hash = createHash("sha256").update(value.text).digest("hex");
  if (hash !== source?.promptSha256) throw new Error("Source hash changed");
  const persona =
    value.text.match(/<CharaPrompt[^>]*>([\s\S]*?)<\/CharaPrompt>/i)?.[1] ?? "";
  const opening =
    value.text.match(/<Greeting[^>]*>([\s\S]*?)<\/Greeting>/i)?.[1] ?? "";
  const facts = localIdentityFacts(persona);
  cache.push({
    sourceKey: value.character_key,
    promptSha256: hash,
    persona,
    opening,
    primaryName: facts.name,
    age: facts.age,
    ageDescription: facts.ageDescription,
  });
}
await exited;
await writeFile(
  join(dir, "identity-source-cache.json"),
  JSON.stringify({ version: 1, sourceDigest: job.sourceDigest, rows: cache }),
  { mode: 0o600 },
);
await writeFile(
  join(dir, "identity-pool.json"),
  JSON.stringify(
    {
      version: 1,
      startedAt,
      finishedAt: new Date().toISOString(),
      purpose: "determine-100-identities-only-no-migration-preflight",
      metric: "favorites",
      requested: limit,
      inventoryCapturedAt: inventory.capturedAt,
      rows: pool.rows,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    pool: pool.rows.length,
    sourcesVerified: cache.length,
    elapsedMs: Date.now() - Date.parse(startedAt),
    serverWrites: 0,
  }),
);
