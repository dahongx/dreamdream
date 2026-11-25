#!/usr/bin/env bun
/** Offline public evidence reconciliation. No network, prompt or database access. */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readMufyEvidenceArtifact, verifyMufyScreenshotGeometry } from "../src/lib/import/mufy-fidelity-review";

const rootFlag=process.argv.indexOf("--root");
const root = resolve(rootFlag>=0 ? process.argv[rootFlag+1] : "logs/mufy-profiles/full-20261013/pilot-5/browser-quality-20261019");
const cards = [
  ["风满楼", "fe98aa2c-877d-4010-87b7-14cfb45c2b57"],
  ["祁远宁", "c4b0f4c0-9154-4bfe-b4ab-3d5956f025e4"],
  ["宋怀远", "00d8bf4e-0b36-4899-94b6-28d72e7e1111"],
  ["周岳山", "1450ab15-eb6e-4f04-8fb3-4a3765dc3a59"],
  ["薛山烬", "d8964664-6c49-4303-aba1-a722ed09e198"],
] as const;
type Frame = { text: string; overflowPx: number; unresolvedUser: boolean; sourceCanvas?: boolean; bodyBackground: string; images: Array<{ loaded: boolean; pending: boolean }> };
type Observation = {
  version: number; state?: string; card?: { id: string; name: string }; width?: number;
  expected?: { characterId: string; characterName: string; width: number; surface: string; state: string;messageIndex?:number };
  host: { width: number; height: number; clientWidth?:number; dpr: number; assistantRows: number; userRows: number };
  url: string; observedAt: string; frames: Frame[]; elapsedMs: number;
  screenshot?: { path: string; sha256: string };
  messages?: Array<{text:string;overflowPx:number;unresolvedUser:boolean}>;
  capture?:unknown;
};
const observations = new Map<string, { file: string; value: Observation; pngVerified: boolean; screenshotError?: string }>();
const excluded: Array<{ file: string; reason: string }> = [];
for (const file of await readdir(root)) {
  if (!/\.json$/u.test(file)) continue;
  const row = JSON.parse(await readFile(join(root, file), "utf8")) as Observation;
  if(!row.expected && !row.card) continue;
  const id = row.expected?.characterId ?? row.card?.id;
  const name = row.expected?.characterName ?? row.card?.name;
  const width = row.expected?.width ?? row.width;
  const state = row.expected?.state ?? row.state?.replace(/^preview-/u, "");
  const surface = row.expected?.surface ?? (row.state?.startsWith("preview-") ? "preview" : "chat");
  try {
    if (!cards.some(([n, i]) => i === id && n === name) || !row.host || row.host.width !== width || ![390, 1280].includes(Number(width))) throw Error("ACTUAL_CARD_OR_VIEWPORT_MISMATCH");
    if (!["initial", "expanded", "collapsed", "reopened"].includes(String(state))) throw Error("STATE_INVALID");
    const url = new URL(row.url);
    if (url.origin !== "http://115.29.213.73:8091" || url.pathname !== `/${surface === "preview" ? "characters" : "chat"}/${id}`) throw Error("WRONG_TARGET_SURFACE");
    if (!(row.frames?.some(f => f.text?.trim().length) || row.messages?.some(m=>m.text?.trim().length)) || !Number.isFinite(Date.parse(row.observedAt))) throw Error("NO_OBSERVED_RENDER");
    let pngVerified = false, screenshotError: string | undefined;
    try {
      if (!row.screenshot) throw Error("SCREENSHOT_MISSING");
      const bytes = await readMufyEvidenceArtifact(join(root, file), row.screenshot);
      await verifyMufyScreenshotGeometry(bytes,{width:row.host.width,height:row.host.height,clientWidth:row.host.clientWidth,devicePixelRatio:row.host.dpr},row.capture,join(root,file));
      pngVerified = true;
    } catch (error) { screenshotError = String(error); }
    const key = `${id}:${surface}:${width}:${state}`+(row.expected?.messageIndex===undefined ? "" : `:reply:${row.expected.messageIndex}`);
    if (observations.has(key)) throw Error("DUPLICATE_STATE");
    observations.set(key, { file, value: row, pngVerified, screenshotError });
  } catch (error) { excluded.push({ file, reason: String(error) }); }
}
const rows = cards.map(([name, id]) => {
  const entries = [...observations].filter(([key]) => key.startsWith(id + ":")).map(([, v]) => v);
  const missingStates: string[] = [];
  for (const surface of ["chat", "preview"]) for (const width of [390, 1280]) for (const state of ["initial", "expanded", "collapsed", "reopened"]) if (!observations.has(`${id}:${surface}:${width}:${state}`)) missingStates.push(`${surface}:${width}:${state}`);
  const frames = entries.flatMap(r => r.value.frames);
  const chatRows = entries.filter(r => new URL(r.value.url).pathname.startsWith("/chat/"));
  const existingLaterReplies = Math.max(0, ...chatRows.map(r => r.value.host.assistantRows - 1));
  return { name, id, observedStates: entries.length, missingStates,
    wholeSurfaceStates:entries.filter(r=>r.value.expected?.messageIndex===undefined).length,
    focusedReplyStates:entries.filter(r=>r.value.expected?.messageIndex!==undefined).length,
    pngBoundStates: entries.filter(r => r.pngVerified).length,
    maxObservedIframeOverflowPx: Math.max(0, ...frames.map(f => f.overflowPx)),
    unresolvedUserObserved: frames.some(f => f.unresolvedUser),
    sourceCanvasBlackObserved: frames.some(f => f.sourceCanvas && f.bodyBackground !== "rgba(0, 0, 0, 0)"),
    existingLaterReplies, continuousReplyEvidenceReady: false, finalAccepted: false,
    remaining: [...(existingLaterReplies < 2 ? ["This evidence directory does not establish two live later replies; check the generation ledger before sending again"] : ["Bind and source-compare later message evidence"]), "Review actual screenshot pixels: PNG geometry does not establish compositor freshness", "Complete source-comparing fidelity, custom interactions, and media dispositions; structural states alone are not completion"],
  };
});
const result = { version: 2, generatedAt: new Date().toISOString(), nextBatchSize: 5, finalAccepted: false,
  scope: "public-browser-observation-checkpoint-not-final-fidelity", observedStates: observations.size,
  pngBoundStates: [...observations.values()].filter(r => r.pngVerified).length,
  excluded, rows,
  screenshotIssues: [...observations.values()].filter(r => !r.pngVerified).map(r => ({ file: r.file, reason: r.screenshotError })),
  timing: { v1ObservationOnlyMs: [...observations.values()].filter(r => r.value.version === 1).reduce((n, r) => n + r.value.elapsedMs, 0), v2StepIncludingClicksAndPngMs: [...observations.values()].filter(r => r.value.version === 2).reduce((n, r) => n + r.value.elapsedMs, 0), note: "Different scopes are not total agent net work; no user idle/scheduling gap included" },
  paidSendsPerformed: 0, directDatabaseOperations: 0,
};
await writeFile(join(root, "reconciled-summary.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ observedStates: result.observedStates, pngBoundStates: result.pngBoundStates, excluded: excluded.length, rows, finalAccepted: false }, null, 2));
