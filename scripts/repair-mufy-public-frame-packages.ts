/** Offline repair candidates only; never recreates cards or overwrites imported baselines. */
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { prepareMufyMigration, parseMufyPrompt, sha256, type MufyRoleDetail } from '../src/lib/import/mufy-migration';
import { restoreMufyPublicFrameTokens } from '../src/lib/import/mufy-public-frame-tokens';
import { repairMufySidebarBoundary } from '../src/lib/import/mufy-sidebar-boundary';
import { restoreMufyPublicContentCss } from '../src/lib/import/mufy-public-content-css';

const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const startedAt=new Date().toISOString(), tick=performance.now();
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
const receipts=JSON.parse(await readFile(join(root,'normal-ui-import-receipts.json'),'utf8')).rows;
const inventory=JSON.parse(await readFile(join(root,'local-input-inventory.json'),'utf8'));
const dir=join(root,'frame-repair-candidates');
await mkdir(dir,{recursive:true});
const results=[];
for(const receipt of receipts){
  const row=manifest.rows.find((r:{sourceKey:string})=>r.sourceKey===receipt.sourceKey);
  const old=JSON.parse(await readFile(join(root,'prepared',row.sourceKey,'prepared.json'),'utf8'));
  const content=JSON.parse(await readFile(join(root,row.sourceKey+'-public-content.json'),'utf8'));
  const assets=JSON.parse(await readFile(join(root,row.sourceKey+'-public-render-assets.json'),'utf8'));
  const theater=new JSDOM(content.markdownBlocks[0].html).window.document;
  const frames:string[]=[];
  for(const frame of theater.querySelectorAll('iframe')){
    const html=frame.getAttribute('srcdoc');
    if(!html){frame.remove();continue;}
    const marker='MUFY_PUBLIC_FRAME_'+frames.length;
    frames.push('```html\n'+html+'\n```');
    frame.replaceWith(theater.createTextNode(marker));
  }
  const corrected=restoreMufyPublicFrameTokens(theater.body.innerHTML,frames);
  const original=await readFile(join(root,'local-inputs',row.sourceKey,'prompt.txt'),'utf8');
  const local=inventory.rows.find((r:{sourceKey:string})=>r.sourceKey===row.sourceKey);
  if(sha256(original)!==local.promptSha256||content.sourceUrl!==row.sourceUrl||assets.sourceUrl!==row.sourceUrl)throw Error('SOURCE_BINDING_MISMATCH');
  const styles=(assets.styles as string[]).filter(s=>!s.startsWith(':where(html[dir=')&&!s.startsWith('[data-vaul-drawer]')&&!s.startsWith('.qJTHM'));
  const detail:MufyRoleDetail={characterId:new URL(row.sourceUrl).searchParams.get('roleId')!,name:row.name,
    avatarUrl:old.character.avatarUrl,backgroundUrl:old.character.coverImageUrl,
    description:old.character.bio,tags:old.character.tags,creatorDescription:content.authorNote,
    greeting:parseMufyPrompt(original).opening,codeRenderContent:corrected,
    optimizationCode:styles.map(s=>'<style>'+s+'</style>').join('\n'),publicDomDerived:true,sourceUrl:row.sourceUrl,observedAt:assets.observedAt};
  const next=prepareMufyMigration({detail,promptRecord:{characterName:local.characterName,prompt:original,source:{origin:'user-provided-local-archive',sha256:local.promptSha256}},adaptRuntime:true,preferLocalAge:true});
  if(next.issues.some(i=>i.level==='error'))throw Error('PREPARATION_ERROR:'+row.rank);
  next.beautification.openingComponent=repairMufySidebarBoundary(next.beautification.openingComponent);
  const publicDoc=new JSDOM(content.markdownBlocks.map((b:{html:string})=>b.html).join('\n')).window.document;
  const classes=[...publicDoc.querySelectorAll('[class]')].flatMap(e=>[...e.classList]);
  const restored=restoreMufyPublicContentCss(styles,classes);
  if(restored)next.beautification.globalCss=restored+'\n'+next.beautification.globalCss;
  const componentChanged=old.beautification.openingComponent!==next.beautification.openingComponent;
  const cssChanged=old.beautification.globalCss!==next.beautification.globalCss;
  const result={rank:row.rank,name:row.name,sourceKey:row.sourceKey,targetEditUrl:receipt.editUrl,componentChanged,cssChanged,
    beforeComponentSha256:sha256(old.beautification.openingComponent??''),afterComponentSha256:sha256(next.beautification.openingComponent??''),
    beforeCssSha256:sha256(old.beautification.globalCss??''),afterCssSha256:sha256(next.beautification.globalCss??''),
    residualMarkers:(next.beautification.openingComponent??'').match(/MUFY_PUBLIC_FRAME_\d+/g)??[],applied:false};
  if(result.residualMarkers.length)throw Error('RESIDUAL_MARKERS:'+row.rank);
  if(componentChanged||cssChanged)await writeFile(join(dir,row.sourceKey+'.json'),JSON.stringify({metadata:result,openingComponent:next.beautification.openingComponent,globalCss:next.beautification.globalCss},null,2),{mode:0o600});
  results.push(result);
}
await writeFile(join(dir,'manifest.json'),JSON.stringify({startedAt,finishedAt:new Date().toISOString(),serverWrites:0,rows:results},null,2));
await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({step:'frame-repair-candidates',kind:'local-processing',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,containsLocalFileIo:true,agentNetMs:null})+'\n');
console.log(JSON.stringify(results.filter(r=>r.componentChanged||r.cssChanged),null,2));
