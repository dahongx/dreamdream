import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now(),observedAt=new Date().toISOString(),read=async(p:string)=>JSON.parse(await readFile(`${root}/${p}`,'utf8'));
const report=await read('internal-style-leak-batch-live-20261103.json');
const ranks=report.rows.map((r:{rank:number})=>r.rank);
if(ranks.length!==27||new Set(ranks).size!==27||ranks.includes(37)||!report.rows.every((r:{status:string;expectedFrames:number;frames:{internalCssLeaked:boolean}[]})=>r.status==='no-internal-style-leak-observed'&&r.expectedFrames===r.frames.length&&r.frames.every(f=>!f.internalCssLeaked)))throw Error('INCOMPLETE_OR_INVALID_LIVE_GATE');
const total=report.rows.reduce((n:number,r:{frames:unknown[]})=>n+r.frames.length,0);if(total!==298)throw Error('FRAME_RECONCILIATION_FAILED');
for(const file of ['qa-progress.json','continuation-next-20261031.json']){
 const data=await read(file);data.observedAt=observedAt;data.internalStyleVisibleTextGate={evidence:'internal-style-leak-batch-live-20261103.json',cards:27,actualFrames:298,unread:0,remainingObservedLeaks:0,onlyThisDefectClass:true,fullCardAccepted:0};
 if(file.startsWith('continuation'))data.currentNextAction='Continue remaining per-component fidelity gates; internal-CSS visible-text gate now actually covers27 eligible TEST cards/298 opening frames with no remaining observed leaks. Initial load/CDP failures preserved and only unread frames resumed. Rank38 UI repair persisted exact; protect new251299char candidate from rollback. Six-file player-name/toolbar runtime candidate remains local verified, not built/deployed; whole-batch-before-build still applies. Do not redo completed298-frame gate without relevant changes. Five-hour scheduler is prepared-not-created because manager tool absent; active goal continues.';
 await writeFile(`${root}/${file}`,JSON.stringify(data,null,2));
}
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({observedAt,kind:'internal-style-gate-reconciliation-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,cards:27,frames:298,fullFidelityAccepted:0})+'\n');
console.log(JSON.stringify({cards:27,frames:298,remainingStyleLeaks:0,fullCardAccepted:0}));
