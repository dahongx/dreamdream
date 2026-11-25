import { createHash } from "node:crypto";
import { pngWidth, readMufyEvidenceArtifact, verifyMufyScreenshotGeometry, type FidelityArtifact, type FidelityBinding } from "./mufy-fidelity-review";
import {reviewMufyCompletion} from './mufy-completion-contract';

export const REPLY_ACCEPTANCE_SCOPE = "opening-and-continuous-replies" as const;
const states = ["initial", "expanded", "collapsed", "reopened"] as const;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export interface ReplyEvidence extends FidelityBinding {
  version: 1;
  scope: "continuous-replies";
  cases: Array<{
    input: FidelityArtifact;
    sourceObservation: FidelityArtifact;
    sourceScreenshot: FidelityArtifact;
    /** Normal owner message Edit/Copy UI capture. Required for suffix contracts. */
    rawReply?: FidelityArtifact;
    observations: Array<{
      width: 390 | 1280;
      state: typeof states[number];
      proof: FidelityArtifact;
      screenshot: FidelityArtifact;
    }>;
  }>;
}

/** A saved existing assistant reply is sufficient; never sends paid messages.
 * Replay fixtures remain useful regression tests but cannot attest live chat.
 * Hashes establish provenance/integrity, not an independent visual judgement. */
