import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { inflateSync } from "node:zlib";

export const FIDELITY_CHECKS = ["openingStyled", "noticeMatched", "userNameResolved", "sourceComponentsOnly", "mediaAccounted", "composerHit", "layoutMatched", "heightSettled"] as const;
export interface FidelityBinding {
  sourceRuntimeSha256: string;
  targetCharacterId: string;
  rendererSha256: string;
}
export interface FidelityArtifact { path: string; sha256: string }
export interface FidelityEvidence extends FidelityBinding {
  version: 2;
  scope: "opening-and-source-components";
  observations: Array<{
    surface: "preview" | "chat";
    width: 390 | 1280;
    state: "initial" | "expanded" | "collapsed" | "reopened";
    observedAt: string;
    evidencePath: string;
    evidenceSha256: string;
    sourceScreenshot: FidelityArtifact;
    targetScreenshot: FidelityArtifact;
  }>;
}
interface Verification { ok: boolean; errors: string[]; scope: "opening-and-source-components" }
const scope = "opening-and-source-components" as const;
const hashPattern = /^[a-f\d]{64}$/u;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const nonempty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const validTime = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
const digest = (v: Uint8Array) => createHash("sha256").update(v).digest("hex");

export function pngWidth(bytes: Buffer): number {
  if (bytes.length < 57 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("INVALID_PNG");
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width * height > 64_000_000 || bytes[24] !== 8 || bytes[28] !== 0) throw new Error("UNSUPPORTED_OR_EMPTY_PNG");
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[bytes[25]];
  if (!channels) throw new Error("INVALID_PNG_COLOR");
  const data: Buffer[] = [];
  let ended = false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset), kind = bytes.toString("ascii", offset + 4, offset + 8);
    if (offset + length + 12 > bytes.length) throw new Error("TRUNCATED_PNG");
    if (kind === "IDAT") data.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
    if (kind === "IEND") { ended = true; break; }
  }
  if (!ended || !data.length) throw new Error("PNG_IMAGE_DATA_REQUIRED");
  const pixels = inflateSync(Buffer.concat(data), { maxOutputLength: 256_000_000 });
  if (pixels.length !== (width * channels + 1) * height) throw new Error("INVALID_PNG_PIXEL_DATA");
  return width;
}

/** Shared evidence reader: no network, no credential/state access. */
export async function readMufyEvidenceArtifact(reportPath: string, ref: FidelityArtifact): Promise<Buffer> {
  const root = await realpath(dirname(reportPath));
  const path = await realpath(resolve(root, ref.path));
  const rel = relative(root, path);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith("../") || rel.startsWith("..\\")) throw new Error("ARTIFACT_OUTSIDE_REPORT_DIRECTORY");
  const bytes = await readFile(path);
  if (!hashPattern.test(ref.sha256) || digest(bytes) !== ref.sha256) throw new Error("ARTIFACT_HASH_MISMATCH");
  return bytes;
}

/** Native browser screenshots may be CSS-pixel JPEGs on a HiDPI display.
 * Keep hardware DPR truthful and verify the original raster independently;
 * never upscale an image merely to satisfy a DPR-sized PNG requirement. */
export function jpegDimensions(bytes:Buffer):{width:number;height:number}{
  if(bytes.length<12 || bytes[0]!==255 || bytes[1]!==216 || bytes.at(-2)!==255 || bytes.at(-1)!==217)throw Error("INVALID_NATIVE_JPEG");
  for(let p=2;p+4<bytes.length;){
    if(bytes[p++]!==255)throw Error("INVALID_NATIVE_JPEG_MARKER");
    while(bytes[p]===255)p++;
    const marker=bytes[p++];
    if(marker===0xda || marker===0xd9)break;
    if(marker===0x01 || (marker>=0xd0 && marker<=0xd7))continue;
    const length=bytes.readUInt16BE(p);
    if(length<2 || p+length>bytes.length)throw Error("TRUNCATED_NATIVE_JPEG");
    if(marker===0xc0 || marker===0xc2){
      if(length<8)throw Error("INVALID_NATIVE_JPEG_SIZE");
      const height=bytes.readUInt16BE(p+3),width=bytes.readUInt16BE(p+5);
      if(!width || !height)throw Error("INVALID_NATIVE_JPEG_SIZE");
      return{width,height};
    }
    p+=length;
  }
  throw Error("NATIVE_JPEG_SIZE_REQUIRED");
}
export async function verifyMufyScreenshotGeometry(bytes:Buffer,viewport:{width:number;height:number;devicePixelRatio:number;clientWidth?:number},capture:unknown,reportPath:string):Promise<void>{
  const width=pngWidth(bytes),height=bytes.readUInt32BE(20);
  let ratio=viewport.devicePixelRatio;
  if(capture!==undefined){
    if(!record(capture) || capture.backend!=="native-browser-api" || capture.normalization!=="jpeg-to-png-no-resize" || !record(capture.original) || !nonempty(capture.original.path) || !nonempty(capture.original.sha256))throw Error("NATIVE_CAPTURE_BINDING_REQUIRED");
    const original=await readMufyEvidenceArtifact(reportPath,capture.original as unknown as FidelityArtifact);
    const size=jpegDimensions(original);
    if(size.width!==width || size.height!==height)throw Error("NATIVE_SCREENSHOT_RESIZED");
    ratio=1;
    if(capture.rasterMode==="client-width-scaled-viewport"){
      const clientWidth=viewport.clientWidth;
      if(!Number.isSafeInteger(clientWidth) || !clientWidth || clientWidth>viewport.width || viewport.width-clientWidth>32)throw Error("NATIVE_VIEWPORT_FOOTPRINT_REQUIRED");
      ratio=clientWidth/viewport.width;
    }else if(capture.rasterMode!==undefined)throw Error("NATIVE_CAPTURE_MODE_INVALID");
    if(capture.pixelRatio!==ratio)throw Error("NATIVE_CAPTURE_RATIO_MISMATCH");
  }
  if(Math.abs(width-viewport.width*ratio)>1 || Math.abs(height-viewport.height*ratio)>1)throw Error("SCREENSHOT_VIEWPORT_MISMATCH");
}

