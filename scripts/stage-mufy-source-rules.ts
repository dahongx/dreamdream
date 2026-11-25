#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { assertMufySourceRuleResponse } from "../src/lib/import/mufy-source-rules";

const pilotDir = resolve("logs/mufy-profiles/full-20261013/pilot-5");
const expectedRoles = new Set([
  "54aa723f-f61a-40ff-89cb-2c003388675d",
  "2bcfd009-553c-4434-a599-942c89a28da9",
  "d37e7f92-5cd7-41bf-8510-e70621f734d0",
  "396e1ded-9bfc-42e4-9350-c04a33e52a0f",
  "66e284e0-bcc5-4104-88cd-909d5b52305d",
]);
type JsonRecord = Record<string, unknown>;
function object(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** Validate real exported public responses; an absent response is never an empty rules list. */
export function validateSourceRules(
  value: unknown,
  roleId: string,
  now = Date.now(),
) {
  assert(object(value), "Source rules export must be an object");
  const keys = new Set([
    "version",
    "roleId",
    "capturedAt",
    "captureScope",
    "responseCode",
    "responseDataWasNull",
    "rules",
  ]);
  assert(
    Object.keys(value).every((key) => keys.has(key)),
    "Unexpected export field; credentials/unknown metadata must not be staged",
  );
  assert(
    value.version === 1 && value.roleId === roleId,
    "Export version/roleId mismatch",
  );
  assert(
    value.captureScope === "normal-page-public-render-rules",
    "Source rules were not captured from normal public rendering",
  );
  const captured =
    typeof value.capturedAt === "string" ? Date.parse(value.capturedAt) : NaN;
  assert(
    Number.isFinite(captured) &&
      captured >= Date.parse("2026-10-15T00:00:00Z") &&
      captured <= now + 5 * 60_000,
    "Invalid/out-of-window capturedAt",
  );
  assert(
    Array.isArray(value.rules),
    "Missing rules array; refusing an invented empty list",
  );
  assertMufySourceRuleResponse(value, now);
  const ruleKeys = new Set([
    "regexRuleId",
    "ruleName",
    "regPattern",
    "replaceString",
    "targetSymbol",
    "mode",
    "enabled",
    "visibility",
    "userEnabled",
  ]);
  const ids = new Set<string>();
  for (const rule of value.rules) {
    assert(
      object(rule) && Object.keys(rule).every((key) => ruleKeys.has(key)),
      "Unexpected rule field",
    );
    assert(
      Number.isSafeInteger(rule.regexRuleId) && Number(rule.regexRuleId) >= 0,
      "Invalid source rule numeric id",
    );
    for (const key of [
      "ruleName",
      "regPattern",
      "replaceString",
      "targetSymbol",
    ]) {
      assert(typeof rule[key] === "string", `Invalid rule field ${key}`);
    }
    assert(!ids.has(String(rule.regexRuleId)), "Duplicate source rule id");
    ids.add(String(rule.regexRuleId));
    assert(
      Number.isInteger(rule.mode) &&
        Number(rule.mode) >= 0 &&
        Number(rule.mode) <= 4,
      "Unknown source mode; update the protocol contract first",
    );
    for (const key of ["enabled", "visibility", "userEnabled"])
      assert(typeof rule[key] === "boolean", `Invalid rule flag ${key}`);
  }
  return { export: value, count: value.rules.length };
}

function insidePilot(path: string) {
  const suffix = relative(pilotDir, path);
  assert(
    suffix !== "" && !suffix.startsWith("..") && !isAbsolute(suffix),
    "Manifest path escapes exact pilot directory",
  );
  return path;
}

async function main() {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  let exitCode = 1;
  try {
    const manifest = JSON.parse(
      await readFile(resolve(pilotDir, "manifest.json"), "utf8"),
    ) as unknown;
    assert(
      object(manifest) &&
        Array.isArray(manifest.rows) &&
        manifest.scope === "TEST",
      "Invalid TEST manifest",
    );
    assert(
      manifest.rows.length === 5 &&
        new Set(
          manifest.rows.map((row: unknown) =>
            object(row) ? row.roleId : null,
          ),
        ).size === 5,
      "Require five unique exact manifest cards",
    );
    const downloads = resolve(process.argv[2] ?? "C:/Users/14343/Downloads");
    // Validate all five inputs before changing any runtime file.
    const prepared = await Promise.all(
      manifest.rows.map(async (row: unknown) => {
        assert(
          object(row) &&
            typeof row.roleId === "string" &&
            expectedRoles.has(row.roleId),
          "Unexpected manifest role",
        );
        assert(
          typeof row.sourceKey === "string" &&
            /^char_[0-9a-f]{20}$/.test(row.sourceKey) &&
            typeof row.runtimePath === "string",
          "Invalid manifest source/runtime path",
        );
        const sourceText = await readFile(
          resolve(downloads, `mufy-render-rules-${row.roleId}.json`),
          "utf8",
        );
        const checked = validateSourceRules(JSON.parse(sourceText), row.roleId);
        const runtimePath = insidePilot(resolve(row.runtimePath));
        assert(
          dirname(runtimePath) === resolve(pilotDir, row.sourceKey),
          "Runtime does not belong to matching source card",
        );
        const runtime = JSON.parse(
          await readFile(runtimePath, "utf8"),
        ) as unknown;
        assert(
          object(runtime) && runtime.characterId === row.roleId,
          "Runtime characterId mismatch",
        );
        return {
          row,
          sourceText,
          checked,
          runtime,
          runtimePath,
          sourcePath: insidePilot(
            resolve(
              pilotDir,
              row.sourceKey,
              "mufy-source-rules-original-20261015.json",
            ),
          ),
        };
      }),
    );
    const rows = [];
    for (const entry of prepared) {
      await mkdir(dirname(entry.sourcePath), { recursive: true });
      await writeFile(entry.sourcePath, entry.sourceText, "utf8");
      entry.runtime.sourceRules = entry.checked.export;
      await writeFile(
        entry.runtimePath,
        `${JSON.stringify(entry.runtime, null, 2)}\n`,
        "utf8",
      );
      rows.push({
        roleId: entry.row.roleId,
        sourceKey: entry.row.sourceKey,
        ruleCount: entry.checked.count,
        capturedAt: entry.checked.export.capturedAt,
        responseDataWasNull: entry.checked.export.responseDataWasNull ?? null,
        sourcePath: entry.sourcePath,
        sourceSha256: hash(entry.sourceText),
        runtimePath: entry.runtimePath,
        runtimeSha256: hash(await readFile(entry.runtimePath, "utf8")),
      });
    }
    const summary = {
      version: 1,
      scope: "local-public-source-rule-staging-only",
      startedAt,
      finishedAt: new Date().toISOString(),
      measuredExecutionMs: performance.now() - start,
      databaseWrites: 0,
      sourceRulesRuntimeField: "sourceRules",
      rows,
    };
    await writeFile(
      resolve(pilotDir, "source-rules-staging-20261015.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );
    console.log(
      JSON.stringify({
        staged: rows.length,
        ruleCounts: rows.map(({ roleId, ruleCount }) => ({
          roleId,
          ruleCount,
        })),
        measuredExecutionMs: summary.measuredExecutionMs,
      }),
    );
    exitCode = 0;
  } finally {
    await appendFile(
      resolve(pilotDir, "repair-execution.jsonl"),
      `${JSON.stringify({ session: process.env.MUFY_TIMING_SESSION ?? "20261015T040452Z", label: "stage-real-public-source-rules", startedAt, finishedAt: new Date().toISOString(), measuredExecutionMs: performance.now() - start, exitCode, excludes: ["user pauses", "analysis and development outside command"] })}\n`,
    );
  }
}
if (import.meta.main) await main();