export async function verifyMufyReplyEvidence(
  value: unknown,
  expected: FidelityBinding & { targetBaseUrl: string; notBefore: string; openingText: string; outputSetting?: string },
  reportPath: string,
) {
  const errors: string[] = [];
  const fail = (reason: string) => { throw new Error(reason); };
  if (!object(value) || value.version !== 1 || value.scope !== "continuous-replies" || !Array.isArray(value.cases)) return { ok: false, errors: ["REPLY_EVIDENCE_REQUIRED"], scope: "continuous-replies" };
  for (const key of ["sourceRuntimeSha256", "targetCharacterId", "rendererSha256"] as const) if (!text(expected[key]) || value[key] !== expected[key]) errors.push(`REPLY_BINDING_MISMATCH:${key}`);
  if (value.cases.length < 2) errors.push("REPLY_TWO_DISTINCT_LATER_MESSAGES_REQUIRED");
  const earliest = Date.parse(expected.notBefore);
  if (!Number.isFinite(earliest)) errors.push("REPLY_WRITE_TIME_REQUIRED");
  const seen = new Set<string>();
  const messages = new Set<string>();
  const completionReplyHashes=new Set<string>();
  for (const [index, item] of (value as unknown as ReplyEvidence).cases.entries()) {
    try {
      if (!object(item) || !object(item.input) || !object(item.sourceObservation) || !Array.isArray(item.observations)) fail("REPLY_CASE_INVALID");
      const input = (await readMufyEvidenceArtifact(reportPath, item.input)).toString("utf8");
      const inputHash = hash(input);
      if(expected.outputSetting?.includes('☆已生成完整')&&(expected.outputSetting.includes('Cmtt_fold_block')||expected.outputSetting.includes('三个状态栏'))){
        if(!item.rawReply)fail('REPLY_RAW_COMPLETION_EVIDENCE_REQUIRED');
        const rawReply=(await readMufyEvidenceArtifact(reportPath,item.rawReply!)).toString('utf8');
        const completion=reviewMufyCompletion(rawReply);
        if(!completion.ok)fail('REPLY_COMPLETION_CONTRACT_FAILED:'+completion.errors.join(','));
        const replyHash=hash(rawReply);
        if(completionReplyHashes.has(replyHash))fail('REPLY_COMPLETION_DUPLICATE_RAW_OUTPUT');
        completionReplyHashes.add(replyHash);
      }
      const normalized = input.replace(/\s+/gu, "").trim();
      if (!normalized || normalized === expected.openingText.replace(/\s+/gu, "").trim() || seen.has(hash(normalized))) fail("REPLY_OPENING_OR_DUPLICATE_INPUT");
      seen.add(hash(normalized));
      const source: unknown = JSON.parse((await readMufyEvidenceArtifact(reportPath, item.sourceObservation)).toString("utf8"));
      pngWidth(await readMufyEvidenceArtifact(reportPath, item.sourceScreenshot));
      if (!object(source) || source.sourceRuntimeSha256 !== expected.sourceRuntimeSha256 || source.inputSha256 !== inputHash || !text(source.detail) || !object(source.contract)) fail("REPLY_SOURCE_CONTRACT_REQUIRED");
      const contract = (source as Record<string, unknown>).contract as Record<string, unknown>;
      if (typeof contract.transparentOuter !== "boolean" || !count(contract.systemBoxCount) || !count(contract.controlCount)) fail("REPLY_SOURCE_CONTRACT_INVALID");
      if (item.observations.length !== 8) fail("REPLY_EIGHT_STATES_REQUIRED");
      let messageId: string | undefined;
      for (const width of [390, 1280]) for (const state of states) {
        const rows = item.observations.filter(row => object(row) && row.width === width && row.state === state);
        if (rows.length !== 1) fail(`REPLY_STATE_MISSING_OR_DUPLICATE:${width}:${state}`);
        const row = rows[0];
        const raw: unknown = JSON.parse((await readMufyEvidenceArtifact(reportPath, row.proof)).toString("utf8"));
        if (!object(raw)) fail("REPLY_PROOF_INVALID");
        const r = raw as Record<string, unknown>;
        for (const key of ["sourceRuntimeSha256", "targetCharacterId", "rendererSha256"] as const) if (r[key] !== expected[key]) fail(`REPLY_RAW_BINDING_MISMATCH:${key}`);
        if (r.kind !== "existing-chat-reply" || r.role !== "assistant" || !text(r.messageId) || !count(r.messageIndex) || r.messageIndex < 1 || r.inputSha256 !== inputHash || r.state !== state) fail("REPLY_LIVE_LATER_MESSAGE_PROVENANCE_REQUIRED");
        if (messageId !== undefined && r.messageId !== messageId) fail("REPLY_MESSAGE_CHANGED_BETWEEN_STATES");
        messageId = String(r.messageId);
        const url = new URL(String(r.url));
        if (url.origin !== new URL(expected.targetBaseUrl).origin || url.pathname !== `/chat/${expected.targetCharacterId}`) fail("REPLY_WRONG_TARGET_URL");
        const at = Date.parse(String(r.observedAt));
        if (!Number.isFinite(at) || at < earliest || at > Date.now() + 60_000) fail("REPLY_STALE_OR_FUTURE");
        if (!object(r.viewport) || r.viewport.width !== width || !count(r.viewport.height) || r.viewport.height < 200 || typeof r.viewport.devicePixelRatio !== "number" || !Number.isFinite(r.viewport.devicePixelRatio) || r.viewport.devicePixelRatio <= 0) fail("REPLY_VIEWPORT_INVALID");
        const viewport = r.viewport as Record<string, number>;
        await verifyMufyScreenshotGeometry(await readMufyEvidenceArtifact(reportPath,row.screenshot),viewport as {width:number;height:number;devicePixelRatio:number},r.capture,reportPath);
        if (!object(r.metrics)) fail("REPLY_MEASUREMENTS_REQUIRED");
        const m = r.metrics as Record<string, unknown>;
        for (const key of ["systemBoxCount", "unstyledSystemBoxCount", "rawCustomTagCount", "unresolvedUserNameCount", "clippedElementCount", "controlCount", "expandedCount", "consoleErrorCount"]) if (!count(m[key])) fail(`REPLY_MEASUREMENT_INVALID:${key}`);
        for (const key of ["horizontalOverflowPx", "iframeOverflowPx", "bodyHeight", "contentHeight"]) if (typeof m[key] !== "number" || !Number.isFinite(m[key]) || Number(m[key]) < 0) fail(`REPLY_MEASUREMENT_INVALID:${key}`);
        if (typeof m.transparentOuter !== "boolean" || (contract.transparentOuter && !m.transparentOuter)) fail("REPLY_OUTER_BACKGROUND_REGRESSION");
        if (m.systemBoxCount !== contract.systemBoxCount || m.unstyledSystemBoxCount !== 0) fail("REPLY_SYSTEM_BOX_REGRESSION");
        if (m.rawCustomTagCount !== 0 || m.unresolvedUserNameCount !== 0 || m.clippedElementCount !== 0 || m.consoleErrorCount !== 0 || Number(m.horizontalOverflowPx) > 2 || Number(m.iframeOverflowPx) > 2 || !m.bodyHeight || !m.contentHeight) fail("REPLY_RENDER_DEFECT");
        if (m.controlCount !== contract.controlCount || Number(m.expandedCount) > Number(m.controlCount) || ((state === "expanded" || state === "reopened") && m.expandedCount !== m.controlCount) || (state === "collapsed" && m.expandedCount !== 0)) fail("REPLY_INTERACTION_INCOMPLETE");
        if (!text(r.visualComparison) || r.visualStatus !== "pass") fail("REPLY_VISUAL_COMPARISON_REQUIRED");
      }
      if (messageId && messages.has(messageId)) fail("REPLY_DUPLICATE_MESSAGE_ID");
      if (messageId) messages.add(messageId);
    } catch (error) {
      errors.push(`REPLY_CASE:${index}:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { ok: errors.length === 0, errors, scope: "continuous-replies" };
}
