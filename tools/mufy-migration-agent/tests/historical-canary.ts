/** Private local regression of one previously authorized adult card. Never imports or publishes. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {JSDOM} from 'jsdom';
import {preparePublicMigration,type PublicAppearance} from '../src/preparation';
import {parseMufyPrompt,sha256,type MufyRoleDetail} from '../../../src/lib/import/mufy-migration';
import {restoreMufyPublicFrameTokens} from '../../../src/lib/import/mufy-public-frame-tokens';
import {adaptMufyAvatarDraftCopy} from '../../../src/lib/import/mufy-avatar-draft-copy';
const root=resolve('logs/mufy-profiles/full-20261013/next-batch-30-20261028'),out=resolve('outputs/mufy-agent-historical-canary-20261103'),startedAt=new Date().toISOString(),tick=performance.now();
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8')),row=manifest.rows.find((r:{rank:number})=>r.rank===21);
if(row.sourceKey!=='char_a0ada57b8590d3aea974')throw Error('CANARY_IDENTITY_CHANGED');
const assets=JSON.parse(await readFile(join(root,row.sourceKey+'-public-render-assets.json'),'utf8')),content=JSON.parse(await readFile(join(root,row.sourceKey+'-public-content.json'),'utf8'));
if(assets.sourceUrl!==row.sourceUrl||content.sourceUrl!==row.sourceUrl||!content.lengthVerified||content.markdownBlocks.some((b:{html:string},i:number)=>b.html.length!==content.lengths[i]))throw Error('SOURCE_CAPTURE_INVALID');
const snapshot=await readFile(join(root,row.sourceKey+'-public-snapshot.txt'),'utf8'),lines=snapshot.split(/\r?\n/),idx=lines.lastIndexOf('- generic: '+row.name),tags:string[]=[];
for(let n=idx+3;idx>=0&&n<lines.length&&lines[n].startsWith('- generic: ')&&!lines[n].includes('更新于：');n++)tags.push(lines[n].slice(11));
const doc=new JSDOM(content.markdownBlocks[0].html).window.document,frames:string[]=[];
for(const frame of doc.querySelectorAll('iframe')){const html=frame.getAttribute('srcdoc');if(!html){frame.remove();continue;}const marker='MUFY_PUBLIC_FRAME_'+frames.length;frames.push('```html\n'+adaptMufyAvatarDraftCopy(html).html+'\n```');frame.replaceWith(doc.createTextNode(marker));}
const promptPath=join(root,'local-inputs',row.sourceKey,'prompt.txt'),prompt=await readFile(promptPath,'utf8'),inventory=JSON.parse(await readFile(join(root,'local-input-inventory.json'),'utf8'));
if(inventory.rows.find((r:{sourceKey:string})=>r.sourceKey===row.sourceKey)?.promptSha256!==sha256(prompt))throw Error('LOCAL_ARCHIVE_CHANGED');
const styles=(assets.styles as string[]).filter(s=>!s.startsWith(':where(html[dir=')&&!s.startsWith('[data-vaul-drawer]')&&!s.startsWith('.qJTHM'));
const detail:MufyRoleDetail={characterId:new URL(row.sourceUrl).searchParams.get('roleId')!,name:row.name,sourceUrl:row.sourceUrl,publicDomDerived:true,avatarUrl:assets.images.find((i:{alt:string})=>i.alt==='')?.src,backgroundUrl:assets.images.find((i:{alt:string})=>i.alt==='background')?.src,description:idx>=0?lines[idx+2]?.replace(/^- generic: /,''):null,tags,creatorDescription:content.authorNote,greeting:parseMufyPrompt(prompt).opening,codeRenderContent:restoreMufyPublicFrameTokens(doc.body.innerHTML,frames),optimizationCode:styles.map(s=>'<style>'+s+'</style>').join('\n'),observedAt:assets.observedAt};
const classes=[...new JSDOM(content.markdownBlocks.map((b:{html:string})=>b.html).join('\n')).window.document.querySelectorAll('[class]')].flatMap(e=>[...e.classList]);
const rules=JSON.parse(await readFile(join(root,'source-rules',`${row.rank}-${detail.characterId}.json`),'utf8')),appearance:PublicAppearance={version:1,roleId:detail.characterId,sourceUrl:row.sourceUrl,observedAt:content.observedAt,captureScope:'normal-page-public-dom',sourceStyles:styles,contentClasses:classes,speechAvatar:assets.images.some((i:{alt:string})=>i.alt==='avatar')};
const result=preparePublicMigration({detail,prompt,promptSha256:sha256(prompt),rules,appearance});
const historical=JSON.parse(await readFile(join(root,'prepared',row.sourceKey,'prepared.json'),'utf8'));
const changed=Object.keys(result.prepared.character).filter(k=>JSON.stringify(result.prepared.character[k as keyof typeof result.prepared.character])!==JSON.stringify(historical.character[k]));
await mkdir(out,{recursive:true});
// Inputs stay private in this local canary, outside the shareable code package.
const inputRoot=join(out,'inputs');await mkdir(inputRoot,{recursive:true});
for(const[name,data]of Object.entries({'public-detail.json':detail,'rules.json':rules,'public-appearance.json':appearance,'source-proof.json':{sourceUrl:row.sourceUrl,roleName:row.name,bodyLoaded:true,lengthVerified:true,observedAt:content.observedAt,detailLengths:{greeting:detail.greeting?.length??0,codeRenderContent:detail.codeRenderContent?.length??0,optimizationCode:detail.optimizationCode?.length??0}}}))await writeFile(join(inputRoot,name),JSON.stringify(data),{mode:0o600});
await writeFile(join(inputRoot,'prompt.txt'),prompt,{mode:0o600});await writeFile(join(inputRoot,'input.json'),JSON.stringify({detail:'inputs/public-detail.json',prompt:'inputs/prompt.txt',promptSha256:sha256(prompt),rules:'inputs/rules.json',appearance:'inputs/public-appearance.json',sourceProof:'inputs/source-proof.json'}));
const summary={rank:row.rank,sourceKey:row.sourceKey,name:row.name,sourceUrl:row.sourceUrl,targetUrl:row.targetUrl.replace('/characters/','/chat/'),startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,actualHistoricalSample:true,liveEndToEndAccepted:false,sourceCaptureObservedAt:content.observedAt,frames:frames.length,sourceRuleCount:rules.rules.length,changedCharacterFields:changed,sourceArchiveUnchanged:sha256(await readFile(promptPath,'utf8'))===sha256(prompt),errors:result.prepared.issues.filter(i=>i.level==='error').map(i=>i.code),serverWrites:0,databaseAccess:false};
await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
