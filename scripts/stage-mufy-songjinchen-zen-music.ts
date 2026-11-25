/** Offline public DOM extraction only. Never reads storage or runs source code. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createHash} from 'node:crypto';
import {nativeImageSidebarEnvelope,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
import {routeOpeningContentSplit} from '../src/lib/opening/content';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/38/native-zen-music';
const evidence=JSON.parse(await readFile(root+'/final-acceptance/38/source-native-music-panel.json','utf8'));
const dom=new JSDOM(evidence.publicPanel),doc=dom.window.document,panel=doc.getElementById('censy-ins-panel');
const source=new JSDOM(evidence.sourceDocuments.find((x:{index:number})=>x.index===9).html);
const programs=[...source.window.document.scripts].map(e=>e.textContent??'').filter(s=>s.includes('Censy Awakening Script (V13 Zen Mode - Fallback Copy Fix & Come Back To Me)'));
if(!panel||programs.length!==1||panel.querySelectorAll('.cmd-item').length!==6||panel.querySelectorAll('.color-dot').length!==10)throw Error('ZEN_SOURCE_BOUNDARY_CHANGED');
const original=programs[0],start=original.indexOf('const playlist = ['),end=original.indexOf('window.parent.copyText = function(text)');
if(start<0||end<=start||!original.includes("localStorage.getItem('censy_ins_bear_payload')"))throw Error('ZEN_PROGRAM_BOUNDARY_CHANGED');
// Drop the storage/injection bootstrap completely, not merely rename its parent.
// The captured DOM already has the first song URL/title. Do not reassign src
// on mount: the platform's legacy src setter would force unintended autoplay.
const program=original.slice(start,end).replaceAll('window.parent.','window.')+'\nwindow.copyText=function(text){window.host.fillComposer(text);};renderPlaylist();';
if(/localStorage|sessionStorage|navigator\.clipboard|execCommand|window\.parent|fetch\(/.test(program))throw Error('ZEN_UNSAFE_PROGRAM_REMAINS');
panel.classList.remove('active');panel.querySelector('.ins-close')?.remove();
for(const e of panel.querySelectorAll('*'))for(const a of [...e.attributes])if(/^on/.test(a.name))e.setAttribute(a.name,a.value.replaceAll('window.parent.','window.'));
// Two source command attributes contain literal newlines in single-quoted JS.
// Encode the observed payload as a JSON string, preserving every text byte.
for(const item of panel.querySelectorAll('.cmd-item')){
 const action=item.getAttribute('onclick')??'',match=/^window\.copyText\('([\s\S]*)'\)$/.exec(action);
 if(!match)throw Error('ZEN_COMMAND_BOUNDARY_CHANGED');
 item.setAttribute('onclick',`window.copyText(${JSON.stringify(match[1])})`);
}
const sourceStyle=doc.querySelector('style')?.textContent;if(!sourceStyle)throw Error('ZEN_STYLE_MISSING');
// Source reset displays SVG as blocks; restore that inherited source rule.
const style=sourceStyle+'\nsvg{display:block}#censy-ins-panel{line-height:1.5}';
const html='<!doctype html><html><head><meta charset="utf-8"><style>'+style+'</style></head><body class="mufy-source-canvas">'+panel.outerHTML+'<script>'+program+'</script><style>*,*::before,*::after{box-sizing:border-box}html{margin:0;width:100%;overflow:hidden!important}body{margin:0!important;width:340px!important;zoom:.85;overflow:hidden!important;color:rgb(249,250,251);font-size:16px;line-height:24px}#censy-ins-panel{position:relative!important;top:auto!important;left:auto!important;transform:none!important;width:340px!important;opacity:1!important;pointer-events:auto!important;max-height:none!important;overflow:visible!important;margin:0!important}</style></body></html>';
const icon='https://s1.imagehub.cc/images/2026/02/13/64f5c54bc1b02cfc803cc1b667f9554c.png';
const closeIcon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2"><path d="M6 6l12 12M6 18L18 6"/></svg>');
const spec:NativeImageSidebar={version:1,variant:'zen-music',shellHtml:`<details class="zen-music-sidebar"><summary class="zen-trigger"><img src="${icon}" alt="音乐与指令"/></summary><div class="zen-host-panel"><div class="zen-close" tabindex="0"><img src="${closeIcon}" alt="关闭音乐与指令"/></div><div data-nj-native-documents></div></div></details>`,css:'.zen-trigger{filter:drop-shadow(0 4px 10px rgba(255,140,0,.4));animation:censyFloat 4s ease-in-out infinite}@keyframes censyFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',documents:[html],framePresentation:{minHeight:1,borderRadius:31}};
if(routeOpeningContentSplit(nativeImageSidebarEnvelope(spec),'zen').floating[0]?.nativeImageSidebar?.variant!=='zen-music')throw Error('ZEN_ROUTE_FAILED');
await mkdir(out,{recursive:true});await writeFile(out+'/sidebar-spec.json',JSON.stringify(spec,null,2));
const baseline=await readFile(root+'/final-acceptance/38/candidate-opening.txt','utf8');
if(baseline.includes('data-nj-native-image-sidebar-v1'))throw Error('EXISTING_NATIVE_CANDIDATE_REQUIRES_REVIEW');
const candidate=baseline+'\n'+nativeImageSidebarEnvelope(spec),hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(out+'/candidate-opening.txt',candidate);
await writeFile(out+'/candidate-proof.json',JSON.stringify({rank:38,observedAt:new Date().toISOString(),baselineSha256:hash(baseline),candidateSha256:hash(candidate),allOriginalCharactersPreserved:candidate.startsWith(baseline),baselineRequiresFreshOwnerUiVerification:true,sourceSongs:6,sourceAvatarControls:10,sourceDraftCommands:6,storageBootstrapRemoved:true,parentAccess:false,ownerUiSaved:false,deployed:false,fullFidelityAccepted:false},null,2));dom.window.close();source.window.close();console.log(JSON.stringify({rank:38,variant:spec.variant,ownerUiSaved:false}));
