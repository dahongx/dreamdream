/** Exact public component inheritance repair; no remote write or font download. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { routeOpeningContentSplit } from '../src/lib/opening/content';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const dir=`${root}/rule-repairs/44/public-plate-font`;
const baseline=await readFile(`${root}/rule-repairs/44/native-black-sidebar/candidate-opening.txt`,'utf8');
const prior=JSON.parse(await readFile(`${root}/rule-repairs/44/native-black-sidebar/candidate-proof.json`,'utf8'));
const observation=JSON.parse(await readFile(`${root}/final-acceptance/44/public-font-current-20261031.json`,'utf8'));
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
if(hash(baseline)!==prior.candidateSha256||observation.rank!==44||observation.sourceIndex!==0||observation.source.fontFamily!=='"Noto Sans SC"')throw Error('PUBLIC_FONT_AND_CANDIDATE_BASE_REQUIRED');
const original='<div class="censy-screen-plate">';
const replacement='<div class="censy-screen-plate" style="font-family: &quot;Noto Sans SC&quot;;">';
if(baseline.split(original).length!==2||baseline.includes(replacement))throw Error('UNIQUE_ORIGINAL_PLATE_REQUIRED');
const candidate=baseline.replace(original,replacement);
if(candidate.replace(replacement,original)!==baseline)throw Error('UNRELATED_OWNER_CHANGE');
const routed=routeOpeningContentSplit(candidate,'font-44').inline;
if(routed?.kind!=='iframe-multi')throw Error('PUBLIC_MULTI_FRAME_REQUIRED');
const frames=routed.srcdocs.filter(d=>d.includes(replacement));
if(frames.length!==1)throw Error('EXACT_SCOPED_FONT_FRAME_REQUIRED');
await mkdir(dir,{recursive:true});
await writeFile(`${dir}/candidate-opening.txt`,candidate);
await writeFile(`${dir}/frame.json`,JSON.stringify({html:frames[0],source:'Actual public owner component with one scoped inherited font declaration',fullFidelityAccepted:false},null,2));
const proof={rank:44,observedAt:new Date().toISOString(),baselineSha256:hash(baseline),candidateSha256:hash(candidate),sourceEvidence:'final-acceptance/44/public-font-current-20261031.json',exactReversePreservesAllOtherBytes:true,addedFontDownloads:0,globalFontChanged:false,ownerUiSaved:false,deployed:false,fullFidelityAccepted:false};
await writeFile(`${dir}/candidate-proof.json`,JSON.stringify(proof,null,2));
// An independent second public card exercises the shared document default,
// without putting a role-specific font declaration into its owner candidate.
const opening45=await readFile(`${root}/rule-repairs/45/native-ins-music/candidate-opening.txt`,'utf8');
const route45=routeOpeningContentSplit(opening45,'font-45').inline;
if(route45?.kind!=='iframe-multi')throw Error('SECOND_PUBLIC_DOCUMENT_REQUIRED');
const frames45=route45.srcdocs.filter(d=>d.includes('class="mufy-typo-magazine-wrapper"'));
if(frames45.length!==1)throw Error('UNIQUE_SECOND_PUBLIC_FONT_FRAME_REQUIRED');
await writeFile(`${root}/final-acceptance/45/public-font-frame-20261031.json`,JSON.stringify({html:'<style data-mufy-adaptation="mobile-box-model"></style>'+frames45[0],candidateSha256:hash(opening45),source:'Actual public pending candidate; shared font default must not need author CSS modification',fullFidelityAccepted:false},null,2));
console.log(JSON.stringify(proof));
