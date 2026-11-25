/** Inert literal extraction only: retain original three-module shell, no parent program. */
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
import {publicVariableDeclaration} from '../src/lib/import/mufy-public-prefix-extractor';
import {nativeImageSidebarEnvelope,extractNativeImageSidebars,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/43/native-multimodule-island';
const inv=JSON.parse(await readFile(root+'/final-acceptance/43/source-public-component-inventory.json','utf8'));
if(inv.rank!==43||!inv.roleNamePresent)throw Error('PUBLIC_SOURCE_REQUIRED');
const dom=new JSDOM(inv.roots[0].frames[7].html),payload=dom.window.document.querySelector<HTMLTemplateElement>('#censy-island-payload-v4')?.content;
if(!payload)throw Error('KNOWN_PUBLIC_V4_REQUIRED');const scripts=[...payload.querySelectorAll('script')].map(s=>s.textContent??'');if(scripts.length!==1)throw Error('SINGLE_PUBLIC_PROGRAM_REQUIRED');const code=scripts[0];
function literal(node:ts.Node):unknown{if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;if(ts.isArrayLiteralExpression(node))return node.elements.map(literal);if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(p=>{if(!ts.isPropertyAssignment(p)||!ts.isIdentifier(p.name))throw Error('STATIC_KEY_REQUIRED');return[p.name.text,literal(p.initializer)];}));throw Error('STATIC_STRING_DATA_ONLY');}
const tracksInit=publicVariableDeclaration(code,'tracks').initializer,commandsInit=publicVariableDeclaration(code,'cmdData').initializer;if(!tracksInit||!commandsInit)throw Error('LITERALS_REQUIRED');
const tracks=literal(tracksInit) as {title:string;artist:string;url:string}[],commands=literal(commandsInit) as {t:string;c:string}[],modeNodes:ts.Expression[]=[];
function walk(node:ts.Node){if(ts.isPropertyAssignment(node)&&ts.isIdentifier(node.name)&&node.name.text==='modes')modeNodes.push(node.initializer);ts.forEachChild(node,walk);}walk(ts.createSourceFile('public-v4.ts',code,ts.ScriptTarget.Latest,true));
if(modeNodes.length!==1)throw Error('ONE_SOURCE_MODE_LIST_REQUIRED');const modeLabels=literal(modeNodes[0]) as [string,string,string];
if(tracks.length!==5||commands.length!==26||modeLabels.length!==3||tracks.some(t=>new URL(t.url).hostname!=='music.163.com'))throw Error('SOURCE_DATA_COUNTS_CHANGED');
const shell=payload.querySelector<HTMLElement>('#censy-island-container'),css=payload.querySelector('style')?.textContent;if(!shell||!css||shell.querySelectorAll('.island-tab').length!==3||shell.querySelectorAll('.lore-card').length!==6)throw Error('THREE_COMPLETE_MODULES_REQUIRED');shell.classList.add('cloud-music-sidebar');
const spec:NativeImageSidebar={version:1,variant:'cloud-music',shellHtml:shell.outerHTML,css,documents:[],cloudMusic:{id:'shenyan-island-v4',layout:'island',tracks:tracks.map(t=>({title:t.title,artist:t.artist,src:t.url.replace(/^http:/,'https:')})),lineHeight:1.5,initialDisabled:true,multiModule:{kind:'v4',commands:commands.map(c=>({title:c.t,content:c.c})),modeLabels}}};
const envelope=nativeImageSidebarEnvelope(spec);if(extractNativeImageSidebars(envelope).sidebars.length!==1)throw Error('FINITE_ISLAND_SCHEMA_REQUIRED');
const baseline=await readFile(root+'/rule-repairs/43/missing-divider/candidate-opening.txt','utf8');if(baseline.includes('shenyan-island-v4'))throw Error('ALREADY_STAGED');const candidate=baseline+'\n'+envelope,hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await mkdir(out,{recursive:true});await writeFile(out+'/sidebar-spec.json',JSON.stringify(spec,null,2));await writeFile(out+'/candidate-opening.txt',candidate);dom.window.close();
const proof={rank:43,sourceIndex:7,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,sourceUrl:inv.url,sourceObservedAt:inv.observedAt,baselineSha256:hash(baseline),candidateSha256:hash(candidate),allOtherOwnerBytesPreserved:candidate.startsWith(baseline),tracks:5,relationCards:6,commands:26,sourceModeLabels:modeLabels,authorProgramExecuted:false,sourceStorageRead:false,hostParentAccess:false,ownerUiSaved:false,TESTDeployed:false,fullFidelityAccepted:false};await writeFile(out+'/candidate-proof.json',JSON.stringify(proof,null,2));await appendFile(root+'/timing-runs.jsonl',JSON.stringify({id:'shenyan-multimodule-stage-'+proof.observedAt,observedAt:proof.observedAt,elapsedMs:proof.elapsedMs,kind:'offline-public-literal-candidate-extraction',agentNetMs:null,deployed:false})+'\n');console.log(JSON.stringify(proof));
