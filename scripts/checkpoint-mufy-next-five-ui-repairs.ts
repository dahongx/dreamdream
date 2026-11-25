/** Evidence-only checkpoint. Normal website UI performed all TEST writes. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const startedAt=new Date().toISOString(),t=performance.now();
const commands=[];
for(const args of [['bun','test','src/lib/__tests__/mufy-reply-style-coverage.test.ts','scripts/tests/mufy-quote-compatibility.test.ts','src/components/chat/__tests__/mufy-native-layout.test.tsx'],['bun','x','tsc','--noEmit','-p','tsconfig.mufy-statusbar.json']]){
 const at=new Date().toISOString(),c0=performance.now();
 const p=Bun.spawn(args,{stdout:'pipe',stderr:'pipe'});
 const [out,err,exit]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
 commands.push({args,startedAt:at,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-c0,exit,output:out+err});
}
await writeFile(root+'/ui-repair-local-tests.json',JSON.stringify({commands,ok:commands.every(c=>c.exit===0)},null,2));
if(commands.some(c=>c.exit!==0))throw Error('LOCAL_REGRESSION_FAILED');
const json=async(name:string)=>JSON.parse(await readFile(root+'/'+name,'utf8'));
const mobile=await json('cuizhiyu-status-repaired-mobile.json');
const third=await json('cuizhiyu-third-reply-style-check.json');
const quote=await json('jianglai-quote-repaired-desktop.json');
if(mobile.viewport!==390||mobile.folds.length!==3||mobile.folds.some((f:{x:number,width:number,background:string})=>f.x!==16||f.width>358||f.background==='rgba(0, 0, 0, 0)'))throw Error('MOBILE_STATUS_STYLE_REQUIRED');
if(third.foldCount!==12||third.folds.some((f:{padding:string})=>f.padding!=='10px 12px'))throw Error('NEW_REPLY_STYLE_REQUIRED');
if(quote.literal!==0||quote.quotes!==8)throw Error('QUOTE_UI_PROOF_REQUIRED');
const result={observedAt:new Date().toISOString(),scope:'Two reported UI defects only; no exhaustive source fidelity claim',uiDefectsResolved:['Cui missing public status CSS','JiangLai literal dialogue quote markers'],testHost:'115.29.213.73:8091',normalUiWritesOnly:true,directDatabaseCommands:0,productionWrites:0,deployments:0,additionalLiveReplies:1,liveReplyCount:11,sourceCss:'cuizhiyu-public-status-style-raw.css',mobileProof:'cuizhiyu-status-repaired-mobile.json',newReplyProof:'cuizhiyu-third-reply-style-check.json',quoteProof:'jianglai-quote-repaired-desktop.json',agentGates:['Missing disclosure CSS stops future UI bundle preparation','Quote compatibility is explicitly labelled non-source and adds no model guidance'],remaining:[{card:'崔稚玉',kind:'generation-contract',reason:'The source author requires ☆已生成完整. Normal message Edit UI confirms the second completed reply lacks the marker, despite three populated status sections and closed HTML. Do not append a fake marker or promote to strict acceptance.'}],fullSourceFidelityClosed:false};
await writeFile(root+'/ui-repairs-20261022.json',JSON.stringify(result,null,2));
const review=await json('trial-review-20261022.json');
review.uiRepairReport='ui-repairs-20261022.json';review.liveReplyCount=11;review.knownDifferences=result.remaining;
review.discoveredAndResolvedUiDefects=result.uiDefectsResolved;
await writeFile(root+'/trial-review-20261022.json',JSON.stringify(review,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'verify-and-checkpoint-two-ui-repairs',kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:'ok',commands:commands.map(({output,...c})=>c)})+'\n');
console.log(JSON.stringify({uiDefectsResolved:result.uiDefectsResolved,fullSourceFidelityClosed:false,elapsedMs:performance.now()-t}));
