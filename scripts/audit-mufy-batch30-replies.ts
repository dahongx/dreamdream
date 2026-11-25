/** Offline evidence audit. Never imports cards, edits replies or grants acceptance. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {findMufyXmlRenderProtocols} from '../src/lib/import/mufy-source-rule-requirements';
import {JSDOM} from 'jsdom';
const probeDom=new JSDOM('');
const nativeSemanticTags=new Set(['message','mes','user','usr','narration','nar','system','sys','scenario','sce','think','artifact']);
function unmappedTags(raw:string){
 // Creator-authored fenced HTML has its own iframe DOM; report non-artifact
 // protocol tags separately from that sandbox, without executing any source.
 const outsideArtifacts=raw.replace(/```(?:html|svg|css|javascript|js)\b[\s\S]*?```/gi,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi,'');
 return [...new Set([...outsideArtifacts.matchAll(/<\/?([a-z][\w-]*)\b/gi)].map(m=>m[1].toLowerCase()).filter(tag=>!nativeSemanticTags.has(tag)&&probeDom.window.document.createElement(tag) instanceof probeDom.window.HTMLUnknownElement))].sort();
}
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const startedAt=new Date().toISOString(),tick=performance.now();
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const daily=JSON.parse(await readFile(`${root}/daily-trial-progress.json`,'utf8'));
if(!Array.isArray(daily))throw Error('EXPECTED_PROGRESS_ARRAY');
const rows=[];
for(const card of manifest.rows.filter((r:{rank:number})=>![31,50].includes(r.rank))){
 const progress=daily.find((r:{rank:number})=>r.rank===card.rank);
 const prepared=JSON.parse(await readFile(`${root}/prepared/${card.sourceKey}/prepared.json`,'utf8'));
 const customXmlProtocols=findMufyXmlRenderProtocols([prepared.character.opening??'',prepared.character.outputSetting??'']);
 const replies=[];
 for(const round of [1,2]){
  const legacyPrefix=({21:'fusiyan',22:'jiangzhi',23:'xujianghe'} as Record<number,string>)[card.rank];
  const canonical=`${root}/${card.rank}-gemini4-reply${round}-raw.txt`;
  let path=await Bun.file(canonical).exists()?canonical:`${root}/${legacyPrefix??card.rank}-gemini4-reply${round}-raw.txt`;
  // Preserve the failed Gemini partial separately; current second-round evidence
  // is the later Sonnet result recovered through the normal page after reload.
  if(card.rank===24&&round===2&&await Bun.file(`${root}/24-sonnet-reply2-restored-after-reload.txt`).exists())path=`${root}/24-sonnet-reply2-restored-after-reload.txt`;
  if(!await Bun.file(path).exists())continue;
  const raw=await readFile(path,'utf8');
  const opens=(raw.match(/<details\b/g)||[]).length,closes=(raw.match(/<\/details>/g)||[]).length;
  replies.push({round,path:path.slice(root.length+1),length:raw.length,stateEnd:raw.includes('DEARM_STATE_END'),detailsOpen:opens,detailsClose:closes,
   unmappedNonArtifactTags:unmappedTags(raw),
   nonHtmlProtocolTags:[...new Set([...raw.matchAll(/<\/?([a-z][\w-]*)\b/g)].map(m=>m[1]).filter(t=>t.includes('_')))],
   // A redundant author closing tag is not automatically a rendered failure.
   structureNeedsInspection:opens!==closes,
  });
 }
 rows.push({rank:card.rank,name:card.name,replies,customXmlProtocols,sourceRuleCoverageReviewRequired:customXmlProtocols.length>0&&!prepared.beautification.replyRender,providerContentFilterObserved:progress?.providerContentFilterObserved===true,renderFailure:progress?.renderFailure??null,fullFidelityAccepted:false});
}
const report={observedAt:new Date().toISOString(),rows,summary:{eligible:rows.length,withObservedReply:rows.filter(r=>r.replies.length>0).length,withTwoObservedReplies:rows.filter(r=>r.replies.length===2).length,fullFidelityAccepted:0},note:'Raw/protocol evidence only; state markers and matching tag counts do not establish visual, interaction or source fidelity acceptance.'};
await writeFile(`${root}/reply-evidence-audit.json`,JSON.stringify(report,null,2));
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({step:'audit-batch30-reply-evidence',kind:'local-processing',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,containsLocalFileIo:true,agentNetMs:null})+'\n');
console.log(JSON.stringify({summary:report.summary,unmappedNonArtifactTags:rows.filter(r=>r.replies.some(p=>p.unmappedNonArtifactTags.length)).map(r=>({rank:r.rank,tags:[...new Set(r.replies.flatMap(p=>p.unmappedNonArtifactTags))]})),sourceRuleCoverageReviewRequired:rows.filter(r=>r.sourceRuleCoverageReviewRequired).map(r=>r.rank),structureNeedsInspection:rows.filter(r=>r.replies.some(p=>p.structureNeedsInspection)).map(r=>r.rank)}));
