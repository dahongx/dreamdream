/** Explicit current-release reviewer record, after displaying all 80 raw PNGs. */
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5/final-acceptance-20261020');
type Case={index:number;status:string;controlCount:number;systemBoxCount:number;nativeTransparentObserved:boolean;comparison:string;separateControlLabels?:string[]};
type Row={key:string;sourceKey:string;sourceImage:string;targetCharacterId:string;captureOverrides?:Record<string,string>;cases:Case[]};
const prior=JSON.parse(await readFile(join(root,'manual-reply-reviews.json'),'utf8')) as {rows:Row[]};
const {rendererSha256}=JSON.parse(await readFile(join(root,'opening-release/renderer-binding.json'),'utf8')) as {rendererSha256:string};
for(const row of prior.rows){
 delete row.captureOverrides;
 if(row.key==='fml')row.cases=[
  {index:2,status:'pass',controlCount:6,systemBoxCount:1,nativeTransparentObserved:true,comparison:'Current source-frame reply: cyan SYS.TASK_UPDATE panel retains cyan border and dark source background; portrait remains visible through the outer narrative. Three primary folds, two nested memory folds and the source fire terminal total six controls. All eight current-release screenshots displayed. Expanded/reopened body text is readable; closed states hide it. The terminal source CSS is now restored, with additional terminal-focused screenshots reviewed separately. This sample is not the legacy native first reply.'},
  {index:3,status:'pass',controlCount:6,systemBoxCount:0,nativeTransparentObserved:true,comparison:'Second distinct current source-frame reply, identified by the 不信 and 铁门外 footsteps narrative, has no system box; none is invented to satisfy a count. All eight current-release screenshots displayed at both widths. Six native source details including nested memory and terminal open, collapse and reopen; transparent outer story preserves the portrait and readable light text. Source component style guard reports no missing terminal surface. Legacy first reply is not relabeled as current protocol.'},
 ];
 else for(const c of row.cases)c.comparison='Current release '+rendererSha256+': All eight newly captured original PNGs displayed and reviewed; existing source contract reconfirmed. '+c.comparison;
}
await writeFile(join(root,'manual-reply-reviews-release.json'),JSON.stringify({version:1,reviewedAt:new Date().toISOString(),rendererSha256,policy:'Explicit current-release pixel review. Historical reports and captures are retained. Two distinct existing source-protocol replies per card; no new paid send and no history rewriting.',knownLegacyDifference:{key:'fml',messageIndex:1,reason:'The oldest native reply predates the source-frame protocol. Public DOM contains full terminal text, not a placeholder; it does not inherit source iframe CSS. It is not claimed restored or used as a current-protocol acceptance sample.',disposition:'historical-native-rendering-not-retrofitted'},rows:prior.rows},null,2));
