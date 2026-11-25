/** Stage only; no network, build, database or owner UI writes. */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { normalizePublicFrameReplay } from "../src/lib/import/mufy-public-frame-replay";
import { nativeImageSidebarEnvelope, safeNativeTriggerForeground } from "../src/lib/opening/native-image-sidebar";
import { routeOpeningContentSplit } from "../src/lib/opening/content";

const startedAt = new Date().toISOString(),
  tick = performance.now();
const root = join(
  process.cwd(),
  "logs/mufy-profiles/full-20261013/next-batch-30-20261028",
);
const read = async (path: string) =>
  JSON.parse(await readFile(join(root, path), "utf8"));
const sourceKey = "char_27af964e770887667873";
const sourceUrl =
  "https://chat.mufy.ai/chat?roleId=1144a861-c9eb-44c9-b8f9-2cba7784d5be";
const original = await read(`prepared/${sourceKey}/prepared.json`);
const blocks = await read(
  "final-acceptance/47/source-sidebar-public-blocks.json",
);
const shell = await read("final-acceptance/47/source-sidebar-shell.json");
const triggerForeground=safeNativeTriggerForeground(shell.triggerForeground);
if(!triggerForeground)throw Error('SOURCE_TRIGGER_FOREGROUND_MISSING');
const viewports = await read(
  "final-acceptance/47/source-sidebar-frame-viewports.json",
);
if (
  viewports.sourceUrl !== sourceUrl ||
  viewports.frames.length !== 5 ||
  !viewports.frames.every(
    (frame: { minHeight: string; borderRadius: string }) =>
      frame.minHeight === "100px" && frame.borderRadius === "12px",
  )
)
  throw Error("SOURCE_FRAME_VIEWPORT_MISMATCH");
if (
  blocks.sourceUrl !== sourceUrl ||
  shell.sourceUrl !== sourceUrl ||
  blocks.blocks.length !== 5 ||
  shell.rank !== 47
)
  throw Error("SOURCE_BINDING_MISMATCH");
// Never stage against a stale import snapshot when a current owner UI baseline exists.
const ownerBaselinePath=join(root,'final-acceptance/47/owner-opening-baseline.txt');
const opening=await readFile(ownerBaselinePath,'utf8');
if(!opening.trim())throw Error('CURRENT_OWNER_UI_BASELINE_REQUIRED');
const start = opening.indexOf('<details class="mufy-side-r">');
const warning = opening.indexOf('<floating kind="warning-top"', start);
const end = opening.lastIndexOf("</details>", warning) + "</details>".length;
if (
  start < 0 ||
  warning < 0 ||
  end <= start ||
  opening.slice(end, warning).trim()
)
  throw Error("SIDEBAR_BOUNDARY_UNPROVEN");
let generatedGalleryNodesRemoved = 0;
const documents = blocks.blocks.map((block: { html: string }) => {
  const result = normalizePublicFrameReplay(block.html);
  generatedGalleryNodesRemoved += result.removedGeneratedGalleryNodes;
  return result.html;
});
const spec = {
  version: 1 as const,
  shellHtml: `<details class="mufy-side-r">${shell.summary}<div class="mufy-side-panel">${shell.decorations}<div class="mufy-side-inner"><div data-nj-native-documents></div></div></div></details>`,
  css: original.beautification.globalCss,
  documents,
  framePresentation: { minHeight: 100, borderRadius: 12 },
  triggerForeground,
};
const candidate =
  opening.slice(0, start) +
  nativeImageSidebarEnvelope(spec) +
  opening.slice(end);
const routed = routeOpeningContentSplit(candidate, sourceKey);
const native = routed.floating.filter((frame) => frame.nativeImageSidebar);
if (native.length !== 1 || native[0].nativeImageSidebar?.documents.length !== 5)
  throw Error("NATIVE_ROUTING_MISMATCH");
if (
  JSON.stringify(routed.inline).includes("joss-next-btn") ||
  JSON.stringify(routed.inline).includes("zxs-net-item")
)
  throw Error("SIDEBAR_DOCUMENT_DUPLICATED_INLINE");
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const output = join(root, "rule-repairs/47/native-sidebar");
await mkdir(output, { recursive: true });
await writeFile(join(output, "candidate-opening.txt"), candidate);
await writeFile(
  join(output, "sidebar-spec.json"),
  JSON.stringify(spec, null, 2),
);
const proof = {
  observedAt: new Date().toISOString(),
  startedAt,
  elapsedMs: performance.now() - tick,
  timingKind: "offline-staging-process-wall-not-agent-net",
  agentNetMs: null,
  sourceKey,
  sourceUrl,
  originalOpeningSha256: digest(opening),
  baselineSource: 'fresh normal owner UI opening editor',
  matchesOriginalPrepared: opening===original.beautification.openingComponent,
  candidateOpeningSha256: digest(candidate),
  preservedPrefixCharacters: start,
  preservedSuffixCharacters: opening.length - end,
  sourceDocuments: 5,
  generatedGalleryNodesRemoved,
  candidateDocuments: 5,
  nativeDrawers: 1,
  independentOpaqueFrames: true,
  hostShellScripts: false,
  originalPreparedFileChanged: false,
  requiresCurrentOwnerUiBaselineBeforeSave: true,
  built: false,
  deployed: false,
  browserAccepted: false,
  fullFidelityAccepted: false,
};
await writeFile(
  join(output, "candidate-proof.json"),
  JSON.stringify(proof, null, 2),
);
console.log(JSON.stringify(proof));
