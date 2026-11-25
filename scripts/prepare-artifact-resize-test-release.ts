/** Read-only TEST baseline capture and local three-file release staging. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
const isolated=process.argv.includes('--source-component-isolation');
const formNewlines=process.argv.includes('--source-envelope-form-newlines');
const dir=formNewlines?'outputs/mufy-source-envelope-form-newlines-20261028':isolated?'outputs/mufy-source-component-isolation-20261028':'outputs/mufy-artifact-resize-20261028';
const files=isolated?['src/lib/import/mufy-source-rule-envelope.ts']:['src/lib/regex/iframe-bridge.ts','src/components/chat/messages/ArtifactIframe.tsx','src/components/chat/MessageRenderer.tsx'];
const expected=formNewlines?['da2170a58274aac99800b26814dcc010219298efeea60c865643d01eabc719fc']:isolated?['80be6addcd4e1f8e98b4d041a59391122471d6253c990b5bd3de42f14c961769']:['0f188e5eaea99eb692cb0143c4b503249ea19933d82dcc7b725d4511c0e7ba0e','dd7f06f9fe884a6af256499b1a0a7e6cc5e3259c9c703895db7d7689b3a5d582','4c6a9beae3d87a79e801975d9a5cef9f96885729277338d59884d27d335dd926'];
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const bytes=new Uint8Array(await new Response(p.stdout).arrayBuffer());if(await p.exited)throw Error('REMOTE_READ_FAILED');return bytes;}
if(new TextDecoder().decode(await read('cd /root/projects/yearn-chat && docker compose port app 3000')).trim()!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
const hash=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const entries=[];
for(const [i,path] of files.entries()){
 const baseline=await read(`cd /root/projects/yearn-chat && cat ${path}`);
 if(hash(baseline)!==expected[i])throw Error('REMOTE_CHANGED:'+path);
 let candidate=await readFile(path);
 if(isolated){
  // The workspace includes unrelated, not-yet-published dependency refactors.
  // Ship only this reviewed hunk against the exact running source baseline.
  const local=candidate.toString('utf8'),remote=new TextDecoder().decode(baseline);
  const start=local.indexOf('  // A self-contained source component');
  const end=local.indexOf('  const prose =',start);
  const anchor='  if (!fragments.length) return [{ type: "html", content: html }];';
  if(start<0||end<start||remote.split(anchor).length!==2||(!formNewlines&&remote.includes('const onlyFence')))throw Error('ISOLATION_HUNK_MISMATCH');
  const newline=remote.includes('\r\n')?'\r\n':'\n';
  const hunk=local.slice(start,end).replace(/\r\n?/g,'\n').replace(/\n/g,newline);
  let staged=formNewlines?remote:remote.replace(anchor+newline,anchor+newline+hunk);
  if(formNewlines){
   const oldCheck='  return replacement.startsWith(MUFY_SOURCE_ENVELOPE_PREFIX);';
   const oldParse='    value = JSON.parse(replacement.slice(MUFY_SOURCE_ENVELOPE_PREFIX.length));';
   if(staged.split(oldCheck).length!==2||staged.split(oldParse).length!==2)throw Error('FORM_NEWLINE_HUNK_MISMATCH');
   const checkStart=local.indexOf('  return replacement.startsWith(MUFY_SOURCE_ENVELOPE_PREFIX)'),checkEnd=local.indexOf('\n}',checkStart);
   const parseStart=local.indexOf('    const headerLength='),parseEnd=local.indexOf('\n',local.indexOf('    value = JSON.parse(replacement.slice(headerLength));',parseStart));
   staged=staged.replace(oldCheck,local.slice(checkStart,checkEnd).replace(/\r\n?/g,'\n').replace(/\n/g,newline)).replace(oldParse,local.slice(parseStart,parseEnd).replace(/\r\n?/g,'\n').replace(/\n/g,newline));
  }
  candidate=Buffer.from(staged);
 }
 for(const [subdir,data] of [['baseline',baseline],['patch',candidate]] as const){const out=`${dir}/${subdir}/${path}`;await mkdir(dirname(out),{recursive:true});await writeFile(out,data);}
 entries.push({path,before:expected[i],after:hash(candidate)});
}
const tips=JSON.parse(await readFile('outputs/reply-suggestions-20261027/release/manifest.json','utf8')).entries;
const preservedTips=new TextDecoder().decode(await read(`cd /root/projects/yearn-chat && sha256sum ${tips.map((e:{path:string})=>e.path).join(' ')}`)).trim().split(/\r?\n/).map(line=>{const [after,path]=line.split(/\s+/);return {path,after};});
await writeFile(`${dir}/manifest.json`,JSON.stringify({target:'115.29.213.73:8091',observedAt:new Date().toISOString(),entries,preservedTips,scope:isolated?'isolate self-contained source UI from surrounding global message skin':'bare artifact content-height; source-only min-height',reviewRequired:true},null,2));
console.log(JSON.stringify({entries,preservedTips:preservedTips.length,remoteWrites:0}));
