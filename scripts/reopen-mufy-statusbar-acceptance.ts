/** Correct the prior release claim without deleting its historical evidence. */
import {readFile,writeFile,copyFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/pilot-5/final-acceptance-20261020';
for(const name of ['release-closeout','remaining-acceptance']){
 const file=`${root}/${name}.json`,backup=`${root}/${name}-before-statusbar-regression.json`;
 if(!await Bun.file(backup).exists())await copyFile(file,backup);
 const old=JSON.parse(await readFile(file,'utf8'));
 old.versionClosed=false;old.currentSourceProtocolAccepted=false;
 old.status='reopened-user-confirmed-statusbar-regressions';
 old.reopenedAt=new Date().toISOString();
 old.correction='Prior fold/text checks did not verify source state skin, fixed viewport anchoring during real scrolling, or collapsed three-bar alignment. Prior acceptance is revoked; preserve original observations as historical evidence only.';
 old.requiredRegressionChecks=['fml-source-state-skin','fml-viewport-fire-scroll-stability','qyn-zys-collapsed-alignment'];
 if(Array.isArray(old.rows))for(const row of old.rows)if(['qyn','zys','fml'].includes(row.key))row.accepted=false;
 await writeFile(file,JSON.stringify(old,null,2));
}
console.log('Prior acceptance revoked; historical reports retained.');
