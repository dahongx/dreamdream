/** Known public island payload: inert shell, static stylesheet and literal playlist only. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
import {publicVariableDeclaration} from '../src/lib/import/mufy-public-prefix-extractor';
import {nativeImageSidebarEnvelope,extractNativeImageSidebars,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/22/native-island-music';
const evidence=JSON.parse(await readFile(root+'/final-acceptance/22/source-public-component-inventory.json','utf8')),dom=new JSDOM(evidence.roots[0].frames[2].html),template=dom.window.document.querySelector<HTMLTemplateElement>('#censy-island-music-payload-v3');
if(!template)throw Error('KNOWN_PUBLIC_ISLAND_TEMPLATE_REQUIRED');const payload=template.content,scripts=[...payload.querySelectorAll('script')].map(e=>e.textContent??'');if(scripts.length!==1||!scripts[0].includes('const tracks ='))throw Error('KNOWN_PUBLIC_TRACKS_REQUIRED');
function literal(n:ts.Node):unknown{if(ts.isStringLiteral(n))return n.text;if(ts.isArrayLiteralExpression(n))return n.elements.map(literal);if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.map(p=>{if(!ts.isPropertyAssignment(p)||!ts.isIdentifier(p.name))throw Error('STATIC_TRACK_KEY_REQUIRED');return[p.name.text,literal(p.initializer)];}));throw Error('STATIC_TRACK_STRINGS_REQUIRED');}
const init=publicVariableDeclaration(scripts[0],'tracks').initializer;if(!init)throw Error('TRACKS_LITERAL_REQUIRED');const tracks=literal(init) as {title:string;artist:string;url:string}[];
if(tracks.length!==6||tracks.some(t=>new URL(t.url).hostname!=='music.163.com'))throw Error('ORIGINAL_PUBLIC_TRACKS_REQUIRED');
const shell=payload.querySelector<HTMLElement>('#censy-island-container');if(!shell)throw Error('PUBLIC_ISLAND_SHELL_REQUIRED');shell.classList.add('cloud-music-sidebar');
const css=(payload.querySelector('style')?.textContent??'').replace(/\.prose iframe,\[class\*="message"\] iframe,iframe\[srcdoc\]\s*\{[^}]*\}/,'');if(!css.includes('#censy-island-container.expanded'))throw Error('PUBLIC_ISLAND_STYLES_REQUIRED');
const spec:NativeImageSidebar={version:1,variant:'cloud-music',shellHtml:shell.outerHTML,css,documents:[],cloudMusic:{id:'jiangzhi-island-v3',layout:'island',tracks:tracks.map(t=>({title:t.title,artist:t.artist,src:t.url.replace(/^http:/,'https:')})),lineHeight:1.5,initialDisabled:true}};
const envelope=nativeImageSidebarEnvelope(spec);if(extractNativeImageSidebars(envelope).sidebars.length!==1)throw Error('ISLAND_SCHEMA_FAILED');
const baseline=await readFile(root+'/rule-repairs/22/native-quick-symbols/candidate-opening.txt','utf8');if(baseline.includes('jiangzhi-island-v3'))throw Error('ALREADY_STAGED');const candidate=baseline+'\n'+envelope,hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await mkdir(out,{recursive:true});await writeFile(out+'/sidebar-spec.json',JSON.stringify(spec,null,2));await writeFile(out+'/candidate-opening.txt',candidate);dom.window.close();
const proof={rank:22,sourceIndex:2,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,baselineSha256:hash(baseline),candidateSha256:hash(candidate),allOriginalCharactersPreserved:candidate.startsWith(baseline),publicTracks:6,httpToHttpsSameHostTransportUpgrades:tracks.filter(t=>t.url.startsWith('http:')).length,sourceStorageRead:false,authorProgramExecuted:false,ownerUiSaved:false,baselineRequiresFreshOwnerUiVerification:true,buildStarted:false,fullFidelityAccepted:false};await writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
