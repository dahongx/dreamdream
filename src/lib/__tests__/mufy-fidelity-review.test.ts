import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { FIDELITY_CHECKS, verifyFidelityEvidence, verifyFidelityEvidenceFiles, verifyMufyScreenshotGeometry, type FidelityEvidence } from "../import/mufy-fidelity-review";

const binding = { sourceRuntimeSha256: "a".repeat(64), targetCharacterId: "target", rendererSha256: "b".repeat(64) };
const expected = { ...binding, targetBaseUrl: "http://test.local/chat/target", notBefore: "2026-01-01T00:00:00Z" };
const directories: string[] = [];
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
test("native CSS-pixel raster keeps truthful hardware DPR and binds the unresized original",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"mufy-native-raster-"));directories.push(dir);
  const jpeg=Buffer.from([255,216,255,192,0,8,8,3,76,1,134,0,255,217]); // geometry fixture: 390 x 844, never visual evidence
  await writeFile(join(dir,"original.jpg"),jpeg);
  const capture={backend:"native-browser-api",normalization:"jpeg-to-png-no-resize",pixelRatio:1,original:{path:"original.jpg",sha256:hash(jpeg)}};
  const viewport={width:390,height:844,devicePixelRatio:1.5};
  await expect(verifyMufyScreenshotGeometry(pngFixture(390),viewport,capture,join(dir,"report.json"))).resolves.toBeUndefined();
  await expect(verifyMufyScreenshotGeometry(pngFixture(1280),viewport,capture,join(dir,"report.json"))).rejects.toThrow("NATIVE_SCREENSHOT_RESIZED");
  await expect(verifyMufyScreenshotGeometry(pngFixture(390),viewport,{...capture,pixelRatio:2},join(dir,"report.json"))).rejects.toThrow("NATIVE_CAPTURE_RATIO_MISMATCH");
  await writeFile(join(dir,"original.jpg"),"changed");
  await expect(verifyMufyScreenshotGeometry(pngFixture(390),viewport,capture,join(dir,"report.json"))).rejects.toThrow("ARTIFACT_HASH_MISMATCH");
});
function pngFixture(width: number,height=844) {
  const chunk = (kind: string, data: Buffer) => {
    const result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length); result.write(kind, 4); data.copy(result, 8); return result;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc((width * 3 + 1) * height))), chunk("IEND", Buffer.alloc(0))]);
}
test("provider-scaled viewport requires measured client width and an unchanged original",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"mufy-viewport-raster-"));directories.push(dir);
  const jpeg=Buffer.from([255,216,255,192,0,8,8,3,44,1,119,0,255,217]); // 375x812 geometry fixture only
  await writeFile(join(dir,"original.jpg"),jpeg);
  const capture={backend:"native-browser-api",normalization:"jpeg-to-png-no-resize",rasterMode:"client-width-scaled-viewport",pixelRatio:375/390,original:{path:"original.jpg",sha256:hash(jpeg)}};
  const viewport={width:390,height:844,clientWidth:375,devicePixelRatio:1.5};
  await expect(verifyMufyScreenshotGeometry(pngFixture(375,812),viewport,capture,join(dir,"r.json"))).resolves.toBeUndefined();
  await expect(verifyMufyScreenshotGeometry(pngFixture(375,812),{...viewport,clientWidth:undefined},capture,join(dir,"r.json"))).rejects.toThrow("NATIVE_VIEWPORT_FOOTPRINT_REQUIRED");
  await expect(verifyMufyScreenshotGeometry(pngFixture(375,812),viewport,{...capture,pixelRatio:0.5},join(dir,"r.json"))).rejects.toThrow("NATIVE_CAPTURE_RATIO_MISMATCH");
  await expect(verifyMufyScreenshotGeometry(pngFixture(390),viewport,capture,join(dir,"r.json"))).rejects.toThrow("NATIVE_SCREENSHOT_RESIZED");
});
afterEach(async () => { for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true }); });