/** Structural validation is not acceptance: the orchestrator must also read
 * and verify the actual artifacts with verifyFidelityEvidenceFiles. */
export function verifyFidelityEvidence(value: unknown, expected: FidelityBinding): Verification {
  const errors: string[] = [];
  if (!record(value) || value.version !== 2 || value.scope !== scope || !Array.isArray(value.observations)) return { ok: false, errors: ["FIDELITY_V2_EVIDENCE_REQUIRED"], scope };
  for (const key of ["sourceRuntimeSha256", "targetCharacterId", "rendererSha256"] as const) if (value[key] !== expected[key] || !nonempty(expected[key])) errors.push(`FIDELITY_BINDING_MISMATCH:${key}`);
  if (value.observations.length !== 16) errors.push("FIDELITY_EXACTLY_16_STATES_REQUIRED");
  for (const surface of ["preview", "chat"] as const) for (const width of [390, 1280] as const) for (const state of ["initial", "expanded", "collapsed", "reopened"] as const) {
    const id = `${surface}:${width}:${state}`;
    const rows = value.observations.filter(r => record(r) && r.surface === surface && r.width === width && r.state === state);
    if (rows.length !== 1) { errors.push(`FIDELITY_STATE_MISSING_OR_DUPLICATE:${id}`); continue; }
    const row = rows[0] as Record<string, unknown>;
    if (!nonempty(row.evidencePath) || typeof row.evidenceSha256 !== "string" || !hashPattern.test(row.evidenceSha256) || !validTime(row.observedAt)) errors.push(`FIDELITY_PROOF_MISSING:${id}`);
    for (const name of ["sourceScreenshot", "targetScreenshot"] as const) {
      const artifact = row[name];
      if (!record(artifact) || !nonempty(artifact.path) || typeof artifact.sha256 !== "string" || !hashPattern.test(artifact.sha256)) errors.push(`FIDELITY_SCREENSHOT_MISSING:${id}:${name}`);
    }
  }
  return { ok: errors.length === 0, errors, scope };
}

/** Hash-bound local browser artifacts reject stale, wrong-target and missing
 * observations. A malicious/fabricated capture producer is not a trusted
 * attestation: visual meaning still needs a source-comparing browser reviewer. */
