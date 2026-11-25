/** Public phone fixture using the real runtime delta relay. No owner write. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {adaptMufySourceFrame} from '../src/lib/import/mufy-source-rule-envelope';
import {normalizePublicFrameReplay} from '../src/lib/import/mufy-public-frame-replay';
const startedAt=new Date().toISOString(),tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/22/phone-draft-relay';
const evidence=JSON.parse(await readFile(root+'/final-acceptance/22/source-public-phone-document.json','utf8'));
if(!evidence.html.includes('const sendToUI = (text = "") => {')||evidence.sourceStorageRead!==false)throw Error('PUBLIC_PHONE_PROOF_REQUIRED');
const replay=normalizePublicFrameReplay(evidence.html),html=adaptMufySourceFrame(replay.html);
if(!html.includes("var text=draft.value;draft.value='';")||html.includes('nj_fox_delta_draft_v1'))throw Error('RUNTIME_RELAY_REQUIRED_NOT_AUTHOR_REWRITE');
await mkdir(out,{recursive:true});await writeFile(out+'/frame.json',JSON.stringify({rank:22,html},null,2));
const proof={rank:22,startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,sourceSha256:createHash('sha256').update(evidence.html).digest('hex'),frameSha256:createHash('sha256').update(html).digest('hex'),resetCapturedPhoneInitialization:replay.resetCapturedPhoneInitialization,sourceProgramNarrowRewrite:false,fixScope:'platform virtual draft delta relay',ownerUiWrites:0,buildStarted:false,deployed:false,fullFidelityAccepted:false};await writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
