/** Offline metadata audit. Never reads held rank 37 or any local prompt. */
import { readFile, writeFile, appendFile } from "node:fs/promises";
import {
  publicRootComponentCoverage,
  type PublicComponentDisposition,
} from "../src/lib/import/mufy-public-component-coverage";

const base = "logs/mufy-profiles/full-20261013/next-batch-30-20261028";
const start = performance.now();
const startedAt = new Date().toISOString();
const held = new Set([31, 37, 50]);
const rows = [];
for (let rank = 21; rank <= 50; rank++) {
  if (held.has(rank)) {
    rows.push({ rank, status: "held-not-read" });
    continue;
  }
  const dir = `${base}/final-acceptance/${rank}`;
  const inventory = JSON.parse(
    await readFile(`${dir}/source-public-component-inventory.json`, "utf8"),
  ) as {
    observedAt: string;
    roots: { frames: { index: number }[] }[];
  };
  const mapping = JSON.parse(
    await readFile(`${dir}/component-ui-mapping.json`, "utf8"),
  ) as {
    sourceObservedAt: string;
    rows: PublicComponentDisposition[];
  };
  rows.push({
    rank,
    status: "diagnostic-only",
    sourceObservedAt: inventory.observedAt,
    mappingSourceObservedAt: mapping.sourceObservedAt,
    sourceVersionMatches: inventory.observedAt === mapping.sourceObservedAt,
    rootFrameCounts: inventory.roots.map((root) => root.frames.length),
    coverage: publicRootComponentCoverage(inventory.roots, mapping.rows),
    wholeCardAccepted: false,
  });
}
const observedAt = new Date().toISOString();
const elapsedMs = performance.now() - start;
await writeFile(
  `${base}/public-root-coverage-audit-20261104.json`,
  JSON.stringify(
    {
      observedAt,
      elapsedMs,
      timingKind: "local-computation-and-file-io",
      scope:
        "All captured roots; missing mapping is a review task, not proof of missing target UI. Existing per-frame evidence is preserved.",
      rows,
      fullFidelityAccepted: 0,
      serverWrites: 0,
    },
    null,
    2,
  ),
);
await appendFile(
  `${base}/timing-runs.jsonl`,
  JSON.stringify({
    stepId: "public-root-coverage-audit-20261104",
    startedAt,
    finishedAt: observedAt,
    elapsedMs,
    kind: "local-processing",
    agentNetMs: null,
    browserElapsedMs: 0,
    note: "Bounded local metadata audit only. User and scheduler waits excluded; no token estimate.",
  }) + "\n",
);
console.log(
  JSON.stringify(
    rows
      .filter((row) =>
        row.coverage?.missing.some((key) => !key.startsWith("0:")),
      )
      .map((row) => ({ rank: row.rank, missing: row.coverage?.missing })),
  ),
);