export async function verifyFidelityEvidenceFiles(value: unknown, expected: FidelityBinding & { targetBaseUrl: string; notBefore: string }, reportPath: string): Promise<Verification> {
  const result = verifyFidelityEvidence(value, expected);
  if (!result.ok) return result;
  const errors = [...result.errors];
  const report = value as FidelityEvidence;
  const targetOrigin = new URL(expected.targetBaseUrl).origin;
  const earliest = Date.parse(expected.notBefore);
  if (!Number.isFinite(earliest)) return { ok: false, errors: ["FIDELITY_MIGRATION_TIME_REQUIRED"], scope };
  async function artifact(ref: FidelityArtifact): Promise<Buffer> {
    return readMufyEvidenceArtifact(reportPath, ref);
  }
  for (const row of report.observations) {
    const id = `${row.surface}:${row.width}:${row.state}`;
    try {
      const raw: unknown = JSON.parse((await artifact({ path: row.evidencePath, sha256: row.evidenceSha256 })).toString("utf8"));
      if (!record(raw)) throw new Error("OBSERVATION_NOT_OBJECT");
      for (const key of ["sourceRuntimeSha256", "targetCharacterId", "rendererSha256"] as const) if (raw[key] !== expected[key]) throw new Error(`RAW_BINDING_MISMATCH:${key}`);
      if (raw.version !== 2 || raw.surface !== row.surface || raw.state !== row.state || raw.observedAt !== row.observedAt) throw new Error("RAW_STATE_MISMATCH");
      const timestamp = Date.parse(row.observedAt);
      if (timestamp < earliest || timestamp > Date.now() + 60_000) throw new Error("STALE_OR_FUTURE_OBSERVATION");
      const url = new URL(String(raw.url));
      if (url.origin !== targetOrigin || url.pathname !== `/${row.surface === "chat" ? "chat" : "characters"}/${expected.targetCharacterId}`) throw new Error("WRONG_TARGET_URL");
      if (!record(raw.viewport) || raw.viewport.width !== row.width || !finite(raw.viewport.height) || raw.viewport.height < 200 || !finite(raw.viewport.devicePixelRatio) || raw.viewport.devicePixelRatio <= 0) throw new Error("ACTUAL_VIEWPORT_MISMATCH");
      for (const name of ["sourceScreenshot", "targetScreenshot"] as const) {
        const bytes = await artifact(row[name]);
        pngWidth(bytes);
        if (name === "targetScreenshot") await verifyMufyScreenshotGeometry(bytes,raw.viewport as {width:number;height:number;devicePixelRatio:number},raw.capture,reportPath);
      }
      if (!record(raw.metrics)) throw new Error("MEASUREMENTS_REQUIRED");
      for (const key of ["horizontalOverflowPx", "iframeOverflowPx", "rawCustomTagCount", "unresolvedUserNameCount", "clippedElementCount", "bodyHeight", "contentHeight"] as const) if (!finite(raw.metrics[key])) throw new Error(`INVALID_MEASUREMENT:${key}`);
      if ((raw.metrics.horizontalOverflowPx as number) > 2 || (raw.metrics.iframeOverflowPx as number) > 2 || raw.metrics.rawCustomTagCount !== 0 || raw.metrics.unresolvedUserNameCount !== 0 || raw.metrics.clippedElementCount !== 0) throw new Error("OBSERVED_RENDER_DEFECT");
      if (raw.metrics.bodyHeight === 0 || raw.metrics.contentHeight === 0) throw new Error("EMPTY_RENDER");
      if (!record(raw.interaction) || typeof raw.interaction.applicable !== "boolean" || !nonempty(raw.interaction.action)) throw new Error("INTERACTION_RECORD_REQUIRED");
      for (const key of ["controlCount", "beforeHeight", "afterHeight", "expandedCount"] as const) if (!finite(raw.interaction[key])) throw new Error(`INVALID_INTERACTION:${key}`);
      if (!raw.interaction.applicable && (!nonempty(raw.interaction.reason) || raw.interaction.action !== "not-applicable" || raw.interaction.controlCount !== 0)) throw new Error("UNEXPLAINED_NON_APPLICABILITY");
      if (raw.interaction.applicable && row.state !== "initial" && raw.interaction.controlCount === 0) throw new Error("INTERACTION_WITHOUT_CONTROL");
      // Counts cover source-comparable, operable controls, excluding hidden
      // author-only summaries. Opening one of many is not full coverage.
      if (!Number.isInteger(raw.interaction.controlCount) || !Number.isInteger(raw.interaction.expandedCount) || (raw.interaction.expandedCount as number) > (raw.interaction.controlCount as number)) throw new Error("INVALID_CONTROL_COUNTS");
      if (raw.interaction.applicable && (row.state === "expanded" || row.state === "reopened") && raw.interaction.expandedCount !== raw.interaction.controlCount) throw new Error("EXPANSION_INCOMPLETE");
      if (raw.interaction.applicable && row.state === "collapsed" && raw.interaction.expandedCount !== 0) throw new Error("COLLAPSE_DID_NOT_CLOSE_CONTROL");
      if (!record(raw.checks)) throw new Error("CHECK_DETAILS_REQUIRED");
      for (const check of FIDELITY_CHECKS) {
        const finding = raw.checks[check];
        if (!record(finding) || !nonempty(finding.detail) || !["pass", "not-applicable"].includes(String(finding.status))) throw new Error(`CHECK_FAILED:${check}`);
        if (finding.status === "not-applicable" && !(check === "composerHit" && row.surface === "preview") && !(check === "heightSettled" && !raw.interaction.applicable)) throw new Error(`CHECK_NON_APPLICABILITY_NOT_ALLOWED:${check}`);
      }
      if (!Array.isArray(raw.mediaExceptions) || raw.mediaExceptions.some(item => !record(item) || !nonempty(item.url) || !nonempty(item.reason) || item.disposition !== "deferred-authorized")) throw new Error("MEDIA_EXCEPTION_DETAILS_REQUIRED");
    } catch (error) {
      errors.push(`FIDELITY_ARTIFACT_INVALID:${id}:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { ok: errors.length === 0, errors, scope };
}
