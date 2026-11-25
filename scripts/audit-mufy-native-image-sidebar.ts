/** Offline source-coverage audit. No source programs are executed. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isSourceImageSidebar,
  routeOpeningContentSplit,
} from "../src/lib/opening/content";

const startedAt = new Date().toISOString();
const tick = performance.now();
const root = join(
  process.cwd(),
  "logs/mufy-profiles/full-20261013/next-batch-30-20261028",
);
const read = async (path: string) =>
  JSON.parse(await readFile(join(root, path), "utf8"));
const receipts = await read("normal-ui-import-receipts.json");
const rows = [];
for (const row of receipts.rows as { rank: number; sourceKey: string }[]) {
  const prepared = await read(`prepared/${row.sourceKey}/prepared.json`);
  const opening = prepared.beautification.openingComponent as string;
  const routed = routeOpeningContentSplit(opening, row.sourceKey);
  const drawers = routed.floating.filter((frame) =>
    isSourceImageSidebar(frame.srcdoc),
  );
  rows.push({
    rank: row.rank,
    sourceKey: row.sourceKey,
    imageDrawers: drawers.length,
  });
}
if (rows.length !== 28 || new Set(rows.map((row) => row.rank)).size !== 28)
  throw Error("BATCH_BASE_COUNT_MISMATCH");
const affected = rows.filter((row) => row.imageDrawers > 0);
if (
  affected.length !== 1 ||
  affected[0].rank !== 47 ||
  affected[0].imageDrawers !== 1
)
  throw Error("UNEXPECTED_SIDEBAR_SCOPE");
const source = await read(
  "final-acceptance/47/source-sidebar-public-blocks.json",
);
if (
  source.rank !== 47 ||
  !source.sourceUrl.includes("1144a861-c9eb-44c9-b8f9-2cba7784d5be") ||
  source.blocks.length !== 5
)
  throw Error("SOURCE_SIDEBAR_BINDING_MISMATCH");
const receipt = receipts.rows.find((row: { rank: number }) => row.rank === 47);
const prepared = await read(`prepared/${receipt.sourceKey}/prepared.json`);
const opening = prepared.beautification.openingComponent as string;
const markers = [
  "joss-next-btn",
  "zxs-net-item",
  "qtModalImg",
  "plugin-item",
  "jjs-cmd-text",
];
const blocks = source.blocks.map(
  (block: { html: string; visibleText: string }, index: number) => {
    if (
      !block.html.includes(markers[index]) ||
      /__MUFY_ARTIFACT_BRIDGE__/.test(block.html)
    )
      throw Error("PUBLIC_BLOCK_INCOMPLETE_OR_BOOKKEEPING_PRESENT");
    return {
      index,
      marker: markers[index],
      sourceCharacters: block.html.length,
      presentInPreparedSnapshot: opening.includes(markers[index]),
      publicLabel: block.visibleText.split("\n")[0],
    };
  },
);
const missingBlocks = blocks.filter(
  (block: { presentInPreparedSnapshot: boolean }) =>
    !block.presentInPreparedSnapshot,
);
if (missingBlocks.length !== 3)
  throw Error("UNEXPECTED_PREPARED_SIDEBAR_COVERAGE");
const candidateProof = await read("rule-repairs/47/native-sidebar/candidate-proof.json").catch(() => null);
let candidateDocuments = 0;
if (candidateProof) {
  const candidate = await readFile(join(root, "rule-repairs/47/native-sidebar/candidate-opening.txt"), "utf8");
  const native = routeOpeningContentSplit(candidate, receipt.sourceKey).floating.filter(frame => frame.nativeImageSidebar);
  if (native.length !== 1 || native[0].nativeImageSidebar?.documents.length !== 5) throw Error("CANDIDATE_COVERAGE_MISMATCH");
  const spec = native[0].nativeImageSidebar;
  candidateDocuments = spec.documents.length;
  if (!markers.every((marker, index) => spec.documents[index].includes(marker))) throw Error("CANDIDATE_SOURCE_ORDER_MISMATCH");
}
const result = {
  observedAt: new Date().toISOString(),
  startedAt,
  elapsedMs: performance.now() - tick,
  timingKind: "offline-coverage-audit-process-wall-not-agent-net",
  rows,
  affected,
  sourceBlockCount: 5,
  preparedBlockCount: 2,
  blocks,
  missingBlocks,
  localCandidateScope:
    candidateDocuments === 5 ? "five source documents composed in isolated frames inside inert source-styled shadow drawer; lazy bootstrap, stable lifecycle and source 100px minimum/12px frame radius" : "native shell routing, source-size viewport and exporter completeness gate only",
  candidateDocuments,
  nestedCompositionLocalComplete: candidateDocuments === 5,
  unresolved:
    candidateDocuments === 5 ? "No release or real-browser candidate acceptance yet; verify current owner UI baseline before saving staged replacement, then test responsive geometry/copy/media after consolidated release" : "Mount all five original public blocks inside the sidebar while preserving independent opaque frame execution; current shell routing alone is not sufficient",
  built: false,
  deployed: false,
  fullFidelityAccepted: false,
  agentNetMs: null,
};
await writeFile(
  join(root, "final-acceptance/47/native-sidebar-local-audit.json"),
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({
    affected: affected.map((row) => row.rank),
    sourceBlocks: 5,
    preparedBlocks: 2,
    missingInOriginalSnapshot: missingBlocks.map(
      (block: { publicLabel: string }) => block.publicLabel,
    ),
    candidateDocuments,
    elapsedMs: result.elapsedMs,
    fullFidelityAccepted: false,
  }),
);
