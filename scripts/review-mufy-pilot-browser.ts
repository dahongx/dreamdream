/** Offline review of explicit browser checkpoints; no server/database writes. */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  assembleMufyBrowserSteps,
  reviewMufyBrowserRuns,
  buildMufyRepairQueue,
} from "../src/lib/import/mufy-browser-review";
function arg(name: string) {
  const at = process.argv.indexOf(name);
  if (at < 0 || !process.argv[at + 1]) throw Error(`Missing ${name}`);
  return process.argv[at + 1];
}
const dir = resolve(arg("--observations")),
  inspectionId = arg("--inspection-id");
const pilot = resolve("logs/mufy-profiles/full-20261013/pilot-5");
const files = (await readdir(dir)).filter((n) =>
  /^mufy-browser-step-.*\.json$/.test(n),
);
const raw: unknown[] = await Promise.all(
  files.map(async (n) => JSON.parse(await readFile(join(dir, n), "utf8"))),
);
const runs = assembleMufyBrowserSteps(raw, inspectionId);
const manifest = JSON.parse(
  await readFile(
    join(pilot, "batch-20261015081011954", "batch-config.json"),
    "utf8",
  ),
) as { rows: { name: string; characterId: string }[] };
const results = manifest.rows.map((row) => {
  const review = reviewMufyBrowserRuns(runs, {
    characterId: row.characterId,
    baseUrl: "http://115.29.213.73:8091",
    notBefore: "2026-10-15T08:12:45.422Z",
    allowMediaDeferral: true,
  });
  return {
    ...row,
    ...review,
    repairQueue: buildMufyRepairQueue(review.findings),
  };
});
const output = join(pilot, "browser-loop-20261015");
await mkdir(output, { recursive: true });
const summary = {
  configurations: runs.length,
  observedStates: (runs as Array<{rows: unknown[]}>).reduce((n, r) => n + r.rows.length, 0),
  structuralPassedCards: results.filter(r => r.structuralOk).length,
  browserStepExecutionMs: (runs as Array<{executionMs: number}>).reduce((n, r) => n + r.executionMs, 0),
  recordedClicks: (runs as Array<{actions: unknown[]}>).reduce((n, r) => n + r.actions.length, 0),
  deferredMediaRecords: results.reduce((n, r) => n + r.deferredMedia.length, 0),
  timingScope: "Saved successful observation steps only; excludes earlier failed checks, editing, diagnosis, and time between steps",
};
await writeFile(
  join(output, "browser-review.json"),
  JSON.stringify(
    {
      inspectionId,
      observedFiles: files.length,
      summary,
      runs,
      results,
      finalFidelityAccepted: false,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    results.map((r) => ({
      name: r.name,
      structuralOk: r.structuralOk,
      issues: r.findings.length,
      nextTasks: r.repairQueue.map((t) => t.action),
    })),
    null,
    2,
  ),
);
