/** Evidence-only checkpoint: no remote mutation, model calls, or build. */
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const read = async (path: string) => JSON.parse(await readFile(`${root}/${path}`, 'utf8'));
const qa = await read('qa-progress.json');
const e = await read('final-acceptance/46/cloud-music-local-ui-check.json');
const candidate = await read('rule-repairs/46/native-cloud-music/candidate-proof.json');
const runtimeSha256 = createHash('sha256').update(await readFile('src/components/chat/MufyCloudMusic.tsx')).digest('hex');
if (qa.imported !== 28 || qa.held !== 2 || qa.fullFidelityAccepted !== 0) throw Error('BATCH_COUNTS_CHANGED');
if (e.runtimeSha256 !== runtimeSha256 || e.finalMobile.width !== e.finalMobile.scrollWidth || e.finalMobile.panel.w !== 310 || e.finalMobile.trigger.w !== 53 || e.finalMobile.authorFrames !== 0 || !e.finalMobile.audio.paused || e.refreshPreference.disabledLabel !== 1 || !e.refreshPreference.audio.paused || e.currentPlayAdvanced.paused || e.currentPlayAdvanced.time <= e.currentPlayStart.time || !e.finalMobile.sendCount.includes('发送回调次数：0')) throw Error('CURRENT_BROWSER_PROOF_REQUIRED');
const row = qa.rows.find((r: { rank: number }) => r.rank === 46);
row.cloudMusicCandidate = {
  observedAt: e.observedAt, runtimeSha256,
  evidence: 'final-acceptance/46/cloud-music-local-ui-check.json',
  candidateProof: 'rule-repairs/46/native-cloud-music/candidate-proof.json',
  firstTrackPlaybackConfirmed: true, secondTrackPlaybackConfirmed: false,
  secondTrackReason: '来源页未取得播放进度；本地原始链接本次播放请求返回 unavailable，未替换链接。',
  parentRepaintPlaybackPreserved: true, mobileContained: true,
  nativeControlsOnly: true, authorFrames: 0, sourceStorageRead: false,
  ownerUiSaved: false, baselineRequiresFreshOwnerUiVerification: true,
  buildStarted: false, deployed: false, fullFidelityAccepted: false,
};
qa.observedAt = new Date().toISOString();
await writeFile(`${root}/qa-progress.json`, JSON.stringify(qa, null, 2) + '\n');
const old = await readFile(`${root}/timing-runs.jsonl`, 'utf8');
const timing = { id: `cloud-stage-46-${candidate.observedAt}`, rank: 46, step: 'local-cloud-music-candidate-stage', observedAt: candidate.observedAt, elapsedMs: candidate.elapsedMs, kind: 'local-process-wall-not-agent-net', agentNetMs: null, deployed: false };
if (typeof timing.elapsedMs === 'number' && !old.includes(timing.id)) await appendFile(`${root}/timing-runs.jsonl`, JSON.stringify(timing) + '\n');
console.log(JSON.stringify({ rank: 46, imported: 28, held: 2, fullFidelityAccepted: 0, ownerUiWrites: 0, buildStarted: false, runtimeSha256 }));
