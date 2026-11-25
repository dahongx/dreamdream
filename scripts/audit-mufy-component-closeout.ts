/** Offline closeout ledger. Does not grant complete five-card acceptance. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5/final-acceptance-20261020/component-closeout');
const startedAt=new Date().toISOString(),start=performance.now();
const acceptedImages:Record<string,string>={
  'shy-dog-visible-2.jpg':'Visible purple dog speech bubble; source auto-dismiss timing retained, not a persistent opacity defect.',
  'shy-cat-visible.jpg':'Visible cat speech bubble after normal click.',
  'xsj-setting-open.jpg':'Source settings panel opens and displays instructions.',
  'xsj-setting-people.jpg':'People tab displays source character introduction.',
  'xsj-setting-closed.jpg':'Settings panel closes after normal close click.',
  'xsj-audio-unavailable-1280.jpg':'No audio source is explicitly unavailable; not playback success.',
  'xsj-audio-unavailable-390.jpg':'Mobile unavailable hint remains inside player; inherited narrow source buttons wrap text.',
  'shy-comments-readable-390.jpg':'Light comments have dark body text and unchanged blue author names.',
  'shy-comments-1280.jpg':'Desktop light comments remain readable; background portrait remains visible.',
  'fml-flame-open.jpg':'Auxiliary fold opens; this only certifies fold action, not its body content.',
  'fml-flame-closed.jpg':'Auxiliary fold closes; this only certifies fold action, not its body content.',
};
const artifacts=[];
for(const file of await readdir(root)){
  if(!/\.(jpg|json)$/.test(file)||file==='closeout-summary.json')continue;
  const bytes=await readFile(join(root,file));
  artifacts.push({path:file,sha256:createHash('sha256').update(bytes).digest('hex'),review:acceptedImages[file]??'supporting-or-non-accepting; not independently certified'});
}
const deployment=JSON.parse(await readFile(resolve(root,'../../component-fallbacks-20261020191012343.json'),'utf8'));
if(deployment.ok!==true||deployment.port!==8091)throw Error('Successful TEST deployment required');
const report={generatedAt:new Date().toISOString(),scope:'component-fixes-and-focused-regression',finalAccepted:false,nextBatchStarted:false,deployment,
  tests:{passed:119,failed:0,files:10,reportedElapsedMs:21090,scope:'Related Bun regression suite; not whole application'},
  fixes:['Light source comment fallback; authored foreground preserved','Empty/error cy player cannot falsely show Pause'],
  remaining:['Opening full acceptance reports are not compiled/bound yet; 80 settled states remain historical evidence, not final acceptance','FML auxiliary fold action verified but body content is not certified','XSJ original audio remains deferred under existing user media policy; not restored playback'],
  oldEvidencePolicy:'Preserve original versioned reports. Compiler preflights renderer fingerprint before any writes and refuses relabeling historical screenshots.',
  artifacts,databaseOperations:0,productionWrites:0,paidSends:0,
  computation:{startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start}};
await writeFile(join(root,'closeout-summary.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({scope:report.scope,finalAccepted:report.finalAccepted,artifacts:artifacts.length,elapsedMs:report.computation.elapsedMs}));
