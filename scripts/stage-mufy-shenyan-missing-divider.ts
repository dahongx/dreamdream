/** Restore one observed public decorative document, preserving the fresh owner chain. */
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {normalizePublicFrameReplay} from '../src/lib/import/mufy-public-frame-replay';
import {routeOpeningContentSplit} from '../src/lib/opening/content';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=root+'/rule-repairs/43/missing-divider';
const inv=JSON.parse(await readFile(root+'/final-acceptance/43/source-public-component-inventory.json','utf8'));
if(inv.rank!==43||!inv.roleNamePresent||inv.url!=='https://chat.mufy.ai/chat?roleId=891efb3f-b871-439a-a560-c5632587ed29')throw Error('PUBLIC_IDENTITY_REQUIRED');
const frame=inv.roots[0].frames[3],dom=new JSDOM(frame.html),node=dom.window.document.querySelector('.cv3-divider-stage');
if(!node?.textContent?.includes('做了关于天使的夢')||dom.window.document.querySelector('input,button,iframe,[onclick]'))throw Error('EXACT_STATIC_DIVIDER_REQUIRED');dom.window.close();
const baseline=await readFile(root+'/rule-repairs/43/fullscreen-story/candidate-opening.txt','utf8');
if(baseline.includes('cv3-divider-stage'))throw Error('DIVIDER_ALREADY_PRESENT');
// Public frame defaults measured on the actual source; zero specificity leaves
// every authored descendant font/color authoritative, without a global reset.
const normalized=normalizePublicFrameReplay(frame.html).html;
if(normalized.split('<head>').length!==2)throw Error('SOURCE_HEAD_BOUNDARY_CHANGED');
const html=normalized.replace('<head>','<head><style data-nj-source-divider-default>:where(.cv3-divider-stage){color:rgb(0,0,0);font-family:"Noto Sans SC"}</style>');
const author=baseline.indexOf('.cv7-fold-stage'),at=baseline.lastIndexOf('```html',author);
if(author<0||at<0||baseline.slice(at,author).includes('```\n'))throw Error('AUTHOR_DOCUMENT_BOUNDARY_CHANGED');
const passiveDom=new JSDOM(inv.roots[0].frames[8].html),passive=passiveDom.window.document.querySelector('.ghost-image-container');
if(!passive||passiveDom.window.document.querySelector('script,input,button,iframe,[onclick]')||passive.querySelector('img')?.getAttribute('src')!=='https://p.inari.site/usr/2085/696890fcc4f15.png')throw Error('EXACT_PASSIVE_ORNAMENT_REQUIRED');passiveDom.window.close();
// Source gives this fixed-position scene a 100px iframe canvas. A measured
// in-flow canvas avoids platform html/body !important resets collapsing it.
const passiveHtml=normalizePublicFrameReplay(inv.roots[0].frames[8].html).html.replace('</body>','<div data-nj-source-passive-canvas aria-hidden="true" style="height:100px;pointer-events:none"></div></body>');
const insertion='```html\n'+html+'\n```\n\n',appendix='\n```html\n'+passiveHtml+'\n```\n',withDivider=baseline.slice(0,at)+insertion+baseline.slice(at),candidate=withDivider+appendix;
if(candidate.slice(0,at)+candidate.slice(at+insertion.length,-appendix.length)!==baseline)throw Error('UNRELATED_OWNER_BYTES_CHANGED');
const route=routeOpeningContentSplit(candidate,'divider-check'),docs=route.inline?.kind==='iframe-multi'?route.inline.srcdocs:route.inline?.kind==='iframe'?[route.inline.srcdoc]:[];
if(docs.filter(d=>d.includes('cv3-divider-stage')).length!==1)throw Error('EXACTLY_ONE_ROUTED_DIVIDER_REQUIRED');
if(docs.filter(d=>d.includes('ghost-image-container')).length!==1)throw Error('EXACTLY_ONE_PASSIVE_ORNAMENT_REQUIRED');
await mkdir(dir,{recursive:true});const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(dir+'/frame.json',JSON.stringify({html,sourceUrl:inv.url,sourceObservedAt:inv.observedAt},null,2));await writeFile(dir+'/candidate-opening.txt',candidate);
await writeFile(dir+'/passive-frame.json',JSON.stringify({html:passiveHtml,sourceUrl:inv.url,sourceObservedAt:inv.observedAt},null,2));
const proof={rank:43,sourceIndex:3,restoredSourceIndices:[3,8],observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,sourceUrl:inv.url,baselineSha256:hash(baseline),candidateSha256:hash(candidate),insertionOffset:at,insertedCharacters:insertion.length+appendix.length,allOtherOwnerBytesPreserved:true,sourceOrder:'Divider after source2/before author4; passive ornament8 after restored full-screen trigger6 (source7 is viewport-floating)',ownerUiSaved:false,TESTDeployed:false,fullFidelityAccepted:false};
await writeFile(dir+'/candidate-proof.json',JSON.stringify(proof,null,2));await appendFile(root+'/timing-runs.jsonl',JSON.stringify({id:'shenyan-static-restore-'+proof.observedAt,observedAt:proof.observedAt,elapsedMs:proof.elapsedMs,kind:'offline-public-static-candidate-extraction',agentNetMs:null,deployed:false})+'\n');console.log(JSON.stringify(proof));
