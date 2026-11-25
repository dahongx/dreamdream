import {readFile,writeFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/pilot-5';
const session='20261015T010316Z';
const rows=(await readFile(root+'/repair-execution.jsonl','utf8')).trim().split(/\r?\n/).map(s=>JSON.parse(s)).filter(r=>r.session===session);
const spans=rows.map(r=>[Date.parse(r.startedAt),Date.parse(r.finishedAt)]).sort((a,b)=>a[0]-b[0]);
let union=0,end=0;
for(const [a,b] of spans){union+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
const state=JSON.parse(await readFile(root+'/repair-20261015-session.json','utf8'));
state.measuredThrough=new Date().toISOString();
state.engineeringWallMs=Date.parse(state.measuredThrough)-Date.parse(state.startedAt);
state.commandSummary={records:rows.length,failed:rows.filter(r=>r.exitCode!==0).length,sumMs:rows.reduce((s,r)=>s+r.measuredExecutionMs,0),nonOverlappingMs:union};
state.userPauseRecordedMs=0;
state.timingLimitations=['No user pause observed during this repair session; historical user review is separate.','Command time includes transfer/build/network waits; it is not CPU time.','Unwrapped browser actions and diagnosis are covered only by engineering wall time, not fabricated per-action timing.','One command launch failure before process creation has no JSONL duration; covered by wall time.'];
state.phases=[
 {name:'来源及根因核对 渲染合同与首轮修复',start:'2026-10-15T01:03:16Z',end:'2026-10-15T01:30:07Z'},
 {name:'首次回放及元数据匹配修复 动画资源补齐',start:'2026-10-15T01:30:07Z',end:'2026-10-15T01:37:34Z'},
 {name:'手机复验 图片与模板事件补修',start:'2026-10-15T01:37:34Z',end:'2026-10-15T02:03:24Z'},
 {name:'临时盘恢复 回放及视觉复验 逐项返修',start:'2026-10-15T02:03:24Z',end:'2026-10-15T02:38:00Z'},
 {name:'平台正文输入桥接补修 构建及部署',start:'2026-10-15T02:38:00Z',end:'2026-10-15T02:44:16Z'},
 {name:'最终重点交互回归与报告',start:'2026-10-15T02:44:16Z',end:state.measuredThrough}
];
state.phasePrecision='Observed stage boundaries rounded to seconds/minutes; not independent per-bug stopwatches.';
state.status='focused-defects-repaired-full-fidelity-evidence-pending';
state.fullFidelityAccepted=false;
state.reviewPath=root+'/repair-20261015-review.md';
await writeFile(root+'/repair-20261015-session.json',JSON.stringify(state,null,2));
console.log(JSON.stringify({wallMinutes:state.engineeringWallMs/60000,commandMinutes:union/60000,records:rows.length,failed:state.commandSummary.failed}));
