/** Local baseline reconstruction only; never writes the checkout or remote host. */
import {mkdtemp,mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=join(process.cwd(),'outputs/mufy-consolidated-20261029');
const manifest=JSON.parse(await readFile(join(root,'runtime-manifest.json'),'utf8'));
const patch=await readFile(join(root,'runtime.patch'),'utf8');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
if(hash(patch)!==manifest.patchSha256||manifest.entries.length!==28||new Set(manifest.entries.map((entry:{path:string})=>entry.path)).size!==28)throw Error('PATCH_MANIFEST_MISMATCH');
const workspace=await mkdtemp(join(tmpdir(),'mufy-runtime-dry-run-'));
for(const entry of manifest.entries as {path:string;before:string|null}[]){
 if(!entry.path.startsWith('src/')||entry.path.includes('..'))throw Error('UNSAFE_PATCH_PATH');
 if(entry.before){await mkdir(dirname(join(workspace,entry.path)),{recursive:true});await copyFile(join(root,'baseline',entry.path),join(workspace,entry.path));}
}
async function git(args:string[]){const p=Bun.spawn(['git',...args],{cwd:workspace,stdout:'pipe',stderr:'pipe'});const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code)throw Error('LOCAL_PATCH_FAILED:'+out+err);}
await git(['apply','--check',join(root,'runtime.patch')]);
await git(['apply',join(root,'runtime.patch')]);
for(const entry of manifest.entries as {path:string;after:string}[]){if(hash(await readFile(join(workspace,entry.path),'utf8'))!==entry.after)throw Error('APPLIED_HASH_MISMATCH:'+entry.path);}
const iframe=await readFile(join(workspace,'src/components/regex/RegexIframe.tsx'),'utf8');
if(iframe.includes('sandbox="allow-scripts allow-same-origin"'))throw Error('UNAPPROVED_SANDBOX_EXPANSION');
const room=await readFile(join(workspace,'src/components/chat/ChatRoom.tsx'),'utf8'),relay=await readFile(join(workspace,'src/lib/import/mufy-source-rule-envelope.ts'),'utf8');
if(!room.includes('<MufyPrefixPanel')||!room.includes('<MufySourceControls')||!room.includes('<MufyHaloToolkit')||room.split('window.dispatchEvent(new Event(MODEL_STATUS_REFRESH_EVENT));').length!==4||!relay.includes("var text=draft.value;draft.value='';"))throw Error('INTEGRATION_OR_DELTA_RELAY_MISSING');
const proof={observedAt:new Date().toISOString(),files:manifest.entries.length,patchSha256:manifest.patchSha256,localApplyCheck:true,allResultHashesMatch:true,officialPlayerSandboxPreserved:true,remoteWrites:0,buildStarted:false,deployed:false,fullFidelityAccepted:false};
await writeFile(join(root,'patch-check.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
