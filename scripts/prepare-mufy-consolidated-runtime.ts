/** Local patch bundle only: exact observed TEST baseline, no remote mutation/build. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const dir='outputs/mufy-consolidated-20261029';
const baseline=JSON.parse(await readFile(`${dir}/baseline-manifest.json`,'utf8'));
if(baseline.target!=='115.29.213.73:8091'||baseline.buildStarted||baseline.remoteWrites!==0)throw Error('EXACT_READ_ONLY_TEST_BASELINE_REQUIRED');
const additions=['src/components/chat/MufyComposerCompanion.tsx','src/lib/import/mufy-composer-companion.ts','src/components/chat/MufyNativeImageSidebar.tsx','src/lib/opening/native-image-sidebar.ts','src/components/chat/MufyFullscreenStory.tsx','src/lib/opening/fullscreen-story.ts','src/components/chat/MufyGhostInstructions.tsx','src/components/chat/MufyPrefixPanel.tsx','src/lib/opening/composer-prefix.ts','src/components/chat/MufyCloudMusic.tsx','src/components/chat/MufyCommandDrawer.tsx','src/components/chat/MufySourceControls.tsx','src/components/chat/MufyHaloToolkit.tsx','src/lib/opening/halo-toolkit.ts','src/components/chat/mufy-halo-commands.ts','src/components/chat/mufy-halo-drawing.ts'];
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
additions.push('src/components/chat/MufyPublicTimeline.tsx');
additions.push('src/components/chat/MufyImageIsland.tsx');
additions.push('src/components/chat/MufyPublicMap.tsx','src/lib/opening/public-map.ts');
async function remote(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'pipe'});const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code)throw Error('BASELINE_READ_FAILED:'+err.slice(0,120));return out.trim();}
if(await remote('cd /root/projects/yearn-chat && docker compose port app 3000')!=='0.0.0.0:8091')throw Error('WRONG_TEST_TARGET');
if(await remote(`docker inspect ${baseline.container} --format '{{.Image}}'`)!==baseline.image)throw Error('TEST_IMAGE_CHANGED');
const newFiles=await remote('cd /root/projects/yearn-chat && '+additions.map(path=>`if test -e '${path}'; then printf 'EXISTS ${path}\\n'; else printf 'MISSING ${path}\\n'; fi`).join('; '));
if(newFiles.split(/\r?\n/).length!==additions.length||newFiles.includes('EXISTS'))throw Error('NEW_RUNTIME_FILE_ALREADY_EXISTS_REVIEW_REQUIRED');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const patches:string[]=[],entries=[];
const withheldSecurityChange='Standalone official Bilibili allow-same-origin hunk remains excluded; current allow-scripts sandbox is preserved. No author iframe security changes.';
for(const item of baseline.entries as {path:string;sha256:string}[]){
 const before=await readFile(`${dir}/baseline/${item.path}`,'utf8');if(hash(before)!==item.sha256)throw Error('LOCAL_BASELINE_HASH_CHANGED');
 let candidate=(await readFile(item.path,'utf8')).replace(/\r\n/g,'\n');
 if(item.path==='src/components/chat/ChatRoom.tsx'){
  // Preserve unrelated TEST model-status notifications absent in this checkout.
  const eventImport='import { MODEL_STATUS_REFRESH_EVENT } from "@/lib/ai/model-status-events";';
  if(!candidate.includes(eventImport)){
   const at='import { useI18n } from "@/i18n/client";';if(candidate.split(at).length!==2)throw Error('CHATROOM_IMPORT_BOUNDARY_CHANGED');candidate=candidate.replace(at,at+'\n'+eventImport);
  }
  if(!candidate.includes('window.dispatchEvent(new Event(MODEL_STATUS_REFRESH_EVENT));')){
   for(const marker of ['onFinish: ({ isError }) => {\n','onError: (err) => {\n']){if(candidate.split(marker).length!==2)throw Error('CHATROOM_EVENT_BOUNDARY_CHANGED');candidate=candidate.replace(marker,marker+'      window.dispatchEvent(new Event(MODEL_STATUS_REFRESH_EVENT));\n');}
   const marker='        setContinuingMessageId(null);\n        sendingRef.current = false;\n';if(candidate.split(marker).length!==2)throw Error('CHATROOM_CONTINUE_BOUNDARY_CHANGED');candidate=candidate.replace(marker,marker+'        window.dispatchEvent(new Event(MODEL_STATUS_REFRESH_EVENT));\n');
  }
  if(candidate.split('window.dispatchEvent(new Event(MODEL_STATUS_REFRESH_EVENT));').length!==before.split('window.dispatchEvent(new Event(MODEL_STATUS_REFRESH_EVENT));').length)throw Error('TEST_MODEL_NOTIFICATIONS_NOT_PRESERVED');
 }
 if(item.path==='src/lib/import/mufy-source-rule-envelope.ts'){
  // Only the observed relay bug is in scope. Keep TEST's original envelope
  // exports/imports instead of pulling an unrelated local module refactor.
  const relay=/^const DRAFT_RELAY = .+;$/m.exec(candidate)?.[0];
  if(!relay||!relay.includes("var text=draft.value;draft.value='';")||!/^const DRAFT_RELAY = .+;$/m.test(before))throw Error('SOURCE_RELAY_BOUNDARY_CHANGED');
  candidate=before.replace(/^const DRAFT_RELAY = .+;$/m,()=>relay);
 }
 if(item.path==='src/components/regex/RegexIframe.tsx'){
  const comment=' * The TEST-only standalone official cross-origin Bilibili player is the sole\n * same-origin exception. It never receives the author renderer\'s host bridge.\n *\n';
  if(candidate.split('sandbox="allow-scripts allow-same-origin"').length!==2||!before.includes('sandbox="allow-scripts"'))throw Error('OFFICIAL_PLAYER_SECURITY_HUNK_NOT_IDENTIFIED');
  candidate=candidate.replace('sandbox="allow-scripts allow-same-origin"','sandbox="allow-scripts"').replace(comment,'');
 }
 const file=`${dir}/patch/${item.path}`;await mkdir(dirname(file),{recursive:true});await writeFile(file,candidate);
 const process=Bun.spawn(['git','diff','--no-index','--unified=3','--',`${dir}/baseline/${item.path}`,file],{stdout:'pipe',stderr:'pipe'});
 const [diff,err,code]=await Promise.all([new Response(process.stdout).text(),new Response(process.stderr).text(),process.exited]);
 if(code!==1||!diff.includes('@@'))throw Error('EXPECTED_RUNTIME_DIFF_MISSING:'+item.path+':'+err.slice(0,80));
 patches.push(diff.replace(/^diff --git .+$/m,`diff --git a/${item.path} b/${item.path}`).replace(/^--- .+$/m,`--- a/${item.path}`).replace(/^\+\+\+ .+$/m,`+++ b/${item.path}`));
 entries.push({path:item.path,before:item.sha256,after:hash(candidate),newFile:false});
}
for(const path of additions){
 const candidate=(await readFile(path,'utf8')).replace(/\r\n/g,'\n'),lines=candidate.replace(/\n$/,'').split('\n');
 const file=`${dir}/patch/${path}`;await mkdir(dirname(file),{recursive:true});await writeFile(file,candidate);
 patches.push(`diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line=>'+'+line).join('\n')}\n`);
 entries.push({path,before:null,after:hash(candidate),newFile:true});
}
const patch=patches.join('\n');
if(patch.includes('+      sandbox="allow-scripts allow-same-origin"'))throw Error('UNAPPROVED_OFFICIAL_PLAYER_HUNK_INCLUDED');
await writeFile(`${dir}/runtime.patch`,patch);
await writeFile(`${dir}/runtime-manifest.json`,JSON.stringify({observedAt:new Date().toISOString(),target:baseline.target,basedOnImage:baseline.image,entries,patchSha256:hash(patch),withheldSecurityChange,lineEndings:'LF deployment copies; working tree and source evidence preserved',remoteWrites:0,buildStarted:false,deployed:false,fullFidelityAccepted:false},null,2));
console.log(JSON.stringify({files:entries.length,modified:baseline.entries.length,added:additions.length,withheldSecurityChange,remoteWrites:0,buildStarted:false}));
