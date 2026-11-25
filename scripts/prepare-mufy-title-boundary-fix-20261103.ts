/** Public beauty source only. Relocate our adaptation ahead of an inert malformed footer. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/38';
const before=await readFile(`${dir}/owner-opening-before-title-fix-20261103.txt`,'utf8');
const footer='<div style="width: 100%; text-align: center; color: #666; font-size: 10px;';
if(before.split(footer).length!==2)throw Error('EXPECTED_ONE_OBSERVED_INERT_FOOTER');
const at=before.indexOf(footer),start=before.lastIndexOf('```html',at),end=before.indexOf('```',at);
if(start<0||end<0)throw Error('EXPECTED_ONE_SOURCE_FENCE');
const original=before.slice(start,end),within=at-start;
if(!original.includes('art-text-container-v9'))throw Error('WRONG_PUBLIC_TITLE_COMPONENT');
const injected=/<style data-mufy-adaptation="mobile-box-model">[\s\S]*?<\/style><script data-mufy-adaptation="content-height">[\s\S]*?<\/script>/g;
const matches=[...original.matchAll(injected)];if(!matches.length||matches.some(m=>m.index!<=within))throw Error('EXPECTED_TRAPPED_OWN_ADAPTATION');
if(new Set(matches.map(m=>m[0])).size!==1)throw Error('ADAPTATION_VARIANTS_REQUIRE_REVIEW');
// Keep source bytes (including its inert unclosed footer/trailing source wrapper)
// unchanged. Only our appended identical helper blocks move before that footer.
const without=original.replace(injected,'');
const afterSegment=without.slice(0,within)+matches[0][0]+'\n'+without.slice(within);
const after=before.slice(0,start)+afterSegment+before.slice(end);
if(!afterSegment.includes(footer)||after.slice(end+afterSegment.length-original.length)!==before.slice(end))throw Error('UNRELATED_TAIL_CHANGED');
await writeFile(`${dir}/owner-opening-title-fix-candidate-20261103.txt`,after);
await writeFile(`${dir}/title-fix-public-frame-20261103.html`,afterSegment.replace(/^```html\s*\r?\n/,''));
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const proof={observedAt:new Date().toISOString(),beforeSha256:sha(before),afterSha256:sha(after),beforeLength:before.length,afterLength:after.length,sourceFooterUnchanged:true,componentOnly:true,movedHelperBlocks:matches.length,retainedHelperBlocks:1,status:'prepared-not-saved-not-browser-verified',modelRequests:0,deployedRuntime:false};
await writeFile(`${dir}/title-boundary-repair-20261103.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
