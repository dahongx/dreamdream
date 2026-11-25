/** Read-only source/bundle alignment. No SSH, checkout changes, build or release. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const tick=performance.now(),dir='outputs/mufy-consolidated-20261029',root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(await readFile(dir+'/runtime-manifest.json','utf8')),patch=await readFile(dir+'/runtime.patch','utf8');
if(hash(patch)!==manifest.patchSha256||manifest.target!=='115.29.213.73:8091')throw Error('PATCH_IDENTITY_CHANGED');
const rows=[];
for(const entry of manifest.entries as {path:string;after:string;newFile:boolean}[]){
 if(!entry.path.startsWith('src/')||entry.path.includes('..'))throw Error('UNSAFE_MANIFEST_PATH');
 const staged=await readFile(dir+'/patch/'+entry.path,'utf8');if(hash(staged)!==entry.after)throw Error('STAGED_HASH_MISMATCH_'+entry.path);
 const current=(await readFile(entry.path,'utf8')).replace(/\r\n/g,'\n');let expected=current;const exclusions=[];
 if(entry.path==='src/components/chat/ChatRoom.tsx'){
  const eventImport='import { MODEL_STATUS_REFRESH_EVENT } from "@/lib/ai/model-status-events";';
  if(!expected.includes(eventImport)){const at='import { useI18n } from "@/i18n/client";';if(expected.split(at).length!==2)throw Error('IMPORT_BOUNDARY_CHANGED');expected=expected.replace(at,at+'\n'+eventImport);}
  if(!expected.includes('window.dispatchEvent(new Event(MODEL_STATUS_REFRESH_EVENT));')){
   for(const marker of ['onFinish: ({ isError }) => {\n','onError: (err) => {\n']){if(expected.split(marker).length!==2)throw Error('MODEL_EVENT_BOUNDARY_CHANGED');expected=expected.replace(marker,marker+'      window.dispatchEvent(new Event(MODEL_STATUS_REFRESH_EVENT));\n');}
   const marker='        setContinuingMessageId(null);\n        sendingRef.current = false;\n';if(expected.split(marker).length!==2)throw Error('CONTINUE_BOUNDARY_CHANGED');expected=expected.replace(marker,marker+'        window.dispatchEvent(new Event(MODEL_STATUS_REFRESH_EVENT));\n');
  }exclusions.push('Preserve three observed TEST model-status notifications absent from this checkout; no other differences permitted');
 }
 if(entry.path==='src/lib/import/mufy-source-rule-envelope.ts'){
  const before=await readFile(dir+'/baseline/'+entry.path,'utf8'),relay=/^const DRAFT_RELAY = .+;$/m.exec(current)?.[0];if(!relay||!relay.includes("var text=draft.value;draft.value='';"))throw Error('PUBLIC_RELAY_BOUNDARY_CHANGED');expected=before.replace(/^const DRAFT_RELAY = .+;$/m,()=>relay);exclusions.push('Only observed public draft relay delta; unrelated local module refactor excluded');
 }
 if(entry.path==='src/components/regex/RegexIframe.tsx'){
  if(expected.split('sandbox="allow-scripts allow-same-origin"').length!==2)throw Error('SECURITY_WITHHOLD_BOUNDARY_CHANGED');
  expected=expected.replace('sandbox="allow-scripts allow-same-origin"','sandbox="allow-scripts"').replace(' * The TEST-only standalone official cross-origin Bilibili player is the sole\n * same-origin exception. It never receives the author renderer\'s host bridge.\n *\n','');exclusions.push('Unapproved standalone official-player same-origin exception excluded; author sandbox unchanged');
 }
 rows.push({path:entry.path,currentSourceSha256:hash(current),stagedSha256:hash(staged),expectedStagedSha256:hash(expected),matches:staged===expected,explicitExceptions:exclusions});
}
const report={observedAt:new Date().toISOString(),files:rows.length,patchSha256:manifest.patchSha256,allAligned:rows.every(r=>r.matches),rows,scope:'Current tested local source vs exact staged runtime after three explicit existing TEST/security delta rules. Not current remote image/version, release permission or TEST integration acceptance.',remoteReads:0,remoteWrites:0,buildStarted:false,deployed:false,fullFidelityAccepted:false,elapsedMs:performance.now()-tick,agentNetMs:null};
await writeFile(root+'/tested-runtime-alignment-20261101.json',JSON.stringify(report,null,2));await appendFile(root+'/timing-runs.jsonl',JSON.stringify({observedAt:report.observedAt,kind:'tested-runtime-alignment-process-wall',elapsedMs:report.elapsedMs,agentNetMs:null,remoteReads:0,remoteWrites:0,buildStarted:false,deployed:false})+'\n');
console.log(JSON.stringify({files:rows.length,allAligned:report.allAligned,patchSha256:manifest.patchSha256,mismatches:rows.filter(r=>!r.matches).map(r=>r.path)}));if(!report.allAligned)process.exitCode=1;
