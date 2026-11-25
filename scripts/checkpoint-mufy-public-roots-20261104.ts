import { readFile, writeFile, appendFile } from "node:fs/promises";
import {
  publicRootComponentCoverage,
  type PublicComponentDisposition,
} from "../src/lib/import/mufy-public-component-coverage";

const base = "logs/mufy-profiles/full-20261013/next-batch-30-20261028";
const tick = performance.now(),
  startedAt = new Date().toISOString();
const audit = JSON.parse(
  await readFile(`${base}/public-root-coverage-audit-20261104.json`, "utf8"),
) as {
  rows: { rank: number; coverage?: { missing: string[] } }[];
};
const added: { rank: number; keys: string[] }[] = [];
for (const item of audit.rows) {
  if ([31, 37, 50].includes(item.rank)) continue;
  const keys =
    item.coverage?.missing.filter((key) => !key.startsWith("0:")) ?? [];
  if (!keys.length) continue;
  const dir = `${base}/final-acceptance/${item.rank}`;
  const inventory = JSON.parse(
    await readFile(`${dir}/source-public-component-inventory.json`, "utf8"),
  );
  const path = `${dir}/component-ui-mapping.json`;
  const mapping = JSON.parse(await readFile(path, "utf8")) as {
    rows: PublicComponentDisposition[];
    rootCoverage?: unknown;
  };
  const existing = new Set(
    mapping.rows.map((row) => `${row.sourceRootIndex ?? 0}:${row.sourceIndex}`),
  );
  for (const key of keys) {
    if (existing.has(key)) continue;
    const [sourceRootIndex, sourceIndex] = key.split(":").map(Number);
    mapping.rows.push({
      sourceRootIndex,
      sourceIndex,
      status: "pending",
      targetUiVerified: false,
      fidelityVerified: false,
      evidence: `final-acceptance/${item.rank}/source-public-component-inventory.json`,
      reason:
        "Additional captured public root was absent from the root-0 mapping. Classify opening/global/reply/helper ownership, then bind existing target evidence or repair and actually recheck. Zero frame area is not a nonvisual verdict; do not clone reply components into the opening.",
    });
  }
  mapping.rootCoverage = publicRootComponentCoverage(
    inventory.roots,
    mapping.rows,
  );
  await writeFile(path, JSON.stringify(mapping, null, 2));
  added.push({ rank: item.rank, keys });
}
const finding = {
  observedAt: new Date().toISOString(),
  evidence: "public-root-coverage-audit-20261104.json",
  cardsWithAdditionalRootReview: added,
  sourceFramesAddedToReview: added.reduce(
    (sum, item) => sum + item.keys.length,
    0,
  ),
  rank25: {
    targetEvidence:
      "final-acceptance/25/additional-root-target-live-20261104.json",
    screenshot: "final-acceptance/25/additional-root-target-live-20261104.png",
    screenshotObservedAt: "2026-11-03T19:47:21.102Z",
    screenshotElapsedMs: 491,
    finding:
      "Loaded TEST header identifies Chen Chuang; no floating music label or native widget hosts. Saved public root1 includes the floating player program. Current source AX showed KAYKAZ and seven songs, but source rebind later failed at browser debugger; no fresh paired visual acceptance claimed.",
    browserFailure:
      "Source tab debugger unattached after reconnect. This is not evidence of a website outage.",
    wholeCardAccepted: false,
  },
  codeGuard:
    "Legacy preparation now refuses nonempty extra roots rather than silently dropping them. No raw parent scripts transplanted.",
  tests: {
    pass: 10,
    fail: 0,
    assertions: 24,
    scope: "component/root coverage and literal frame restoration",
  },
  buildPerformed: false,
  deployed: false,
  serverWrites: 0,
  nextAction:
    "Classify the 16 additional-root frames on nine eligible cards, preserve previous root0 evidence, and restore only actually missing target behavior. Source reply roots require reply-render mapping, not automatic opening duplication. Complete preflight before building; font candidate and reviewed11-file proposal remain local.",
};
await writeFile(
  `${base}/public-root-coverage-followup-20261104.json`,
  JSON.stringify(finding, null, 2),
);
for (const file of ["qa-progress.json", "continuation-next-20261031.json"]) {
  const path = `${base}/${file}`,
    value = JSON.parse(await readFile(path, "utf8"));
  value.publicRootCoverageFollowup = {
    evidence: "public-root-coverage-followup-20261104.json",
    cards: added.map((item) => item.rank),
    pendingAdditionalFrames: finding.sourceFramesAddedToReview,
    fullFidelityAccepted: false,
  };
  if (file.startsWith("continuation"))
    value.currentNextAction = finding.nextAction;
  await writeFile(path, JSON.stringify(value, null, 2));
}
await appendFile(
  `${base}/timing-runs.jsonl`,
  JSON.stringify({
    stepId: "checkpoint-public-roots-20261104",
    kind: "local-processing",
    startedAt,
    finishedAt: new Date().toISOString(),
    elapsedMs: performance.now() - tick,
    agentNetMs: null,
    browserElapsedMs: 0,
    note: "Only bounded reconciliation time; excludes user/scheduler waits. Actual target DOM read6933ms and screenshot491ms recorded separately.",
  }) + "\n",
);
console.log(
  JSON.stringify({
    cards: added.map((item) => item.rank),
    pendingAdditionalFrames: finding.sourceFramesAddedToReview,
    wholeCardAccepted: false,
  }),
);
