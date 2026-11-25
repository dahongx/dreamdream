/** Pixel analysis of normal browser screenshots, not a network/download test. */
import { readFile, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";
const root =
  "logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/25";
const stable=process.argv.includes('--stable');
const tick = performance.now(),
  startedAt = new Date().toISOString();
const observation = JSON.parse(
  await readFile(root + (stable?'/gif-stable-observation.json':"/gif-render-observation.json"), "utf8"),
);
const files = [
  root + (stable?'/gif-stable-sample-1.png':"/gif-render-sample-1.jpg"),
  root + (stable?'/gif-stable-sample-2.png':"/gif-render-sample-2.jpg"),
];
const samples = await Promise.all(
  files.map((file) =>
    sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ),
);
if (
  samples[0].info.width !== samples[1].info.width ||
  samples[0].info.height !== samples[1].info.height ||
  samples[0].data.length !== samples[1].data.length
)
  throw Error("SCREENSHOT_GEOMETRY_MISMATCH");
let changedPixels = 0,
  totalDifference = 0;
for (let offset = 0; offset < samples[0].data.length; offset += 3) {
  let max = 0;
  for (let c = 0; c < 3; c++) {
    const diff = Math.abs(
      samples[0].data[offset + c] - samples[1].data[offset + c],
    );
    max = Math.max(max, diff);
    totalDifference += diff;
  }
  if (max > 8) changedPixels++;
}
const pixels = samples[0].info.width * samples[0].info.height;
const modified = await Promise.all(files.map((file) => stat(file)));
const coordinatesStable = observation.coordinatesStable === true;
const result = {
  ...observation,
  observedAt: new Date().toISOString(),
  startedAt,
  elapsedMs: performance.now() - tick,
  timingKind: "offline-rendered-pixel-analysis-process-wall-not-agent-net",
  agentNetMs: null,
  width: samples[0].info.width,
  height: samples[0].info.height,
  changedPixels,
  changedPixelFraction: changedPixels / pixels,
  meanChannelDifference: totalDifference / samples[0].data.length,
  rawPixelsChanged: changedPixels > 100 && changedPixels / pixels > 0.02,
  coordinatesStable,
  renderedPixelsChanged:
    coordinatesStable && changedPixels > 100 && changedPixels / pixels > 0.02,
  sampleFileGapMs: modified[1].mtimeMs - modified[0].mtimeMs,
  sampleGapIsNotAgentNetTime: true,
  claimScope: coordinatesStable
    ? "Stable-coordinate image movement only; not full download, source-wide visual or whole-card acceptance"
    : "INCONCLUSIVE: image coordinates were not stable across capture; changing text or layout may contaminate pixel differences",
  fullFidelityAccepted: false,
};
await writeFile(
  root + (stable?'/gif-stable-motion-check.json':"/gif-render-motion-check.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
