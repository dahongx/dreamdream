/** Saved PUBLIC replies and captured render rules only; no account/runtime/private fields. */
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import type {RegexRule} from '../src/lib/db/schema';
import {applyRegexToSegments} from '../src/lib/regex/segments';
import {findMufyXmlRenderProtocols} from '../src/lib/import/mufy-source-rule-requirements';
import {completePublicReplayRules,type PublicReplayRuleInput} from './mufy-saved-reply-rules';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now();
const read=async(path:string)=>JSON.parse(await readFile(root+'/'+path,'utf8'));
const receipts=(await read('normal-ui-import-receipts.json')).rows as Array<{rank:number;name:string;sourceUrl:string}>;
const audit=await read('reply-evidence-audit.json');
const cases=[],missing=[];const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
for(const receipt of receipts){
 if(receipt.rank===37)continue;
 const row=audit.rows.find((entry:{rank:number})=>entry.rank===receipt.rank);
 const source=await read(`rule-repairs/${receipt.rank}/source-chain-only.json`) as PublicReplayRuleInput[];
 const inputPaths=[`rule-repairs/${receipt.rank}/rules-only.json`,...(receipt.rank===49?['rule-repairs/49/indent-only.json','rule-repairs/49/aq-close-recovery-v2.json']:[])];
 if(receipt.rank===49){const qa=await read('qa-progress.json'),attestation=qa.rows.find((r:{rank:number})=>r.rank===49)?.targetedPostRepairChecks;if(!attestation?.evidence?.includes('rule-repairs/49/indent-live-repair-proof.json')||!attestation.status.includes('two display-only compatibility rules'))throw Error('ATTESTED_AQ_LIVE_REPAIRS_REQUIRED');}
 const inputArrays=await Promise.all(inputPaths.map(path=>read(path))) as PublicReplayRuleInput[][];
 const prepared=completePublicReplayRules(source,inputArrays[0],inputArrays.slice(1).flat());
 const ruleInputs=await Promise.all(inputPaths.map(async path=>({path,sha256:hash(await readFile(root+'/'+path,'utf8'))})));
 const ruleSetSha256=hash(JSON.stringify(prepared));
 const rules:RegexRule[]=prepared.map((rule,index)=>({...rule,id:`public-replay-${receipt.rank}-${index}`,packId:'local-public-replay',targetText:null,variableMapping:[],outputGuidance:null,createdAt:new Date(0),updatedAt:new Date(0)}));
 for(const round of [1,2]){
  const reply=row?.replies.find((entry:{round:number})=>entry.round===round);
  if(!reply){missing.push({rank:receipt.rank,round,reason:'No recorded completed public reply in authoritative reply audit; do not fabricate content or call a model.'});continue;}
  if(typeof reply.path!=='string'||reply.path.includes('..')||reply.path.includes('/')||reply.path.includes('\\'))throw Error('UNSAFE_PUBLIC_REPLY_PATH');
  const raw=await readFile(root+'/'+reply.path,'utf8');
  if(raw.length!==reply.length)throw Error(`PUBLIC_REPLY_LENGTH_CHANGED_${receipt.rank}_${round}`);
  const {segments}=applyRegexToSegments(raw,rules);
  let expectedStaticDetails=0;
  for(const segment of segments){const dom=new JSDOM(segment.type==='html'?segment.content:segment.srcdoc);expectedStaticDetails+=dom.window.document.querySelectorAll('details').length;dom.window.close();}
  cases.push({rank:receipt.rank,name:receipt.name,round,raw,rawPath:reply.path,rawSha256:hash(raw),rules:prepared,ruleSetSha256,ruleInputs,renderContract:'full-public-baseline-plus-attested-live-compatibility',sourceUrl:receipt.sourceUrl,providerQualification:[27,38].includes(receipt.rank)?'Historical provider truncation qualification retained; replay is not a new completed generation.':null,expectedStaticDetails,inputProtocols:findMufyXmlRenderProtocols([raw]),segmentDiagnostics:segments.map(segment=>({type:segment.type,length:segment.type==='html'?segment.content.length:segment.srcdoc.length})),remainingHtmlProtocols:findMufyXmlRenderProtocols(segments.filter(segment=>segment.type==='html').map(segment=>segment.content))});
 }
}
if(receipts.length!==28||cases.length+missing.length!==54||new Set(receipts.filter(r=>r.rank!==37).map(r=>r.rank)).size!==27)throw Error('ELIGIBLE_SCOPE_CHANGED');
const dir=root+'/saved-reply-preview';await mkdir(dir,{recursive:true});
const observedAt=new Date().toISOString();
await writeFile(dir+'/fixtures.json',JSON.stringify({observedAt,scope:'Real renderer replay of saved public replies only; external network disabled; NOT TEST/media/generation or whole-card acceptance.',eligibleCards:27,requiredReplies:54,availableReplies:cases.length,missing,cases},null,2));
await writeFile(dir+'/staging-report.json',JSON.stringify({observedAt,eligibleCards:27,requiredReplies:54,availableReplies:cases.length,missing,cases:cases.map(({raw,rules,...diagnostics})=>({...diagnostics,ruleCount:rules.length})),modelCalls:0,networkRequests:0,privatePromptsRead:false,fullFidelityAccepted:false},null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({observedAt,kind:'saved-public-reply-preview-staging-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,modelCalls:0,buildStarted:false,deployed:false})+'\n');
console.log(JSON.stringify({eligibleCards:27,requiredReplies:54,availableReplies:cases.length,missing,remainingProtocolSignals:cases.filter(c=>c.remainingHtmlProtocols.length).map(c=>({rank:c.rank,round:c.round,tags:c.remainingHtmlProtocols})),buildStarted:false}));
