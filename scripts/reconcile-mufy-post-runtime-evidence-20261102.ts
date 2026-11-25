/** Reconcile existing public browser proofs; does not perform or claim a new UI test. */
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const started = performance.now();
const observedAt = new Date().toISOString();
const read = async (path: string) => JSON.parse(await readFile(`${root}/${path}`, 'utf8'));
const proof = async (path: string) => ({ path, sha256: createHash('sha256').update(await readFile(`${root}/${path}`)).digest('hex') });
const desktopPath = 'final-acceptance/41/post-reviewed-runtime-timeline-interaction-20261101.json';
const mobilePath = 'final-acceptance/41/post-reviewed-runtime-timeline-mobile-20261101.json';
const fontPath = 'final-acceptance/44/post-reviewed-runtime-font-source-target-20261101.json';
const desktop = await read(desktopPath), mobile = await read(mobilePath), font = await read(fontPath);
type TimelineRow = {label: string; sourceTextExact: boolean; closed: boolean; viewport?: number; rect: {width: number; height: number}};
for (const report of [desktop, mobile]) {
  if (report.rank !== 41 || report.rows.length !== 4 || !(report.rows as TimelineRow[]).every(r => r.sourceTextExact && r.closed)) throw Error('TIMELINE_PROOF_INCOMPLETE');
}
if (!mobile.mobileViewportApplied || !(mobile.rows as TimelineRow[]).every(r => r.viewport === 390 && r.rect.width === 390 && r.rect.height === 844)) throw Error('MOBILE_PROOF_INCOMPLETE');
if (font.rank !== 44 || font.sourceIndex !== 0 || !font.allRecordedFieldsExact || JSON.stringify(font.source) !== JSON.stringify(font.target)) throw Error('FONT_PROOF_INCOMPLETE');
const updates = [
  {rank: 41, index: 5, path: desktopPath, followup: [await proof(mobilePath)], status: 'matched', reason: 'Reviewed runtime and owner candidate are now deployed. Actual TEST desktop and390x844 mobile opened all four timeline modals; public source texts exact and each closed. Mobile overlays cover the viewport. Prior local trigger paint comparison retained; no physical touch or whole-card certification.'},
  {rank: 44, index: 0, path: fontPath, followup: [], status: 'pending', reason: 'Reviewed runtime is deployed. Actual public source/TEST text, computed font declaration,size,weight,line-height,color,background,hover shadow,original font import and FontFaceSet loaded status/size match. Individual font glyph loading is not proven; that font qualification remains pending. No substituted assets or whole-card certification.'},
];
for (const update of updates) {
  const path = `final-acceptance/${update.rank}/component-ui-mapping.json`;
  const mapping = await read(path);
  const row = mapping.rows.find((entry: {sourceIndex: number}) => entry.sourceIndex === update.index);
  if (!row) throw Error('MAPPING_ROW_MISSING');
  if (row.evidence !== update.path) {
    row.reconciliationHistory ??= [];
    row.reconciliationHistory.push({reconciledAt: observedAt, previous: structuredClone(row)});
  }
  Object.assign(row, {status: update.status, evidence: update.path, evidenceSha256: (await proof(update.path)).sha256, followupEvidence: update.followup, targetUiVerified: true, fidelityVerified: false, reason: update.reason});
  mapping.observedAt = observedAt;
  mapping.fullFidelityAccepted = false;
  await writeFile(`${root}/${path}`, JSON.stringify(mapping, null, 2));
}
const blocker = {observedAt, browserInventoryObserved: true, chromePresent: false, availableBrowser: 'Edge', sourceAndTestTabsPresent: false, productOutageProven: false, status: 'awaiting-original-Chrome-extension-reconnection', reauthenticationOrCredentialReads: false, browserPagesCheckedThisRun: 0};
await writeFile(`${root}/browser-connection-checkpoint-20261102.json`, JSON.stringify(blocker, null, 2));
const report = {observedAt, scope: 'Existing evidence reconciliation only; no new browser interaction or deployment', updates, fullFidelityAccepted: 0, browserBlockerEvidence: 'browser-connection-checkpoint-20261102.json', agentNetMs: null};
await writeFile(`${root}/post-runtime-evidence-reconciled-20261102.json`, JSON.stringify(report, null, 2));
const next = await read('continuation-next-20261031.json');
next.observedAt = observedAt;
next.latestEvidenceReconciliation = {evidence: 'post-runtime-evidence-reconciled-20261102.json', wholeCardPromotion: false};
next.browserConnection = blocker;
next.currentNextAction = 'Reconnect original Chrome extension, then verify rank43 star/t2 animations after normal scrolling into view before diagnosing a regression. Continue existing per-component pending gates; no repeated import, owner save or unchanged build. Clipboard read and Bilibili sandbox permissions remain separately pending.';
await writeFile(`${root}/continuation-next-20261031.json`, JSON.stringify(next, null, 2));
await appendFile(`${root}/timing-runs.jsonl`, JSON.stringify({observedAt, kind: 'offline-existing-public-proof-reconciliation-process-wall', elapsedMs: performance.now() - started, agentNetMs: null, browserPagesChecked: 0, deployed: false}) + '\n');
console.log(JSON.stringify({updatedComponents: updates.length, fullFidelityAccepted: 0, browserPagesChecked: 0}));
