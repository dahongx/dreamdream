/** Restore one concretely absent public component, in source order, without changing other bytes. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizePublicFrameReplay} from '../src/lib/import/mufy-public-frame-replay';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=root+'/rule-repairs/49/native-film-profile';
const inv=JSON.parse(await readFile(root+'/final-acceptance/49/source-public-component-inventory.json','utf8'));
if(!inv.roleNamePresent||inv.url!=='https://chat.mufy.ai/chat?roleId=c0bc5e59-b0b0-4eb9-9a98-55e5823ac0f4')throw Error('KNOWN_PUBLIC_SOURCE_IDENTITY_REQUIRED');
const frame=inv.roots[0].frames[6];if(!frame.html.includes('filmTrack')||!frame.html.includes('posterMain')||!frame.html.includes('diaryModal')||frame.height<600)throw Error('KNOWN_OBSERVED_FILM_COMPONENT_REQUIRED');
const baseline=await readFile(root+'/rule-repairs/49/native-toolkit/candidate-opening.txt','utf8'),marker='<div data-nj-restored-source-rank="49" data-source-frame="7">';
if(baseline.split(marker).length!==2)throw Error('ORDER_BOUNDARY_CHANGED');
const replay=normalizePublicFrameReplay(frame.html).html,block='<div data-nj-restored-source-rank="49" data-source-frame="6">\n```html\n'+replay+'\n```\n</div>\n';
const alreadyIncluded=baseline.includes('filmTrack');
if(alreadyIncluded&&(!baseline.includes(block)||baseline.split('data-source-frame="6"').length!==2))throw Error('EXISTING_FILM_COMPONENT_CHANGED_REVIEW_REQUIRED');
const candidate=alreadyIncluded?baseline:baseline.replace(marker,()=>block+marker);if(!alreadyIncluded&&candidate.replace(block,'')!==baseline)throw Error('UNRELATED_OPENING_BYTES_CHANGED');
await mkdir(dir,{recursive:true});await writeFile(dir+'/source-public-frame.html',frame.html);await writeFile(dir+'/replay-frame.html',replay);await writeFile(dir+'/frame.json',JSON.stringify({html:replay},null,2));await writeFile(dir+'/candidate-opening.txt',candidate);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex'),proof={rank:49,sourceIndex:6,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,sourceObservedAt:inv.observedAt,baselineSha256:hash(baseline),candidateSha256:hash(candidate),insertionBeforeSourceIndex:7,otherOriginalBytesPreserved:true,authorProgramRunsOnlyInExistingOpaqueSandbox:true,sourceStorageRead:false,currentSourcePageUnavailable:true,ownerUiSaved:false,requiresFreshOwnerBaseline:true,buildStarted:false,deployed:false,fullFidelityAccepted:false};await writeFile(dir+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