async function fixture(mutate?: (raw: Record<string, unknown>) => void) {
  const dir = await mkdtemp(join(tmpdir(), "mufy-fidelity-")); directories.push(dir);
  const report: FidelityEvidence = { version: 2, scope: "opening-and-source-components", ...binding, observations: [] };
  for (const surface of ["preview", "chat"] as const) for (const width of [390, 1280] as const) for (const state of ["initial", "expanded", "collapsed", "reopened"] as const) {
    const id = `${surface}-${width}-${state}`;
    // Synthetic blank fixture tests artifact integrity, never visual meaning.
    const png = pngFixture(width);
    const image = { path: `${id}.png`, sha256: hash(png) }; await writeFile(join(dir, image.path), png);
    const observedAt = new Date().toISOString();
    const raw: Record<string, unknown> = { version: 2, ...binding, surface, state, observedAt, url: `http://test.local/${surface === "chat" ? "chat" : "characters"}/target`, viewport: { width, height: 844, devicePixelRatio: 1 }, metrics: { horizontalOverflowPx: 0, iframeOverflowPx: 0, rawCustomTagCount: 0, unresolvedUserNameCount: 0, clippedElementCount: 0, bodyHeight: 900, contentHeight: 900 }, interaction: { applicable: false, reason: "No source fold controls", action: "not-applicable", controlCount: 0, beforeHeight: 900, afterHeight: 900, expandedCount: 0 }, checks: Object.fromEntries(FIDELITY_CHECKS.map(check => [check, { status: check === "composerHit" && surface === "preview" ? "not-applicable" : "pass", detail: "Compared source and target component evidence" }])), mediaExceptions: [{ url: "https://source.example/optional.mp3", reason: "User authorized later audio repair", disposition: "deferred-authorized" }] };
    mutate?.(raw);
    const text = JSON.stringify(raw); const evidencePath = `${id}.json`; await writeFile(join(dir, evidencePath), text);
    report.observations.push({ surface, width, state, observedAt, evidencePath, evidenceSha256: hash(text), sourceScreenshot: image, targetScreenshot: image });
  }
  return { report, path: join(dir, "report.json"), dir };
}

test("boolean-only v1 evidence cannot pass", () => expect(verifyFidelityEvidence({ version: 1, observations: [] }, binding).ok).toBe(false));
test("opening one of several controls is incomplete, not a pass", async () => {
  const f = await fixture(raw => {
    raw.interaction = { applicable: true, action: "click source-comparable controls", controlCount: 3, expandedCount: raw.state === "collapsed" ? 0 : 1, beforeHeight: 900, afterHeight: 1000 };
  });
  expect((await verifyFidelityEvidenceFiles(f.report, expected, f.path)).errors.some(e => e.includes("EXPANSION_INCOMPLETE"))).toBe(true);
});
test("fractional control counts cannot pass acceptance", async () => {
  const f = await fixture(raw => {
    raw.interaction = { applicable: true, action: "click", controlCount: 1.5, expandedCount: 0, beforeHeight: 900, afterHeight: 900 };
  });
  expect((await verifyFidelityEvidenceFiles(f.report, expected, f.path)).errors.some(e => e.includes("INVALID_CONTROL_COUNTS"))).toBe(true);
});
test("all state files and exact target bindings required", async () => {
  const f = await fixture(); expect((await verifyFidelityEvidenceFiles(f.report, expected, f.path)).ok).toBe(true);
  f.report.observations.pop(); expect(verifyFidelityEvidence(f.report, binding).ok).toBe(false);
});
test("nonexistent proof and wrong digest rejected", async () => {
  const f = await fixture(); f.report.observations[0].evidencePath = "missing.json";
  expect((await verifyFidelityEvidenceFiles(f.report, expected, f.path)).ok).toBe(false);
  f.report.observations[0].evidencePath = "preview-390-initial.json"; f.report.observations[0].evidenceSha256 = "f".repeat(64);
  expect((await verifyFidelityEvidenceFiles(f.report, expected, f.path)).ok).toBe(false);
});
test("actual measured viewport cannot be relabeled", async () => {
  const f = await fixture(raw => { raw.viewport = { width: 999, height: 844, devicePixelRatio: 1 }; });
  expect((await verifyFidelityEvidenceFiles(f.report, expected, f.path)).errors.some(e => e.includes("ACTUAL_VIEWPORT_MISMATCH"))).toBe(true);
});
test("checks pass does not override raw render defects", async () => {
  const f = await fixture(raw => { (raw.metrics as Record<string, number>).unresolvedUserNameCount = 1; });
  expect((await verifyFidelityEvidenceFiles(f.report, expected, f.path)).errors.some(e => e.includes("OBSERVED_RENDER_DEFECT"))).toBe(true);
});
test("wrong role URL and stale raw observations fail", async () => {
  const f = await fixture(raw => { raw.url = "http://test.local/chat/another"; });
  expect((await verifyFidelityEvidenceFiles(f.report, expected, f.path)).errors.some(e => e.includes("WRONG_TARGET_URL"))).toBe(true);
  const valid = await fixture(); expect((await verifyFidelityEvidenceFiles(valid.report, { ...expected, notBefore: "2099-01-01T00:00:00Z" }, valid.path)).ok).toBe(false);
});
test("malformed rows fail safely and unknown states do not pad matrix", () => {
  expect(() => verifyFidelityEvidence({ version: 2, scope: "opening-and-source-components", ...binding, observations: [null] }, binding)).not.toThrow();
});
test("PNG header without image data cannot masquerade as screenshot", async () => {
  const f = await fixture(); const bytes = Buffer.alloc(40); Buffer.from("89504e470d0a1a0a", "hex").copy(bytes); bytes.write("IHDR", 12);
  await writeFile(join(f.dir, "fake.png"), bytes);
  f.report.observations[0].targetScreenshot = { path: "fake.png", sha256: hash(bytes) };
  expect((await verifyFidelityEvidenceFiles(f.report, expected, f.path)).ok).toBe(false);
});
