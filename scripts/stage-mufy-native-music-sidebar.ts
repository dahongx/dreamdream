/** Public drawer recovery only. No remote writes, build, account or database. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizePublicFrameReplay} from '../src/lib/import/mufy-public-frame-replay';
import {nativeImageSidebarEnvelope} from '../src/lib/opening/native-image-sidebar';
import {routeOpeningContentSplit} from '../src/lib/opening/content';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const dir=`${root}/final-acceptance/48`,out=`${root}/rule-repairs/48/native-music`;
const source=JSON.parse(await readFile(`${dir}/native-music-expanded-public.json`,'utf8'));
const baseline=await readFile(`${dir}/owner-opening-baseline.txt`,'utf8');
if(!source.open||!source.frameHtml.includes('MUSIC')||!source.styles.length)throw Error('EXPANDED_PUBLIC_DRAWER_REQUIRED');
const start=baseline.indexOf('<details class="glass-music-sidebar">');
const warning=baseline.indexOf('<floating kind="warning-top"',start);
const end=baseline.lastIndexOf('</details>',warning)+10;
if(start<0||warning<0||end<=start||baseline.slice(end,warning).trim()||!baseline.slice(start,end).includes('glass-panel')||baseline.slice(start,end).includes('<iframe'))throw Error('EMPTY_OWNER_DRAWER_BOUNDARY_UNPROVEN');
const spec={version:1 as const,variant:'glass-music' as const,
 shellHtml:'<details class="glass-music-sidebar"><summary class="glass-trigger"></summary><div class="glass-panel"><div data-nj-native-documents></div></div></details>',
 css:source.styles.join('\n'),documents:[normalizePublicFrameReplay(source.frameHtml).html],framePresentation:{minHeight:100,borderRadius:12}};
const candidate=baseline.slice(0,start)+nativeImageSidebarEnvelope(spec)+baseline.slice(end);
const routed=routeOpeningContentSplit(candidate,'char_09a34fba74deea666854');
if(routed.floating.filter(f=>f.nativeImageSidebar?.variant==='glass-music').length!==1)throw Error('NATIVE_MUSIC_ROUTING_FAILED');
await mkdir(out,{recursive:true});
await writeFile(`${out}/sidebar-spec.json`,JSON.stringify(spec,null,2));
await writeFile(`${out}/candidate-opening.txt`,candidate);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const proof={rank:48,observedAt:new Date().toISOString(),sourceObservedAt:source.observedAt,baselineSha256:hash(baseline),candidateSha256:hash(candidate),preservedPrefixCharacters:start,preservedSuffixCharacters:baseline.length-end,documents:1,ownerUiSaved:false,deployed:false,fullFidelityAccepted:false};
await writeFile(`${out}/candidate-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
