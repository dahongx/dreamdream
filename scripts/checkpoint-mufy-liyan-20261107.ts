import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = 'logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const dir = `${root}/final-acceptance/34`;
const started = performance.now();
const baseline = await readFile(`${dir}/owner-baseline-20261107.html`, 'utf8');
const candidate = await readFile(`${dir}/owner-candidate-20261107.html`, 'utf8');
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const addition = /\n<style data-nj-mufy-liyan-parent-box>[\s\S]*?<\/style>/;
if (candidate.replace(addition, '') !== baseline) throw new Error('UNEXPECTED_OWNER_DELTA');
const observedAt = new Date().toISOString();
const progress = {
  rank: 34, name: '黎俨', observedAt,
  status: 'owner-layout-repaired-actual-recheck-partial',
  baselineSha256: sha(baseline), candidateSha256: sha(candidate),
  actualWork: [
    'Chrome 5 recovered and actual source/target public pages loaded.',
    'Reproduced target 381px overflow inside 356px mobile opening; source parent fragment used border-box.',
    'Saved scoped parent fragment box, line-height, source paragraph overrides and responsive avatar adaptation through normal owner source UI.',
    'Actual mobile observation after second save: three roots source/target 356px widths; heights 220 / 266.666687 / 491.28125.',
    'Final target refreshed: desktop heights 220 / 266.666687 / 425.666687 match source. Container widths differ with platform columns (source478/target640), no target horizontal overflow.',
    'Final mobile original first world fold opens/closes, exact text and settled 390.28125px height both sides.',
    'Two historical unmatched URLs are music avatars, both originals actually decoded on source and target; screenshots saved.',
  ],
  evidence: [
    'current-box-model-finding-20261107.json', 'parent-layout-repair-20261107.json',
    'desktop-parent-parity-20261107.json', 'world-fold-post-repair-20261107.json',
    'music-avatar-source-parity-20261107.json',
  ],
  limitations: [
    'parent-layout-repair JSON caught a transient empty target array during refresh; subsequent actual observation showed all three matching mobile roots. Do not interpret the empty array as success.',
    'Final responsive avatar adaptation tested at outer390 and1280 only; intermediate tablet breakpoint not certified.',
    'Additional fold checks interrupted on source second world fold Input.dispatchMouseEvent timeout; state unknown, inspect before clicking again.',
    'Source original tab disappeared; inventory showed same source URL under1586146794. Rebinding timed out and reset kernel; subsequent getState timed out. Not a login/permission denial.',
    'Temporary390 viewport overrides could not be reset after browser control timed out; restore on recovery.',
  ],
  remaining: ['remaining changed-layout fold states', 'final mobile screenshot of final candidate', 'current runtime consolidated reply/visual gates'],
  fullFidelityAccepted: false,
  agentNetMs: null,
  timing: 'Measured browser step wall durations stay in individual evidence; no inferred net total, no user/scheduler waits counted.',
};
await writeFile(`${dir}/resume-checkpoint-20261107.json`, JSON.stringify(progress, null, 2));
const qa = JSON.parse(await readFile(`${root}/qa-progress.json`, 'utf8'));
const row = qa.rows.find((item: {rank: number}) => item.rank === 34);
row.latestActualRepair = { observedAt, evidence: 'final-acceptance/34/resume-checkpoint-20261107.json', candidateSha256: sha(candidate), fullFidelityAccepted: false };
qa.observedAt = observedAt;
await writeFile(`${root}/qa-progress.json`, JSON.stringify(qa, null, 2));
const queue = JSON.parse(await readFile(`${dir}/individual-closeout-queue-20261106.json`, 'utf8'));
queue.latestResume = row.latestActualRepair;
queue.browserBlock = '2026-11-07: recovered, real repair performed; later command and rebinding timeout, not Work permission denial';
await writeFile(`${dir}/individual-closeout-queue-20261106.json`, JSON.stringify(queue, null, 2));
// Keep the historical reconciliation intact, but prevent its old rank34 hash
// from being mistaken for the latest owner candidate on a later resume.
const reconciliation = JSON.parse(await readFile(`${root}/owner-save-reconciliation-20261106.json`, 'utf8'));
const prior = reconciliation.rows.find((item: {rank: number}) => item.rank === 34);
prior.supersededBy = {
  observedAt, candidateSha256: sha(candidate),
  evidence: 'final-acceptance/34/resume-checkpoint-20261107.json',
  action: 'Do not restore the November1 candidate. Current scoped owner repair was saved and observed in the actual target. Reopen current owner UI before any later mutation.',
};
await writeFile(`${root}/owner-save-reconciliation-20261106.json`, JSON.stringify(reconciliation, null, 2));
const continuation = JSON.parse(await readFile(`${root}/continuation-next-20261031.json`, 'utf8'));
continuation.latestOwnerRepair20261107 = row.latestActualRepair;
continuation.browserRecovery20261107 = {
  observedAt, scope: 'tool observations only, no additional page acceptance',
  previousGoalTurn: 'progress: real owner repair and public source comparison',
  browserInventoryAvailable: true, chromeWindowId: 264910,
  nativeWindowResult: 'window is minimized',
  pageBindingResult: '30-second binding timeout with kernel reset',
  attemptedRecovery: 'normal launch_app Chrome did not restore minimized window; repeated native read still reports minimized',
  userActionPending: 'Restore Chrome from taskbar, no permission or login change requested',
  noNewImports: true, noNewPaidSends: true, wholeBatchAccepted: false,
};
await writeFile(`${root}/continuation-next-20261031.json`, JSON.stringify(continuation, null, 2));
const elapsedMs = performance.now() - started;
await import('node:fs/promises').then(fs => fs.appendFile(`${root}/timing-runs.jsonl`, JSON.stringify({observedAt,phase:'local-checkpoint-integrity-and-write',elapsedMs,agentNetMs:elapsedMs,browserTimingIncluded:false})+'\n'));
console.log(JSON.stringify({rank:34,candidateSha256:sha(candidate),checkpointSaved:true,fullFidelityAccepted:false,computeElapsedMs:elapsedMs}));
