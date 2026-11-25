/** Known public V21 template only. Author execution stays in its opaque frame. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {nativeImageSidebarEnvelope,extractNativeImageSidebars,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/41/native-static-music';
const inv=JSON.parse(await readFile(root+'/final-acceptance/41/source-public-component-inventory.json','utf8'));
if(!inv.roleNamePresent||inv.url!=='https://chat.mufy.ai/chat?roleId=eae9ba16-dbc0-43f7-83b5-0a2ff1494c47')throw Error('KNOWN_PUBLIC_SOURCE_REQUIRED');
const dom=new JSDOM(inv.roots[0].frames[2].html),template=dom.window.document.querySelector<HTMLTemplateElement>('template#censy-full-static-player-v21');
if(!template)throw Error('KNOWN_V21_TEMPLATE_REQUIRED');
const inner=template.innerHTML;
if(!inner.includes('const Z_CONFIG_MUSIC = { v: 21')||!inner.includes('const pWin = window.parent;')||/<iframe\b|localStorage|sessionStorage|fetch\s*\(/i.test(inner))throw Error('PUBLIC_PLAYER_BOUNDARY_CHANGED');
const image=/background-image:\s*url\('([^']+)'\)/.exec(inner)?.[1];if(!image||new URL(image).protocol!=='https:')throw Error('PUBLIC_TRIGGER_IMAGE_REQUIRED');
// Keep source markup/program byte-for-byte. Only inner geometry changes: the
// native shell owns open/close, not a second button hidden inside an iframe.
const live=JSON.parse(await readFile(root+'/final-acceptance/41/source-controls-live-facts-20261031.json','utf8'));
if(!live.roleNamePresent||live.panelFacts.panel.lineHeight!=='24px'||live.panelFacts.item.lineHeight!=='18px')throw Error('LIVE_SOURCE_TYPOGRAPHY_REQUIRED');
const frame='<!doctype html><html><head><meta charset="UTF-8"><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;height:auto;background:transparent}#Z_CONFIG_player_wrapper_v21{position:relative!important;top:0!important;left:0!important;font-size:16px;line-height:1.5}button,input{font:inherit}#Tt_player_trigger_v21{display:none!important}#Mm_panel_v21{position:relative!important;top:0!important;left:0!important;width:100%!important;opacity:1!important;visibility:visible!important;transform:none!important}</style></head><body>'+inner+'</body></html>';
const spec:NativeImageSidebar={version:1,variant:'static-music',shellHtml:'<details class="static-music-sidebar"><summary class="static-music-trigger"><img src="'+image+'" alt="打开音乐播放器"></summary><div class="static-music-panel"><div data-nj-native-documents></div></div></details>',css:'.static-music-trigger{background:transparent;border:0;padding:0}.static-music-trigger:hover{transform:scale(1.05)}',documents:[frame],framePresentation:{minHeight:100,borderRadius:12}};
if(extractNativeImageSidebars(nativeImageSidebarEnvelope(spec)).sidebars.length!==1)throw Error('NATIVE_PLAYER_ROUTE_FAILED');
const baseline=await readFile(root+'/rule-repairs/41/composer-prefix/candidate-opening.txt','utf8');if(baseline.includes('static-music-sidebar'))throw Error('ALREADY_STAGED_REVIEW');const candidate=baseline+'\n'+nativeImageSidebarEnvelope(spec),hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await mkdir(out,{recursive:true});await writeFile(out+'/sidebar-spec.json',JSON.stringify(spec,null,2));await writeFile(out+'/candidate-opening.txt',candidate);dom.window.close();
const proof={rank:41,sourceIndex:2,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,sourceObservedAt:inv.observedAt,sourceTemplateCharacters:inner.length,sourceTemplatePreserved:frame.includes(inner),sourceStorageRead:false,sourceProgramExecutedInHost:false,realParentAccess:false,publicTrackCount:(inner.match(/\{ title:/g)||[]).length,allOriginalOpeningCharactersPreserved:candidate.startsWith(baseline),baselineSha256:hash(baseline),candidateSha256:hash(candidate),requiresFreshOwnerBaseline:true,ownerUiSaved:false,buildStarted:false,deployed:false,fullFidelityAccepted:false};await writeFile(out+'/candidate-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
