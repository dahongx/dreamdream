import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { verifyMufyReplyEvidence, type ReplyEvidence } from "../import/mufy-reply-review";

const binding = { sourceRuntimeSha256: "a".repeat(64), rendererSha256: "b".repeat(64), targetCharacterId: "target" };
const expected = { ...binding, targetBaseUrl: "http://test.local/chat/target", notBefore: "2026-01-01T00:00:00Z", openingText: "opening" };
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
function png(width: number) {
  const chunk = (kind: string, data: Buffer) => { const b = Buffer.alloc(data.length + 12); b.writeUInt32BE(data.length); b.write(kind, 4); data.copy(b, 8); return b; };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(200, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc((width * 3 + 1) * 200))), chunk("IEND", Buffer.alloc(0))]);
}
async function fixture(mutate?: (r: Record<string, unknown>) => void, inputs = ["later one", "later two"]) {
  const dir = await mkdtemp(join(tmpdir(), "mufy-replies-")); dirs.push(dir);
  const path = join(dir, "report.json");
  const save = async (name: string, b: string | Buffer) => { await writeFile(join(dir, name), b); return { path: name, sha256: hash(b) }; };
  const report: ReplyEvidence = { version: 1, scope: "continuous-replies", ...binding, cases: [] };
  for (const [i, input] of inputs.entries()) {
    const inputRef = await save(`${i}.txt`, input);
    const source = await save(`${i}-source.json`, JSON.stringify({ sourceRuntimeSha256: binding.sourceRuntimeSha256, inputSha256: inputRef.sha256, detail: "Source component review (synthetic unit fixture only)", contract: { transparentOuter: true, systemBoxCount: 1, controlCount: 2 } }));
    const entry: ReplyEvidence["cases"][number] = { input: inputRef, sourceObservation: source, sourceScreenshot: await save(`${i}-source.png`, png(390)), observations: [] };
    for (const width of [390, 1280] as const) for (const state of ["initial", "expanded", "collapsed", "reopened"] as const) {
      const raw: Record<string, unknown> = { ...binding, kind: "existing-chat-reply", role: "assistant", messageId: `message-${i}`, messageIndex: i + 1, inputSha256: inputRef.sha256, state, url: expected.targetBaseUrl, observedAt: new Date().toISOString(), viewport: { width, height: 200, devicePixelRatio: 1 }, metrics: { transparentOuter: true, systemBoxCount: 1, unstyledSystemBoxCount: 0, rawCustomTagCount: 0, unresolvedUserNameCount: 0, clippedElementCount: 0, consoleErrorCount: 0, horizontalOverflowPx: 0.25, iframeOverflowPx: 0, bodyHeight: 200, contentHeight: 200, controlCount: 2, expandedCount: state === "expanded" || state === "reopened" ? 2 : 0 }, visualStatus: "pass", visualComparison: "Synthetic unit fixture, not live evidence" };
      mutate?.(raw);
      entry.observations.push({ width, state, proof: await save(`${i}-${width}-${state}.json`, JSON.stringify(raw)), screenshot: await save(`${i}-${width}-${state}.png`, png(width)) });
    }
    report.cases.push(entry);
  }
  return { report, path };
}
test("missing reply report cannot complete", async () => expect((await verifyMufyReplyEvidence(undefined, expected, "missing.json")).ok).toBe(false));
test('visual passes cannot bypass a creator completion contract without actual raw reply evidence',async()=>{
 const f=await fixture();
 const result=await verifyMufyReplyEvidence(f.report,{...expected,outputSetting:'Cmtt_fold_block; 末尾必须☆已生成完整'},f.path);
 expect(result.ok).toBe(false);expect(result.errors.join()).toContain('RAW_COMPLETION_EVIDENCE_REQUIRED');
});
test('a manually supplied star cannot certify missing status content',async()=>{
 const f=await fixture();
 const raw='☆已生成完整';const rawPath=join(f.path,'..','raw.txt');await writeFile(rawPath,raw);
 for(const item of f.report.cases)item.rawReply={path:'raw.txt',sha256:hash(raw)};
 const result=await verifyMufyReplyEvidence(f.report,{...expected,outputSetting:'Cmtt_fold_block; 末尾必须☆已生成完整'},f.path);
 expect(result.ok).toBe(false);expect(result.errors.join()).toContain('THREE_STATUS_SECTIONS_REQUIRED');
});
test("two distinct full matrices with artifact bindings pass integrity gate", async () => { const f = await fixture(); expect((await verifyMufyReplyEvidence(f.report, expected, f.path)).errors).toEqual([]); });
for (const [name, mutate, reason] of [
  ["black outer canvas", (r: Record<string, unknown>) => { (r.metrics as Record<string, unknown>).transparentOuter = false; }, "BACKGROUND_REGRESSION"],
  ["missing system box", (r: Record<string, unknown>) => { (r.metrics as Record<string, unknown>).systemBoxCount = 0; }, "SYSTEM_BOX_REGRESSION"],
  ["fold partially opens", (r: Record<string, unknown>) => { (r.metrics as Record<string, unknown>).expandedCount = 1; }, "INTERACTION_INCOMPLETE"],
  ["fixture labeled as live", (r: Record<string, unknown>) => { r.kind = "offline-replay"; }, "PROVENANCE_REQUIRED"],
  ["opening labeled as reply", (r: Record<string, unknown>) => { r.messageIndex = 0; }, "PROVENANCE_REQUIRED"],
  ["wrong target", (r: Record<string, unknown>) => { r.url = "http://test.local/chat/other"; }, "WRONG_TARGET"],
  ["stale evidence", (r: Record<string, unknown>) => { r.observedAt = "2020-01-01"; }, "STALE_OR_FUTURE"],
  ["duplicate message IDs", (r: Record<string, unknown>) => { r.messageId = "same"; }, "DUPLICATE_MESSAGE_ID"],
  ["unrendered tags", (r: Record<string, unknown>) => { (r.metrics as Record<string, unknown>).rawCustomTagCount = 1; }, "RENDER_DEFECT"],
] as const) test(`${name} fails even with visual pass`, async () => { const f = await fixture(mutate); expect((await verifyMufyReplyEvidence(f.report, expected, f.path)).errors.join()).toContain(reason); });
test("opening and whitespace duplicates are rejected", async () => { for (const inputs of [["opening", "later"], ["same text", "same  text"]]) { const f = await fixture(undefined, inputs); expect((await verifyMufyReplyEvidence(f.report, expected, f.path)).ok).toBe(false); } });
test("missing state and tampered screenshot fail", async () => { const f = await fixture(); f.report.cases[0].observations.pop(); f.report.cases[1].observations[0].screenshot.sha256 = "f".repeat(64); const result = await verifyMufyReplyEvidence(f.report, expected, f.path); expect(result.errors.join()).toContain("EIGHT_STATES"); expect(result.errors.join()).toContain("HASH_MISMATCH"); });
